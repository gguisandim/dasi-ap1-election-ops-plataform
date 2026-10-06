// Contratos compartilhados de transmission.
// Ver SPEC/2026-10-06-platform-depth-integration.md (Parte 3 — Transmission / NOC 2.0).
// Restricao de runtime: apenas sintaxe apagavel (sem enum/namespace).
//
// Este modulo concentra o vocabulario de estados de conectividade e as formulas
// puras de SLA (secao 3.5). O servidor persiste as transicoes e usa estas funcoes
// para derivar uptime/downtime; o cliente exibe o mesmo vocabulario.

export const CONNECTIVITY_STATUSES = ["ONLINE", "DEGRADED", "OFFLINE", "UNKNOWN"] as const;

/**
 * Estados normativos de conectividade (secao 3.3).
 * ONLINE      operando normalmente
 * DEGRADED    operando com degradacao declarada
 * OFFLINE     indisponivel
 * UNKNOWN     sem leitura recente — nunca contabilizado como downtime
 */
export type ConnectivityStatus = (typeof CONNECTIVITY_STATUSES)[number];

export const CONNECTIVITY_LABELS: Record<ConnectivityStatus, string> = {
  ONLINE: "Online",
  DEGRADED: "Degradada",
  OFFLINE: "Offline",
  UNKNOWN: "Desconhecida",
};

/**
 * Estados que contam como "circuito ativo" para as regras de primario unico e de
 * destino de failover. `UNKNOWN` e `OFFLINE` nao sustentam trafego, logo nao sao
 * ativos — um destino de failover precisa estar em ONLINE ou DEGRADED.
 */
export function isCircuitActiveStatus(status: ConnectivityStatus): boolean {
  return status === "ONLINE" || status === "DEGRADED";
}

export const TRANSMISSION_FAILOVER_STATUSES = ["ACTIVE", "RECOVERED", "CANCELLED"] as const;
export type TransmissionFailoverStatus = (typeof TRANSMISSION_FAILOVER_STATUSES)[number];

export const TRANSMISSION_FAILOVER_LABELS: Record<TransmissionFailoverStatus, string> = {
  ACTIVE: "Ativo",
  RECOVERED: "Recuperado",
  CANCELLED: "Cancelado",
};

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;

export type DateLike = Date | string | number;

/** Janela observada em milissegundos desde a epoch. */
export interface TimeWindow {
  from: number;
  to: number;
}

/** Intervalo de conectividade continuo; `endedAt = null` significa aberto. */
export interface TransmissionInterval {
  status: ConnectivityStatus;
  startedAt: number;
  endedAt: number | null;
}

/** Transicao minima necessaria para reconstruir intervalos (formato estrutural). */
export interface StateTransitionLike {
  to: ConnectivityStatus;
  occurredAt: DateLike;
}

export function toEpochMs(value: DateLike): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

/**
 * Fecha o intervalo anterior de uma sequencia de transicoes.
 *
 * `durationSeconds` de uma transicao e sempre `occurredAt_atual - occurredAt_anterior`
 * no mesmo escopo (ponto, ou ponto+circuito). Sem transicao anterior devolve `null`
 * — ausencia de dado nunca vira zero (invariante I5).
 */
export function transitionDurationSeconds(
  previous: DateLike | null | undefined,
  current: DateLike,
): number | null {
  if (previous === null || previous === undefined) return null;
  const delta = toEpochMs(current) - toEpochMs(previous);
  return Math.max(0, Math.round(delta / SECOND_MS));
}

/**
 * Reconstroi intervalos continuos a partir das transicoes de um escopo,
 * fechando o ultimo intervalo em `openUntil`. Transicoes devem trazer o estado
 * `to` e o instante em que passou a valer.
 */
export function buildIntervals(
  transitions: readonly StateTransitionLike[],
  openUntil: DateLike,
): TransmissionInterval[] {
  const ordered = transitions
    .map((transition) => ({ status: transition.to, at: toEpochMs(transition.occurredAt) }))
    .sort((left, right) => left.at - right.at);
  const until = toEpochMs(openUntil);
  return ordered.map((entry, index) => ({
    status: entry.status,
    startedAt: entry.at,
    endedAt: index + 1 < ordered.length ? ordered[index + 1].at : until,
  }));
}

/** Duracao bruta (ms) por estado, recortada na janela. */
export interface ConnectivityDurations {
  windowMs: number;
  onlineMs: number;
  degradedMs: number;
  offlineMs: number;
  unknownMs: number;
}

/**
 * Recorta cada intervalo na janela e soma os milissegundos por estado.
 * Intervalos abertos sao fechados na borda `to` da janela. Trechos da janela
 * nao cobertos por nenhum intervalo sao contados como UNKNOWN (sem leitura),
 * de modo que ausencia de dado nunca vira uptime.
 */
export function connectivityDurations(
  intervals: readonly TransmissionInterval[],
  window: TimeWindow,
): ConnectivityDurations {
  const durations: ConnectivityDurations = {
    windowMs: Math.max(0, window.to - window.from),
    onlineMs: 0,
    degradedMs: 0,
    offlineMs: 0,
    unknownMs: 0,
  };
  let coveredMs = 0;
  for (const interval of intervals) {
    const start = Math.max(interval.startedAt, window.from);
    const end = Math.min(interval.endedAt ?? window.to, window.to);
    if (end <= start) continue;
    const ms = end - start;
    coveredMs += ms;
    if (interval.status === "ONLINE") durations.onlineMs += ms;
    else if (interval.status === "DEGRADED") durations.degradedMs += ms;
    else if (interval.status === "OFFLINE") durations.offlineMs += ms;
    else durations.unknownMs += ms;
  }
  durations.unknownMs += Math.max(0, durations.windowMs - coveredMs);
  return durations;
}

/**
 * uptimePercent = 100 × onlineMinutes / observedMinutes
 * observedMinutes = janela − unknownMinutes
 *
 * `UNKNOWN` e excluido do uptime; quando nao ha janela observada, devolve `null`
 * (nunca 0). O tempo DEGRADED permanece no denominador, ou seja, reduz o uptime.
 */
export function uptimePercentFromDurations(durations: ConnectivityDurations): number | null {
  const observedMs = Math.max(0, durations.windowMs - durations.unknownMs);
  if (observedMs <= 0) return null;
  return round1((durations.onlineMs / observedMs) * 100);
}

export interface ConnectivitySummary {
  windowMinutes: number;
  onlineMinutes: number;
  degradedMinutes: number;
  offlineMinutes: number;
  unknownMinutes: number;
  observedMinutes: number;
  uptimePercent: number | null;
}

export function summarizeIntervals(
  intervals: readonly TransmissionInterval[],
  window: TimeWindow,
): ConnectivitySummary {
  const durations = connectivityDurations(intervals, window);
  const observedMs = Math.max(0, durations.windowMs - durations.unknownMs);
  return {
    windowMinutes: toMinutes(durations.windowMs),
    onlineMinutes: toMinutes(durations.onlineMs),
    degradedMinutes: toMinutes(durations.degradedMs),
    offlineMinutes: toMinutes(durations.offlineMs),
    unknownMinutes: toMinutes(durations.unknownMs),
    observedMinutes: toMinutes(observedMs),
    uptimePercent: uptimePercentFromDurations(durations),
  };
}

export function uptimePercent(
  intervals: readonly TransmissionInterval[],
  window: TimeWindow,
): number | null {
  return uptimePercentFromDurations(connectivityDurations(intervals, window));
}

export function downtimeMinutes(
  intervals: readonly TransmissionInterval[],
  window: TimeWindow,
): number {
  return toMinutes(connectivityDurations(intervals, window).offlineMs);
}

export function degradedMinutes(
  intervals: readonly TransmissionInterval[],
  window: TimeWindow,
): number {
  return toMinutes(connectivityDurations(intervals, window).degradedMs);
}

export function unknownMinutes(
  intervals: readonly TransmissionInterval[],
  window: TimeWindow,
): number {
  return toMinutes(connectivityDurations(intervals, window).unknownMs);
}

export function observedMinutes(
  intervals: readonly TransmissionInterval[],
  window: TimeWindow,
): number {
  const durations = connectivityDurations(intervals, window);
  return toMinutes(Math.max(0, durations.windowMs - durations.unknownMs));
}

/**
 * recoverySeconds = media, em segundos, da duracao dos intervalos OFFLINE
 * encerrados por um intervalo nao-OFFLINE. `null` quando nao ha amostra.
 * Intervalo OFFLINE ainda aberto nao conta (a recuperacao nao foi concluida).
 */
export function recoverySeconds(intervals: readonly TransmissionInterval[]): number | null {
  const ordered = [...intervals].sort((left, right) => left.startedAt - right.startedAt);
  const samples: number[] = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    if (current.status !== "OFFLINE" || current.endedAt === null) continue;
    const next = ordered[index + 1];
    if (!next || next.status === "OFFLINE") continue;
    samples.push((current.endedAt - current.startedAt) / SECOND_MS);
  }
  if (samples.length === 0) return null;
  return Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
}

/** Ponto minimo para o calculo de risco de prazo. */
export interface DeadlineRiskPoint {
  status: string;
  operationalDeadline: DateLike | null | undefined;
}

/**
 * deadlineRiskPercent = 100 × pontos com operationalDeadline < now e status != SUCCESS
 *                       / pontos com deadline definido
 * `null` quando nenhum ponto possui deadline definido (denominador zero).
 */
export function deadlineRiskPercent(
  points: readonly DeadlineRiskPoint[],
  now: Date = new Date(),
): number | null {
  const withDeadline = points.filter(
    (point) => point.operationalDeadline !== null && point.operationalDeadline !== undefined,
  );
  if (withDeadline.length === 0) return null;
  const nowMs = now.getTime();
  const risky = withDeadline.filter(
    (point) =>
      point.status !== "SUCCESS" && toEpochMs(point.operationalDeadline as DateLike) < nowMs,
  );
  return round1((risky.length / withDeadline.length) * 100);
}

export interface ProviderCircuitIntervals {
  circuitId: string;
  intervals: readonly TransmissionInterval[];
}

export interface ProviderPerformanceInput {
  providerId: string;
  code: string;
  name: string;
  slaTargetUptimePercent: number | null;
  circuits: readonly ProviderCircuitIntervals[];
  incidentCount: number;
  failoverCount: number;
}

export interface ProviderCircuitPerformance {
  circuitId: string;
  uptimePercent: number | null;
  observedMinutes: number;
}

export interface ProviderPerformance {
  providerId: string;
  code: string;
  name: string;
  slaTargetUptimePercent: number | null;
  circuitCount: number;
  incidentCount: number;
  failoverCount: number;
  uptimePercent: number | null;
  observedMinutes: number;
  meetsTarget: boolean | null;
  circuits: ProviderCircuitPerformance[];
}

/**
 * providerPerformance agrega por provedor:
 *  - uptimePercent ponderado pelo tempo observado de cada circuito (os circuitos
 *    do provedor compartilham o mesmo provedor; ponderar por minutos observados
 *    evita que um circuito sem leitura distorca a media);
 *  - incidentCount e failoverCount recebidos ja escopados pelo chamador;
 *  - meetsTarget compara o uptime consolidado com o alvo de SLA do provedor.
 * Circutios sem janela observada mantem uptimePercent `null` e nao entram no
 * ponderador; provedor sem nenhum observado devolve uptimePercent `null`.
 */
export function providerPerformance(
  providers: readonly ProviderPerformanceInput[],
  window: TimeWindow,
): ProviderPerformance[] {
  return providers.map((provider) => {
    let onlineMs = 0;
    let observedMs = 0;
    const circuits: ProviderCircuitPerformance[] = provider.circuits.map((circuit) => {
      const durations = connectivityDurations(circuit.intervals, window);
      const circuitObservedMs = Math.max(0, durations.windowMs - durations.unknownMs);
      onlineMs += durations.onlineMs;
      observedMs += circuitObservedMs;
      return {
        circuitId: circuit.circuitId,
        uptimePercent: uptimePercentFromDurations(durations),
        observedMinutes: toMinutes(circuitObservedMs),
      };
    });
    const providerUptime = observedMs > 0 ? round1((onlineMs / observedMs) * 100) : null;
    return {
      providerId: provider.providerId,
      code: provider.code,
      name: provider.name,
      slaTargetUptimePercent: provider.slaTargetUptimePercent,
      circuitCount: provider.circuits.length,
      incidentCount: provider.incidentCount,
      failoverCount: provider.failoverCount,
      uptimePercent: providerUptime,
      observedMinutes: toMinutes(observedMs),
      meetsTarget:
        providerUptime !== null && provider.slaTargetUptimePercent !== null
          ? providerUptime >= provider.slaTargetUptimePercent
          : null,
      circuits,
    };
  });
}

function toMinutes(ms: number): number {
  return round1(ms / MINUTE_MS);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
