import { useState, type FormEvent, type ReactNode } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { useParams } from "react-router-dom";
import { transmissionService } from "../../services/transmissionService";
import { useHasPermission } from "../hooks/usePermissions";
import {
  CONNECTIVITY_LABELS,
  CONNECTIVITY_STATUSES,
  DEADLINE_STATE_LABELS,
  TRANSMISSION_FAILOVER_LABELS,
  TRANSMISSION_LABELS,
  deriveDeadlineState,
  isCircuitActiveStatus,
  type AlertStatus,
  type AttemptResult,
  type CircuitInput,
  type ConnectivityStatus,
  type CorrelationSection,
  type TransmissionCorrelation,
} from "../../types";
import styles from "../../styles/overview.module.css";

const deadlineTone = (state: string) => state === "OVERDUE" ? "danger" : state === "DUE_SOON" ? "warning" : state === "COMPLETED" ? "success" : "neutral";
const connectivityTone = (connectivity: ConnectivityStatus) => connectivity === "ONLINE" ? "success" : connectivity === "OFFLINE" ? "danger" : connectivity === "DEGRADED" ? "warning" : "neutral";
const seconds = (value: number | null) => (value === null ? "—" : `${value}s`);
const pct = (value: number | null) => (value === null ? "—" : `${value}%`);

const EMPTY_CIRCUIT: CircuitInput = { code: "", name: "", technology: "", isPrimary: true, status: "ONLINE", providerId: "", notes: "" };

export function TransmissionPointDetailPage() {
  const { id = "" } = useParams();
  const point = useAsync(() => transmissionService.get(id), [id]);
  const history = useAsync(() => transmissionService.connectivityHistory(id), [id]);
  const sla = useAsync(() => transmissionService.pointSla(id), [id]);
  const circuits = useAsync(() => transmissionService.circuits(id), [id]);
  const failovers = useAsync(() => transmissionService.failovers(id), [id]);
  const transitions = useAsync(() => transmissionService.stateHistory(id, { limit: 50 }), [id]);
  const correlation = useAsync(() => transmissionService.correlation({ pointId: id }), [id]);
  const providers = useAsync(transmissionService.providers, []);
  const { allowed: canManage } = useHasPermission("transmission.manage");
  const [connectivity, setConnectivity] = useState<{ connectivity: ConnectivityStatus; latencyMs: string; connectionMethod: string; reason: string }>({ connectivity: "ONLINE", latencyMs: "", connectionMethod: "", reason: "" });
  const [attempt, setAttempt] = useState<{ result: AttemptResult; error: string }>({ result: "SUCCESS", error: "" });
  const [circuitForm, setCircuitForm] = useState<CircuitInput>(EMPTY_CIRCUIT);
  const [failoverForm, setFailoverForm] = useState<{ toCircuitId: string; reason: string }>({ toCircuitId: "", reason: "" });
  const [error, setError] = useState<Error>();

  function reloadAll() { point.reload(); history.reload(); sla.reload(); circuits.reload(); failovers.reload(); transitions.reload(); }
  async function run(action: () => Promise<unknown>, fallback: string) { setError(undefined); try { await action(); } catch (reason) { setError(reason instanceof Error ? reason : new Error(fallback)); } }

  async function saveConnectivity(event: FormEvent) { event.preventDefault(); await run(async () => { await transmissionService.connectivity(id, { connectivity: connectivity.connectivity, latencyMs: connectivity.latencyMs ? Number(connectivity.latencyMs) : undefined, connectionMethod: connectivity.connectionMethod || undefined, reason: connectivity.reason || undefined }); reloadAll(); }, "Falha ao registrar conectividade."); }
  async function registerAttempt(event: FormEvent) { event.preventDefault(); const endedAt = new Date(); const startedAt = new Date(endedAt.getTime() - 30_000); await run(async () => { await transmissionService.attempt(id, { startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), result: attempt.result, error: attempt.result === "SUCCESS" ? undefined : attempt.error }); setAttempt({ result: "SUCCESS", error: "" }); point.reload(); }, "Falha ao registrar tentativa."); }
  async function requestRecovery() { await run(async () => { await transmissionService.recovery(id, { reason: "Recuperação de conectividade pelo operador." }); reloadAll(); }, "Falha ao recuperar conectividade."); }
  async function requestRetry() { await run(async () => { await transmissionService.retry(id, "Retry manual pelo operador."); point.reload(); }, "Falha ao solicitar retry."); }
  async function changeAlert(alertId: string, status: AlertStatus) { await run(async () => { await transmissionService.updateAlert(alertId, status); point.reload(); }, "Falha ao atualizar alerta."); }
  async function createCircuit(event: FormEvent) { event.preventDefault(); await run(async () => { await transmissionService.createCircuit(id, { ...circuitForm, code: circuitForm.code?.toUpperCase(), providerId: circuitForm.providerId || undefined }); setCircuitForm(EMPTY_CIRCUIT); circuits.reload(); point.reload(); }, "Falha ao criar circuito."); }
  async function changeCircuitStatus(circuitId: string, status: ConnectivityStatus) { await run(async () => { await transmissionService.updateCircuit(circuitId, { status }); circuits.reload(); sla.reload(); transitions.reload(); }, "Falha ao atualizar circuito."); }
  async function startFailover(event: FormEvent) { event.preventDefault(); await run(async () => { await transmissionService.startFailover(id, { toCircuitId: failoverForm.toCircuitId, reason: failoverForm.reason }); setFailoverForm({ toCircuitId: "", reason: "" }); failovers.reload(); reloadAll(); }, "Falha ao iniciar failover."); }
  async function recoverFailover(failoverId: string) { await run(async () => { await transmissionService.recoverFailover(id, failoverId); failovers.reload(); reloadAll(); }, "Falha ao recuperar failover."); }
  async function cancelFailover(failoverId: string) { await run(async () => { await transmissionService.cancelFailover(id, failoverId, "Cancelado pelo operador."); failovers.reload(); }, "Falha ao cancelar failover."); }

  if (point.loading) return <Loading label="Carregando ponto…" />;
  if (point.error || !point.data) return <ErrorState error={point.error ?? new Error("Ponto não encontrado.")} />;
  const data = point.data;
  const deadlineState = deriveDeadlineState(data.status, data.operationalDeadline);
  const activeFailover = failovers.data?.find((item) => item.status === "ACTIVE") ?? null;
  const failoverDestinations = (circuits.data ?? []).filter((circuit) => isCircuitActiveStatus(circuit.status));

  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.tag}>{data.identification}</span><h1>{data.pollingPlace.name}</h1><p>Zona {data.electoralZone.number} · {data.election.name}</p></div><div className={styles.actions}><LinkButton secondary to="/transmission">Voltar ao dashboard</LinkButton>{canManage && <Button secondary onClick={() => void requestRecovery()}>Recuperar conectividade</Button>}{canManage && <Button onClick={() => void requestRetry()}>Solicitar retry</Button>}</div></header>{error && <ErrorState error={error} />}

    <div className={styles.metrics}><Card><span>Status</span><strong>{TRANSMISSION_LABELS[data.status]}</strong></Card><Card><span>Estado do prazo</span><strong><Badge tone={deadlineTone(deadlineState)}>{DEADLINE_STATE_LABELS[deadlineState]}</Badge></strong><small>{data.operationalDeadline ? new Date(data.operationalDeadline).toLocaleString("pt-BR") : "Sem limite definido"}</small></Card><Card><span>Conectividade</span><strong>{CONNECTIVITY_LABELS[data.connectivity]}</strong><small>{activeFailover ? `failover: ${activeFailover.toCircuit.code}` : "sem failover ativo"}</small></Card><Card><span>Prioridade</span><strong>P{data.priority}</strong></Card><Card><span>Tentativas</span><strong>{data.attemptCount}</strong><small>{history.data ? `${history.data.failureStreak} falhas consecutivas` : ""}</small></Card><Card><span>Latência</span><strong>{data.latencyMs != null ? `${data.latencyMs} ms` : "—"}</strong></Card><Card><span>Última atividade</span><strong>{data.lastActivity ? new Date(data.lastActivity).toLocaleTimeString("pt-BR") : "—"}</strong></Card><Card><span>Último sucesso</span><strong>{history.data?.lastSuccessAt ? new Date(history.data.lastSuccessAt).toLocaleString("pt-BR") : "—"}</strong></Card></div>

    <Card>
      <div className={styles.sectionTitle}><h2>SLA do ponto</h2><span>{sla.data ? `${sla.data.transitions} transições` : ""}</span></div>
      {sla.loading && <Loading label="Calculando SLA…" />}
      {sla.data && <div className={styles.slaBand}>
        <div><span>Uptime</span><strong className={(sla.data.uptimePercent ?? 100) < 99 ? styles.riskHigh : styles.riskOk}>{pct(sla.data.uptimePercent)}</strong><small className={styles.muted}>UNKNOWN fora do cálculo</small></div>
        <div><span>Downtime</span><strong className={sla.data.offlineMinutes > 0 ? styles.riskHigh : undefined}>{sla.data.offlineMinutes} min</strong><small className={styles.muted}>{sla.data.degradedMinutes} min degradado</small></div>
        <div><span>Sem leitura</span><strong className={styles.warnValue}>{sla.data.unknownMinutes} min</strong><small className={styles.muted}>{sla.data.observedMinutes} min observados</small></div>
        <div><span>Recuperação média</span><strong className={styles.infoValue}>{seconds(sla.data.recoverySeconds)}</strong><small className={styles.muted}>{sla.data.windowMinutes} min na janela</small></div>
      </div>}
    </Card>

    <div className={styles.columns}>
      <Card>
        <div className={styles.sectionTitle}><h2>Circuitos</h2><span>{circuits.data?.length ?? 0}</span></div>
        {circuits.loading && <Loading label="Carregando circuitos…" />}
        {circuits.data?.length === 0 && <EmptyState title="Sem circuitos" description="Nenhum link cadastrado para este ponto." />}
        {circuits.data && circuits.data.length > 0 && <div className={styles.tableWrap}><table><thead><tr><th>Código</th><th>Nome</th><th>Provedor</th><th>Primário</th><th>Status</th><th /></tr></thead><tbody>{circuits.data.map((circuit) => <tr key={circuit.id}><td>{circuit.code}</td><td>{circuit.name}<small>{circuit.technology ?? ""}{circuit.bandwidthMbps ? ` · ${circuit.bandwidthMbps} Mbps` : ""}</small></td><td>{circuit.provider?.name ?? "—"}</td><td>{circuit.isPrimary ? <Badge tone="neutral">primário</Badge> : <small className={styles.muted}>secundário</small>}</td><td><Badge tone={connectivityTone(circuit.status)}>{CONNECTIVITY_LABELS[circuit.status]}</Badge></td><td>{canManage && <Select aria-label={`Status do circuito ${circuit.code}`} value={circuit.status} onChange={(event) => void changeCircuitStatus(circuit.id, event.target.value as ConnectivityStatus)}>{CONNECTIVITY_STATUSES.map((status) => <option key={status} value={status}>{CONNECTIVITY_LABELS[status]}</option>)}</Select>}</td></tr>)}</tbody></table></div>}
        {canManage && <form className={styles.form} onSubmit={createCircuit}><div className={styles.formGrid}><Field label="Código"><Input required value={circuitForm.code ?? ""} onChange={(event) => setCircuitForm((value) => ({ ...value, code: event.target.value }))} /></Field><Field label="Nome"><Input required value={circuitForm.name} onChange={(event) => setCircuitForm((value) => ({ ...value, name: event.target.value }))} /></Field><Field label="Tecnologia"><Input value={circuitForm.technology ?? ""} onChange={(event) => setCircuitForm((value) => ({ ...value, technology: event.target.value }))} /></Field><Field label="Provedor"><Select value={circuitForm.providerId ?? ""} onChange={(event) => setCircuitForm((value) => ({ ...value, providerId: event.target.value }))}><option value="">Sem provedor</option>{providers.data?.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</Select></Field><Field label="Status inicial"><Select value={circuitForm.status} onChange={(event) => setCircuitForm((value) => ({ ...value, status: event.target.value as ConnectivityStatus }))}>{CONNECTIVITY_STATUSES.map((status) => <option key={status} value={status}>{CONNECTIVITY_LABELS[status]}</option>)}</Select></Field><Field label="Primário"><Select value={circuitForm.isPrimary ? "true" : "false"} onChange={(event) => setCircuitForm((value) => ({ ...value, isPrimary: event.target.value === "true" }))}><option value="true">Primário</option><option value="false">Secundário</option></Select></Field></div><Button type="submit">Adicionar circuito</Button></form>}
      </Card>

      <Card>
        <div className={styles.sectionTitle}><h2>Failover</h2><span>{activeFailover ? "ativo" : `${failovers.data?.length ?? 0}`}</span></div>
        {failovers.loading && <Loading label="Carregando failovers…" />}
        {failovers.data?.length === 0 && <EmptyState title="Sem failovers" description="Nenhuma troca de circuito registrada." />}
        {failovers.data && failovers.data.length > 0 && <div className={styles.tableWrap}><table><thead><tr><th>Destino</th><th>Motivo</th><th>Situação</th><th>Início</th><th /></tr></thead><tbody>{failovers.data.map((item) => <tr key={item.id}><td>{item.toCircuit.code}<small>{item.fromCircuit ? `de ${item.fromCircuit.code}` : "origem automática"}</small></td><td>{item.reason}</td><td><Badge tone={item.status === "ACTIVE" ? "warning" : item.status === "RECOVERED" ? "success" : "neutral"}>{TRANSMISSION_FAILOVER_LABELS[item.status]}</Badge></td><td>{new Date(item.startedAt).toLocaleString("pt-BR")}</td><td>{canManage && item.status === "ACTIVE" && <div className={styles.rowActions}><Button onClick={() => void recoverFailover(item.id)}>Recuperar</Button><Button secondary onClick={() => void cancelFailover(item.id)}>Cancelar</Button></div>}</td></tr>)}</tbody></table></div>}
        {canManage && !activeFailover && <form className={styles.form} onSubmit={startFailover}><Field label="Circuito de destino (ativo)"><Select required value={failoverForm.toCircuitId} onChange={(event) => setFailoverForm((value) => ({ ...value, toCircuitId: event.target.value }))}><option value="">Selecione…</option>{failoverDestinations.map((circuit) => <option key={circuit.id} value={circuit.id}>{circuit.code} · {circuit.name}</option>)}</Select></Field><Field label="Motivo"><Input required value={failoverForm.reason} onChange={(event) => setFailoverForm((value) => ({ ...value, reason: event.target.value }))} /></Field><Button type="submit">Iniciar failover</Button></form>}
        {canManage && failoverDestinations.length === 0 && !activeFailover && <p className={styles.gateMessage}>Nenhum circuito ativo disponível para servir de destino.</p>}
      </Card>
    </div>

    <div className={styles.columns}>
      <Card><h2>Registrar conectividade</h2><form className={styles.form} onSubmit={saveConnectivity}><Field label="Estado"><Select value={connectivity.connectivity} onChange={(event) => setConnectivity((value) => ({ ...value, connectivity: event.target.value as ConnectivityStatus }))}>{CONNECTIVITY_STATUSES.map((status) => <option key={status} value={status}>{CONNECTIVITY_LABELS[status]}</option>)}</Select></Field><Field label="Latência (ms)"><Input min="0" type="number" value={connectivity.latencyMs} onChange={(event) => setConnectivity((value) => ({ ...value, latencyMs: event.target.value }))} /></Field><Field label="Método"><Input value={connectivity.connectionMethod} onChange={(event) => setConnectivity((value) => ({ ...value, connectionMethod: event.target.value }))} /></Field><Field label="Motivo da transição"><Input value={connectivity.reason} onChange={(event) => setConnectivity((value) => ({ ...value, reason: event.target.value }))} /></Field><Button type="submit">Registrar verificação</Button></form></Card>
      <Card><h2>Registrar tentativa</h2><form className={styles.form} onSubmit={registerAttempt}><Field label="Resultado"><Select value={attempt.result} onChange={(event) => setAttempt((value) => ({ ...value, result: event.target.value as AttemptResult }))}><option value="SUCCESS">Sucesso</option><option value="FAILED">Falha</option><option value="TIMEOUT">Timeout</option><option value="CANCELLED">Cancelada</option></Select></Field>{attempt.result !== "SUCCESS" && <Field label="Erro"><Input required value={attempt.error} onChange={(event) => setAttempt((value) => ({ ...value, error: event.target.value }))} /></Field>}<Button type="submit">Salvar tentativa</Button></form></Card>
    </div>

    <Card><div className={styles.sectionTitle}><h2>Histórico de estado</h2><span>{transitions.data?.length ?? 0}</span></div>{transitions.loading && <Loading label="Carregando transições…" />}{transitions.data?.length === 0 ? <EmptyState title="Sem transições" description="Nenhuma mudança de estado registrada." /> : <div className={styles.tableWrap}><table><thead><tr><th>Momento</th><th>De</th><th>Para</th><th>Escopo</th><th>Duração</th><th>Motivo</th></tr></thead><tbody>{transitions.data?.map((transition) => <tr key={transition.id}><td>{new Date(transition.occurredAt).toLocaleString("pt-BR")}</td><td><Badge tone={connectivityTone(transition.from)}>{CONNECTIVITY_LABELS[transition.from]}</Badge></td><td><Badge tone={connectivityTone(transition.to)}>{CONNECTIVITY_LABELS[transition.to]}</Badge></td><td>{transition.circuit ? `Circuito ${transition.circuit.code}` : "Ponto"}</td><td className={styles.mono}>{seconds(transition.durationSeconds)}</td><td>{transition.reason ?? "—"}</td></tr>)}</tbody></table></div>}</Card>

    <Card><h2>Alertas</h2>{data.alerts.length === 0 ? <EmptyState title="Sem alertas" description="Nenhum alerta registrado para este ponto." /> : <div className={styles.alerts}>{data.alerts.map((alert) => <article key={alert.id}><div className={styles.alertHead}><Badge tone={alert.status === "RESOLVED" ? "success" : alert.status === "ACKNOWLEDGED" ? "warning" : "danger"}>{alert.type.replaceAll("_", " ")}</Badge><span className={styles.alertState}>{alert.status === "OPEN" ? "Aberto" : alert.status === "ACKNOWLEDGED" ? "Reconhecido" : "Resolvido"}</span></div><p>{alert.message}</p>{alert.notes && <small>Nota: {alert.notes}</small>}<small>{new Date(alert.createdAt).toLocaleString("pt-BR")}{alert.acknowledgedAt ? ` · reconhecido ${new Date(alert.acknowledgedAt).toLocaleString("pt-BR")}` : ""}{alert.resolvedAt ? ` · resolvido ${new Date(alert.resolvedAt).toLocaleString("pt-BR")}` : ""}</small>{canManage && alert.status !== "RESOLVED" && <div className={styles.actions}>{alert.status === "OPEN" && <Button secondary onClick={() => void changeAlert(alert.id, "ACKNOWLEDGED")}>Reconhecer</Button>}<Button onClick={() => void changeAlert(alert.id, "RESOLVED")}>Resolver</Button></div>}</article>)}</div>}</Card>

    <CorrelationCard loading={correlation.loading} error={correlation.error} data={correlation.data} onRetry={correlation.reload} />

    <Card><h2>Histórico de conectividade</h2>{history.loading && <Loading label="Carregando histórico…" />}{history.data && (history.data.entries.length === 0 ? <EmptyState title="Sem registros" description="Nenhuma mudança de conectividade registrada." /> : <div className={styles.tableWrap}><table><thead><tr><th>Momento</th><th>Conectividade</th><th>Latência</th></tr></thead><tbody>{history.data.entries.slice().reverse().map((entry) => <tr key={entry.at}><td>{new Date(entry.at).toLocaleString("pt-BR")}</td><td><Badge tone={connectivityTone(entry.connectivity)}>{CONNECTIVITY_LABELS[entry.connectivity]}</Badge></td><td>{entry.latencyMs != null ? `${entry.latencyMs} ms` : "—"}</td></tr>)}</tbody></table></div>)}</Card>

    <Card><h2>Tentativas</h2>{data.attempts.length === 0 ? <p>Nenhuma tentativa registrada.</p> : <div className={styles.tableWrap}><table><thead><tr><th>#</th><th>Início</th><th>Fim</th><th>Duração</th><th>Resultado</th><th>Erro</th></tr></thead><tbody>{data.attempts.map((item) => <tr key={item.id}><td>{item.number}</td><td>{new Date(item.startedAt).toLocaleString("pt-BR")}</td><td>{new Date(item.endedAt).toLocaleString("pt-BR")}</td><td>{Math.round(item.durationMs / 1000)}s</td><td><Badge tone={item.result === "SUCCESS" ? "success" : "danger"}>{item.result}</Badge></td><td>{item.error || "—"}</td></tr>)}</tbody></table></div>}</Card>

    <Card><h2>Timeline</h2><ol className={styles.timeline}>{data.timeline.map((event) => <li key={event.id}><time>{new Date(event.createdAt).toLocaleString("pt-BR")}</time><div><strong>{event.type.replaceAll("_", " ")}</strong><p>{event.message}</p></div></li>)}</ol></Card>
  </section>;
}

/**
 * Correlação derivada (SPEC 3.6), somente leitura. Cada seção sem permissão vem
 * com `available: false` — o servidor não expõe contagem, então nada é exibido
 * além do aviso de acesso restrito.
 */
function CorrelationCard({ loading, error, data, onRetry }: { loading: boolean; error?: Error; data?: TransmissionCorrelation; onRetry: () => void }) {
  if (loading) return <Card><h2>Correlação</h2><Loading label="Correlacionando domínios…" /></Card>;
  if (error || !data) return <Card><h2>Correlação</h2><ErrorState error={error ?? new Error("Não foi possível carregar a correlação.")} onRetry={onRetry} /></Card>;
  const section = <T,>(title: string, section: CorrelationSection<T>, render: (item: T) => ReactNode) => <article><strong>{title}</strong>{section.available ? (section.items.length === 0 ? <small className={styles.muted}>Nada relacionado na janela.</small> : <>{section.items.map((item) => render(item))}<small className={styles.muted}>{section.total} no total</small></>) : <small className={styles.muted}>Acesso restrito — sem permissão de leitura.</small>}</article>;
  return <Card>
    <div className={styles.sectionTitle}><h2>Correlação</h2><span>{new Date(data.window.from).toLocaleDateString("pt-BR")} — {new Date(data.window.to).toLocaleDateString("pt-BR")}</span></div>
    <div className={styles.correlationGrid}>
      {section("Incidentes", data.incidents, (incident) => <a key={incident.id} href={incident.deepLink}><span>{incident.code} · {incident.title}</span><small>{incident.status} · {incident.severity}</small></a>)}
      {section("Solicitações de recurso", data.resourceRequests, (request) => <a key={request.id} href={request.deepLink}><span>{request.code} · {request.title}</span><small>{request.status} · {request.priority}</small></a>)}
      {section("Post-mortems", data.postmortems, (postmortem) => <a key={postmortem.id} href={postmortem.deepLink}><span>{postmortem.code} · {postmortem.title}</span><small>{postmortem.status}</small></a>)}
      {section("Passagens de turno", data.handovers, (handover) => <a key={handover.id} href={handover.deepLink}><span>{handover.shiftName}</span><small>{handover.status} · {new Date(handover.occurredAt).toLocaleString("pt-BR")}</small></a>)}
    </div>
    {data.attentionItems.available ? <LinkButton secondary to={data.attentionItems.route}>Abrir no Command Center</LinkButton> : <p className={styles.gateMessage}>Itens de atenção restritos — sem permissão do Command Center.</p>}
  </Card>;
}
