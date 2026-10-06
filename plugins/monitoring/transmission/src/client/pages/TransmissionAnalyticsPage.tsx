import { useState } from "react";
import { Badge, Card, EmptyState, ErrorState, LinkButton, Loading, Select, useAsync } from "@eops/ui";
import { Link } from "react-router-dom";
import { transmissionService } from "../../services/transmissionService";
import type { SlaQuery, TransmissionFilters } from "../../types";
import styles from "../../styles/overview.module.css";

const pct = (value: number | null) => (value === null ? "—" : `${value}%`);
const mins = (value: number) => `${value} min`;

/**
 * Panorama de SLA/analytics (SPEC 3.5): uptime global, por zona, por provedor
 * e pontos que mais contribuem para o downtime. Leitura derivada, sem escrita.
 */
export function TransmissionAnalyticsPage() {
  const [filters, setFilters] = useState<SlaQuery & TransmissionFilters>({});
  const analytics = useAsync(() => transmissionService.analytics(filters), [JSON.stringify(filters)]);
  const references = useAsync(transmissionService.references, []);
  const change = (key: keyof (SlaQuery & TransmissionFilters), value: string) => setFilters((current) => ({ ...current, [key]: value || undefined }));
  const zones = references.data?.zones.filter((zone) => !filters.electionId || zone.electionId === filters.electionId) ?? [];
  const places = references.data?.places.filter((place) => !filters.zoneId || place.electoralZoneId === filters.zoneId) ?? [];

  if (analytics.loading) return <Loading label="Calculando SLA e analytics…" />;
  if (analytics.error || !analytics.data) return <ErrorState error={analytics.error ?? new Error("Não foi possível carregar o analytics de transmissão.")} onRetry={analytics.reload} />;
  const data = analytics.data;

  return <section className={styles.page}>
    <header className={styles.header}><div><span className={styles.tag}>NOC · ANALYTICS</span><h1>SLA e desempenho de transmissão</h1><p>Uptime ponderado por tempo observado, downtime, MTTR, risco de prazo e desempenho por provedor.</p></div><div className={styles.actions}><LinkButton secondary to="/transmission/noc">Visão NOC</LinkButton><LinkButton secondary to="/transmission/providers">Provedores</LinkButton><LinkButton to="/transmission">Dashboard</LinkButton></div></header>

    <div className={styles.filters}>
      <Select aria-label="Pleito" value={filters.electionId ?? ""} onChange={(event) => change("electionId", event.target.value)}><option value="">Todos os pleitos</option>{references.data?.elections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Select aria-label="Zona" value={filters.zoneId ?? ""} onChange={(event) => change("zoneId", event.target.value)}><option value="">Todas as zonas</option>{zones.map((item) => <option key={item.id} value={item.id}>Zona {item.number} · {item.name}</option>)}</Select>
      <Select aria-label="Local" value={filters.pollingPlaceId ?? ""} onChange={(event) => change("pollingPlaceId", event.target.value)}><option value="">Todos os locais</option>{places.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
    </div>

    <p className={styles.muted}>Janela: {new Date(data.window.from).toLocaleString("pt-BR")} — {new Date(data.window.to).toLocaleString("pt-BR")} · {data.pointCount} ponto(s) · {data.observedPointCount} com leitura</p>

    <div className={styles.slaBand}>
      <div><span>Uptime</span><strong className={(data.uptimePercent ?? 100) < 99 ? styles.riskHigh : styles.riskOk}>{pct(data.uptimePercent)}</strong><small className={styles.muted}>UNKNOWN excluído do denominador</small></div>
      <div><span>Downtime</span><strong className={data.downtimeMinutes > 0 ? styles.riskHigh : undefined}>{mins(data.downtimeMinutes)}</strong><small className={styles.muted}>{mins(data.degradedMinutes)} degradado</small></div>
      <div><span>Sem leitura</span><strong className={styles.warnValue}>{mins(data.unknownMinutes)}</strong><small className={styles.muted}>{mins(data.observedMinutes)} observados</small></div>
      <div><span>MTTR</span><strong className={styles.infoValue}>{data.mttrSeconds === null ? "—" : `${data.mttrSeconds}s`}</strong><small className={styles.muted}>{data.recoverySeconds === null ? "sem recuperação medida" : `recuperação média ${data.recoverySeconds}s`}</small></div>
    </div>

    <Card>
      <div className={styles.sectionTitle}><h2>Por zona</h2><span>{data.byZone.length} zonas</span></div>
      {data.byZone.length === 0 ? <EmptyState title="Sem zonas" description="Nenhum ponto no filtro atual." /> : <div className={styles.tableWrap}><table><thead><tr><th>Zona</th><th>Pontos</th><th>Uptime</th><th>Downtime</th><th>Sem leitura</th><th>Risco de prazo</th></tr></thead><tbody>{data.byZone.map((zone) => <tr key={zone.zoneId}><td>Zona {zone.number}<small>{zone.name}</small></td><td>{zone.pointCount}</td><td className={styles.mono}>{pct(zone.uptimePercent)}</td><td className={styles.mono}>{mins(zone.downtimeMinutes)}</td><td className={styles.mono}>{mins(zone.unknownMinutes)}</td><td className={styles.mono}>{pct(zone.deadlineRiskPercent)}</td></tr>)}</tbody></table></div>}
    </Card>

    <Card>
      <div className={styles.sectionTitle}><h2>Por provedor</h2><span>{data.byProvider.length} provedores</span></div>
      {data.byProvider.length === 0 ? <EmptyState title="Sem provedores" description="Nenhum circuito com provedor associado no filtro atual." action={<LinkButton to="/transmission/providers">Cadastrar provedor</LinkButton>} /> : <div className={styles.tableWrap}><table><thead><tr><th>Provedor</th><th>Circuitos</th><th>Uptime</th><th>Alvo</th><th>SLA</th><th>Incidentes</th><th>Failovers</th></tr></thead><tbody>{data.byProvider.map((provider) => <tr key={provider.providerId}><td>{provider.name}<small>{provider.code}</small></td><td>{provider.circuitCount}</td><td className={styles.mono}>{pct(provider.uptimePercent)}</td><td className={styles.mono}>{provider.slaTargetUptimePercent === null ? "—" : `${provider.slaTargetUptimePercent}%`}</td><td>{provider.meetsTarget === null ? <Badge tone="neutral">sem alvo</Badge> : <Badge tone={provider.meetsTarget ? "success" : "danger"}>{provider.meetsTarget ? "cumpre" : "abaixo"}</Badge>}</td><td className={styles.mono}>{provider.incidentCount}</td><td className={styles.mono}>{provider.failoverCount}</td></tr>)}</tbody></table></div>}
    </Card>

    <Card>
      <div className={styles.sectionTitle}><h2>Maiores ofensores</h2><span>{data.topOffenders.length}</span></div>
      {data.topOffenders.length === 0 ? <EmptyState title="Sem downtime" description="Nenhum ponto com downtime na janela." /> : <div className={styles.tableWrap}><table><thead><tr><th>Ponto</th><th>Local</th><th>Zona</th><th>Downtime</th><th>Uptime</th></tr></thead><tbody>{data.topOffenders.map((point) => <tr key={point.pointId}><td><Link to={`/transmission/${point.pointId}`}>{point.identification}</Link></td><td>{point.pollingPlaceName}</td><td>Zona {point.zoneNumber}</td><td className={styles.mono}>{mins(point.offlineMinutes)}</td><td className={styles.mono}>{pct(point.uptimePercent)}</td></tr>)}</tbody></table></div>}
    </Card>
  </section>;
}
