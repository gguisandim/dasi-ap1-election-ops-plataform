// Contratos compartilhados de reports / Operational Analytics 2.0.
// Ver SPEC/2026-10-06-platform-depth-integration.md (Parte 2).
// Restricao de runtime: apenas sintaxe apagavel (sem enum/namespace).

/**
 * Vocabulario fechado de metricas (SPEC 2.3). A UI so oferece estas chaves e o
 * servidor rejeita qualquer metrica fora desta lista com 400.
 */
export const REPORT_METRICS = [
  "incidentsOpened",
  "incidentsOpenedCritical",
  "incidentsResolved",
  "incidentsEscalated",
  "incidentsOverdueSla",
  "incidentsActive",
  "transmissionFailures",
  "transmissionOffline",
  "transmissionSuccessRate",
  "resourceRequestsCreated",
  "resourceRequestsFulfilled",
  "resourceRequestsOverdue",
  "shiftCoveragePercent",
  "shiftCoverageEmpty",
  "dispatchesActive",
  "routesDelayed",
  "deliveriesFailed",
  "deliveriesCompleted",
  "preparationReady",
  "preparationBlocked",
  "assetsLost",
  "assetsInMaintenance",
  "assetsUnavailable",
] as const;

export type ReportMetric = (typeof REPORT_METRICS)[number];

export const REPORT_GRANULARITIES = ["hour", "day", "week"] as const;

export type ReportGranularity = (typeof REPORT_GRANULARITIES)[number];

/** Janela maxima aceita por /reports/timeseries (SPEC 2.2). */
export const REPORT_MAX_WINDOW_DAYS = 366;

export const REPORT_DRILLDOWN_DEFAULT_LIMIT = 50;

export const REPORT_DRILLDOWN_MAX_LIMIT = 200;

export const REPORT_MAX_VIEWS_PER_OWNER = 20;

/** Chaves aceitas nos filtros de uma saved view (SPEC 2.7). */
export const REPORT_VIEW_FILTER_KEYS = [
  "from",
  "to",
  "electionId",
  "electoralZoneId",
  "pollingPlaceId",
  "categoryId",
  "status",
  "severity",
] as const;

export type ReportViewFilterKey = (typeof REPORT_VIEW_FILTER_KEYS)[number];

export type ReportDeepLinkKind =
  | "INCIDENT"
  | "TRANSMISSION_POINT"
  | "RESOURCE_REQUEST"
  | "FIELD_SHIFT"
  | "FIELD_DISPATCH"
  | "ROUTE"
  | "ASSET"
  | "PREPARATION_CHECKLIST";

export interface ReportBucket {
  bucketStart: string;
  bucketEnd: string;
  value: number;
  sampleSize: number;
}

export interface SeriesPoint {
  value: number;
  sampleSize: number;
}

export interface ReportSeries {
  metric: ReportMetric;
  granularity: ReportGranularity;
  from: string;
  to: string;
  bucketCount: number;
  buckets: ReportBucket[];
  totals: SeriesPoint;
}

/**
 * Resultado de um indicador (SLA ou normalizacao). `value` e `null` sempre que
 * nao ha amostra; `sampleSize` e 0 nesse caso. Nunca inventamos 0 (I5 / 2.4).
 */
export interface IndicatorResult {
  value: number | null;
  sampleSize: number;
}

export interface BucketRange {
  start: Date;
  end: Date;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isReportMetric(value: string): value is ReportMetric {
  return (REPORT_METRICS as readonly string[]).includes(value);
}

export function isReportGranularity(value: string): value is ReportGranularity {
  return (REPORT_GRANULARITIES as readonly string[]).includes(value);
}

/** Granularidade invalida lanca; o servidor converte em 400 (SPEC 2.2). */
export function assertReportGranularity(value: string): ReportGranularity {
  if (!isReportGranularity(value))
    throw new Error(`Granularidade de serie invalida: ${value}.`);
  return value;
}

/** Metrica fora do vocabulario lanca; o servidor converte em 400 (SPEC 2.3). */
export function assertReportMetric(value: string): ReportMetric {
  if (!isReportMetric(value))
    throw new Error(`Metrica fora do vocabulario de reports: ${value}.`);
  return value;
}

/** Janela acima do teto lanca; o servidor converte em 400 (SPEC 2.2). */
export function assertWindowWithinLimit(
  from: Date,
  to: Date,
  maxDays = REPORT_MAX_WINDOW_DAYS,
): void {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  if (Number.isNaN(fromMs) || Number.isNaN(toMs))
    throw new Error("Janela temporal invalida.");
  if (toMs < fromMs) throw new Error("A janela termina antes de comecar.");
  if (toMs - fromMs > maxDays * DAY_MS)
    throw new Error(`A janela excede o limite de ${maxDays} dias.`);
}

/**
 * Inicio do bucket que contem `date`. hour/day alinham em UTC; week alinha na
 * segunda-feira 00:00 UTC (semana ISO).
 */
export function alignBucketStart(
  date: Date,
  granularity: ReportGranularity,
): Date {
  const time = date.getTime();
  if (granularity === "hour") return new Date(Math.floor(time / HOUR_MS) * HOUR_MS);
  const dayStart = Math.floor(time / DAY_MS) * DAY_MS;
  if (granularity === "day") return new Date(dayStart);
  const weekday = (new Date(dayStart).getUTCDay() + 6) % 7;
  return new Date(dayStart - weekday * DAY_MS);
}

export function shiftBucket(
  start: Date,
  granularity: ReportGranularity,
  steps = 1,
): Date {
  if (granularity === "hour")
    return new Date(start.getTime() + steps * HOUR_MS);
  if (granularity === "day") return new Date(start.getTime() + steps * DAY_MS);
  return new Date(start.getTime() + steps * 7 * DAY_MS);
}

/**
 * Eixo temporal continuo: gera todos os buckets que intersectam [from, to),
 * inclusive os que ficarao vazios (SPEC 2.2).
 */
export function continuousBucketRanges(
  from: Date,
  to: Date,
  granularity: ReportGranularity,
): BucketRange[] {
  const ranges: BucketRange[] = [];
  const limit = to.getTime();
  let start = alignBucketStart(from, granularity);
  while (start.getTime() < limit) {
    const end = shiftBucket(start, granularity);
    ranges.push({ start, end });
    start = end;
  }
  return ranges;
}

export function bucketKey(date: Date, granularity: ReportGranularity): string {
  return alignBucketStart(date, granularity).toISOString();
}

/**
 * Buckets vazios recebem value = 0 e sampleSize = 0 (SPEC 2.2). `resolve`
 * devolve null quando o bucket nao tem observacao; `totalize` calcula o total
 * do periodo inteiro (para taxas, o total e recomputado, nao somado).
 */
export function buildSeries(
  metric: ReportMetric,
  granularity: ReportGranularity,
  from: Date,
  to: Date,
  ranges: readonly BucketRange[],
  resolve: (range: BucketRange) => SeriesPoint | null,
  totalize: () => SeriesPoint,
): ReportSeries {
  const buckets: ReportBucket[] = ranges.map((range) => {
    const point = resolve(range);
    return {
      bucketStart: range.start.toISOString(),
      bucketEnd: range.end.toISOString(),
      value: point?.value ?? 0,
      sampleSize: point?.sampleSize ?? 0,
    };
  });
  return {
    metric,
    granularity,
    from: from.toISOString(),
    to: to.toISOString(),
    bucketCount: buckets.length,
    buckets,
    totals: totalize(),
  };
}

// ---------------------------------------------------------------------------
// Formulas de SLA (SPEC 2.4). Documentadas aqui e cobertas por teste.
// ---------------------------------------------------------------------------

export interface IncidentTimingRow {
  severity: string;
  status: string;
  openedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  slaDeadline: Date | null;
  escalationLevel: number;
}

const TERMINAL_INCIDENT_STATUSES = ["RESOLVED", "CLOSED", "CANCELLED"];

function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / MINUTE_MS;
}

function meanMinutes(values: readonly number[]): IndicatorResult {
  if (values.length === 0) return { value: null, sampleSize: 0 };
  const total = values.reduce((sum, value) => sum + value, 0);
  return { value: round1(total / values.length), sampleSize: values.length };
}

/** Media de (acknowledgedAt - openedAt); null sem reconhecimento no periodo. */
export function meanResponseMinutes(
  rows: readonly IncidentTimingRow[],
): IndicatorResult {
  const durations = rows
    .filter((row) => row.acknowledgedAt !== null)
    .map((row) => minutesBetween(row.openedAt, row.acknowledgedAt as Date))
    .filter((value) => value >= 0);
  return meanMinutes(durations);
}

/** Media de (resolvedAt - openedAt); null sem resolucao no periodo. */
export function meanResolutionMinutes(
  rows: readonly IncidentTimingRow[],
): IndicatorResult {
  const durations = rows
    .filter((row) => row.resolvedAt !== null)
    .map((row) => minutesBetween(row.openedAt, row.resolvedAt as Date))
    .filter((value) => value >= 0);
  return meanMinutes(durations);
}

/** MTTR: mesma media de resolucao restrita a severidade HIGH ou CRITICAL. */
export function mttrMinutes(
  rows: readonly IncidentTimingRow[],
): IndicatorResult {
  const critical = rows.filter(
    (row) => row.severity === "HIGH" || row.severity === "CRITICAL",
  );
  return meanResolutionMinutes(critical);
}

/** 100 x resolvidos dentro do prazo / incidentes com slaDeadline definido. */
export function slaCompliancePercent(
  rows: readonly IncidentTimingRow[],
): IndicatorResult {
  const eligible = rows.filter((row) => row.slaDeadline !== null);
  if (eligible.length === 0) return { value: null, sampleSize: 0 };
  const within = eligible.filter(
    (row) =>
      row.resolvedAt !== null &&
      row.resolvedAt.getTime() <= (row.slaDeadline as Date).getTime(),
  ).length;
  return { value: round1((within / eligible.length) * 100), sampleSize: eligible.length };
}

/**
 * Vencidos: slaDeadline < now com status nao terminal, mais terminais com
 * resolvedAt posterior ao slaDeadline (SPEC 2.4).
 */
export function deadlineMisses(
  rows: readonly IncidentTimingRow[],
  now: Date,
): IndicatorResult {
  const misses = rows.filter((row) => {
    if (row.slaDeadline === null) return false;
    const deadline = row.slaDeadline.getTime();
    if (!TERMINAL_INCIDENT_STATUSES.includes(row.status))
      return deadline < now.getTime();
    return row.resolvedAt !== null && row.resolvedAt.getTime() > deadline;
  }).length;
  const eligible = rows.filter((row) => row.slaDeadline !== null).length;
  return { value: misses, sampleSize: eligible };
}

/** 100 x incidentes com escalationLevel > 0 / incidentes abertos no periodo. */
export function escalationRatePercent(
  rows: readonly IncidentTimingRow[],
): IndicatorResult {
  if (rows.length === 0) return { value: null, sampleSize: 0 };
  const escalated = rows.filter((row) => row.escalationLevel > 0).length;
  return { value: round1((escalated / rows.length) * 100), sampleSize: rows.length };
}

export interface TransmissionTransitionRow {
  from: string;
  to: string;
  occurredAt: Date;
  durationSeconds: number | null;
}

/**
 * Soma das duracoes de intervalos OFFLINE. O intervalo e registrado na
 * transicao cujo `to` e OFFLINE; `durationSeconds` e preenchido pelo servidor
 * quando a proxima transicao chega. Sem transicao seguinte, conta ate `now`.
 */
export function transmissionDowntimeMinutes(
  rows: readonly TransmissionTransitionRow[],
  now: Date,
): IndicatorResult {
  const offline = rows.filter((row) => row.to === "OFFLINE");
  if (offline.length === 0) return { value: 0, sampleSize: 0 };
  const seconds = offline.reduce((sum, row) => {
    if (row.durationSeconds !== null && row.durationSeconds !== undefined)
      return sum + Math.max(0, row.durationSeconds);
    return sum + Math.max(0, (now.getTime() - row.occurredAt.getTime()) / 1000);
  }, 0);
  return { value: round1(seconds / 60), sampleSize: offline.length };
}

/**
 * 100 x (janela - downtime) / janela. Null quando nao ha janela observada.
 * `sampleSize` e a janela observada em minutos.
 */
export function transmissionUptimePercent(
  windowMinutes: number,
  downtimeMinutes: number,
): IndicatorResult {
  if (!(windowMinutes > 0)) return { value: null, sampleSize: 0 };
  const online = Math.max(0, windowMinutes - downtimeMinutes);
  return {
    value: round1((online / windowMinutes) * 100),
    sampleSize: Math.round(windowMinutes),
  };
}

export interface ResourceRequestTimingRow {
  submittedAt: Date | null;
  fulfilledAt: Date | null;
}

/** Media de (fulfilledAt - submittedAt) das solicitacoes atendidas. */
export function fulfillmentMeanMinutes(
  rows: readonly ResourceRequestTimingRow[],
): IndicatorResult {
  const durations = rows
    .filter((row) => row.submittedAt !== null && row.fulfilledAt !== null)
    .map((row) =>
      minutesBetween(row.submittedAt as Date, row.fulfilledAt as Date),
    )
    .filter((value) => value >= 0);
  return meanMinutes(durations);
}

export interface DispatchTimingRow {
  requestedAt: Date;
  completedAt: Date | null;
}

/** Media de (completedAt - requestedAt) dos dispatches concluidos. */
export function dispatchMeanMinutes(
  rows: readonly DispatchTimingRow[],
): IndicatorResult {
  const durations = rows
    .filter((row) => row.completedAt !== null)
    .map((row) => minutesBetween(row.requestedAt, row.completedAt as Date))
    .filter((value) => value >= 0);
  return meanMinutes(durations);
}

// ---------------------------------------------------------------------------
// Normalizacao de zonas (SPEC 2.5).
// ---------------------------------------------------------------------------

/** Metricas por 1000 eleitores; null quando o denominador e zero. */
export function per1000Voters(
  value: number,
  registeredVoters: number,
): number | null {
  if (!(registeredVoters > 0)) return null;
  return round1((value / registeredVoters) * 1000);
}

/** Metricas por local de votacao; null quando o denominador e zero. */
export function perPlace(value: number, pollingPlaceCount: number): number | null {
  if (!(pollingPlaceCount > 0)) return null;
  return round1(value / pollingPlaceCount);
}
