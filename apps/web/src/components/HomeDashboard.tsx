import { useState } from "react";
import { apiClient } from "@eops/api-client";
import type { PlatformPlugin } from "@eops/plugin-sdk";
import type {
  ElectionSummary,
  MonitoringStatus,
  PollingPlaceSummary,
} from "@eops/shared/elections";
import { STATUS_LABELS } from "@eops/shared/elections";
import type {
  IncidentDashboard,
  IncidentStatus,
  IncidentSummary,
} from "@eops/shared/incidents";
import {
  INCIDENT_SEVERITY_LABELS,
} from "@eops/shared/incidents";
import type { Paginated } from "@eops/shared/common";
import { EmptyState, ErrorState, Loading, useAsync } from "@eops/ui";
import { Link } from "react-router-dom";

interface Props {
  plugins: PlatformPlugin[];
}

interface OperationalNotification {
  id: string;
  type: "INFO" | "WARNING" | "CRITICAL" | "SUCCESS";
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationSummary {
  items: OperationalNotification[];
  unread: number;
}

interface FieldDashboardSummary {
  activeTeams: number;
  availablePeople: number;
  onDutyPeople: number;
  uncoveredZones: number;
  uncoveredPlaces: number;
}

interface SourceResult<T> {
  data: T | null;
  error: Error | null;
  enabled: boolean;
}

type Tone = "danger" | "warning" | "success" | "info" | "neutral";
type AttentionFilter = "all" | "critical" | "inProgress";

interface AttentionItem {
  id: string;
  title: string;
  context: string;
  timestamp: string;
  tag: string;
  tone: Tone;
  route: string;
  critical: boolean;
  inProgress: boolean;
}

interface TimelineItem {
  id: string;
  title: string;
  context: string;
  timestamp: string;
  tone: Tone;
  route: string;
}

async function loadSource<T>(
  enabled: boolean,
  loader: () => Promise<T>,
): Promise<SourceResult<T>> {
  if (!enabled) return { data: null, error: null, enabled: false };

  try {
    return { data: await loader(), error: null, enabled: true };
  } catch (reason) {
    return {
      data: null,
      error:
        reason instanceof Error
          ? reason
          : new Error("Não foi possível consultar esta fonte."),
      enabled: true,
    };
  }
}

function selectCurrentElection(elections: ElectionSummary[]) {
  return (
    elections.find((election) => election.status === "IN_PROGRESS") ??
    elections.find((election) => election.status === "PREPARATION") ??
    elections[0]
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horário indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function incidentTone(incident: IncidentSummary): Tone {
  if (incident.severity === "CRITICAL") return "danger";
  if (incident.severity === "HIGH" || incident.slaOverdue) return "warning";
  return "info";
}

function notificationTone(notification: OperationalNotification): Tone {
  if (notification.type === "CRITICAL") return "danger";
  if (notification.type === "WARNING") return "warning";
  if (notification.type === "SUCCESS") return "success";
  return "info";
}

function monitoringTone(status: MonitoringStatus): Tone {
  if (status === "CRITICAL" || status === "OFFLINE") return "danger";
  if (status === "ATTENTION") return "warning";
  return "success";
}

function mapPoints(places: PollingPlaceSummary[]) {
  const located = places.filter(
    (
      place,
    ): place is PollingPlaceSummary & { latitude: number; longitude: number } =>
      typeof place.latitude === "number" &&
      typeof place.longitude === "number",
  );
  if (!located.length) return [];

  const latitudes = located.map((place) => place.latitude);
  const longitudes = located.map((place) => place.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = maxLatitude - minLatitude;
  const longitudeRange = maxLongitude - minLongitude;

  return located.map((place) => ({
    place,
    x:
      longitudeRange === 0
        ? 50
        : 8 + ((place.longitude - minLongitude) / longitudeRange) * 84,
    y:
      latitudeRange === 0
        ? 50
        : 8 + (1 - (place.latitude - minLatitude) / latitudeRange) * 84,
  }));
}

export function HomeDashboard({ plugins }: Props) {
  const [attentionFilter, setAttentionFilter] =
    useState<AttentionFilter>("all");
  const incidentPlugin = plugins.find(
    (plugin) => plugin.manifest.id === "incidents",
  );
  const placesPlugin = plugins.find(
    (plugin) => plugin.manifest.id === "polling-places",
  );
  const mapPlugin = plugins.find(
    (plugin) => plugin.manifest.id === "operational-map",
  );
  const fieldTeamsPlugin = plugins.find(
    (plugin) => plugin.manifest.id === "field-teams",
  );
  const notificationsPlugin = plugins.find(
    (plugin) => plugin.manifest.id === "notifications",
  );

  const summary = useAsync(async () => {
    const elections = await loadSource(true, () =>
      apiClient.get<ElectionSummary[]>("/elections"),
    );
    const election = elections.data
      ? selectCurrentElection(elections.data)
      : undefined;
    const electionQuery = election ? { electionId: election.id } : {};

    const [places, mappedPlaces, incidentDashboard, incidents, fieldTeams, notifications] =
      await Promise.all([
        loadSource(Boolean(placesPlugin || mapPlugin), () =>
          apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", {
            query: { ...electionQuery, pageSize: 1 },
          }),
        ),
        loadSource(Boolean(mapPlugin), () =>
          apiClient.get<PollingPlaceSummary[]>("/polling-places/map", {
            query: electionQuery,
          }),
        ),
        loadSource(Boolean(incidentPlugin), () =>
          apiClient.get<IncidentDashboard>("/incidents/dashboard"),
        ),
        loadSource(Boolean(incidentPlugin), () =>
          apiClient.get<Paginated<IncidentSummary>>("/incidents", {
            query: { ...electionQuery, pageSize: 20 },
          }),
        ),
        loadSource(Boolean(fieldTeamsPlugin), () =>
          apiClient.get<FieldDashboardSummary>("/field-teams/dashboard", {
            query: electionQuery,
          }),
        ),
        loadSource(Boolean(notificationsPlugin), () =>
          apiClient.get<NotificationSummary>("/notifications"),
        ),
      ]);

    return {
      elections,
      election,
      places,
      mappedPlaces,
      incidentDashboard,
      incidents,
      fieldTeams,
      notifications,
    };
  }, [
    Boolean(placesPlugin),
    Boolean(mapPlugin),
    Boolean(incidentPlugin),
    Boolean(fieldTeamsPlugin),
    Boolean(notificationsPlugin),
  ]);

  if (summary.loading && !summary.data)
    return <Loading label="Consultando situação operacional…" />;
  if (summary.error)
    return <ErrorState error={summary.error} onRetry={summary.reload} />;
  if (!summary.data) return null;

  const data = summary.data;
  const election = data.election;
  const activeRound =
    election?.rounds.find((round) => round.status === "IN_PROGRESS") ??
    election?.rounds.find((round) => round.status === "SCHEDULED");
  const places = data.mappedPlaces.data ?? [];
  const points = mapPoints(places);
  const incidents = data.incidents.data?.items ?? [];
  const notifications = data.notifications.data?.items ?? [];
  const activeIncidentStatuses: IncidentStatus[] = [
    "NEW",
    "TRIAGED",
    "ASSIGNED",
    "IN_PROGRESS",
  ];

  const metrics: Array<{
    label: string;
    value: number | null;
    detail: string;
    tone: Tone;
  }> = [];

  if (incidentPlugin) {
    metrics.push(
      {
        label: "Ocorrências críticas",
        value: data.incidentDashboard.data?.critical ?? null,
        detail: data.incidentDashboard.error
          ? "Fonte indisponível"
          : "Severidade crítica",
        tone: "danger",
      },
      {
        label: "Ocorrências ativas",
        value: data.incidentDashboard.data?.open ?? null,
        detail: data.incidentDashboard.error
          ? "Fonte indisponível"
          : "Aguardando conclusão",
        tone: "warning",
      },
    );
  }
  if (placesPlugin || mapPlugin) {
    metrics.push({
      label: "Locais cadastrados",
      value: data.places.data?.total ?? null,
      detail: data.places.error
        ? "Fonte indisponível"
        : "No pleito selecionado",
      tone: "info",
    });
  }
  if (fieldTeamsPlugin) {
    metrics.push({
      label: "Equipes ativas",
      value: data.fieldTeams.data?.activeTeams ?? null,
      detail: data.fieldTeams.error
        ? "Fonte indisponível"
        : `${data.fieldTeams.data?.onDutyPeople ?? 0} pessoas em serviço`,
      tone: "success",
    });
  }
  if (metrics.length < 4 && election) {
    metrics.push({
      label: "Zonas cadastradas",
      value: election.zoneCount,
      detail: "Estrutura eleitoral",
      tone: "neutral",
    });
  }
  if (metrics.length < 4 && notificationsPlugin) {
    metrics.push({
      label: "Notificações não lidas",
      value: data.notifications.data?.unread ?? null,
      detail: data.notifications.error
        ? "Fonte indisponível"
        : "Alertas pendentes",
      tone: "info",
    });
  }

  const attentionItems: AttentionItem[] = [
    ...incidents
      .filter((incident) => activeIncidentStatuses.includes(incident.status))
      .map((incident) => ({
        id: `incident-${incident.id}`,
        title: incident.title,
        context:
          incident.pollingPlace?.name ??
          incident.electoralZone?.name ??
          incident.category.name,
        timestamp: incident.openedAt,
        tag: INCIDENT_SEVERITY_LABELS[incident.severity],
        tone: incidentTone(incident),
        route: `${incidentPlugin?.manifest.route ?? "/incidents"}/${incident.id}`,
        critical: incident.severity === "CRITICAL",
        inProgress: ["TRIAGED", "ASSIGNED", "IN_PROGRESS"].includes(
          incident.status,
        ),
      })),
    ...notifications
      .filter(
        (notification) =>
          notification.readAt === null && notification.type !== "SUCCESS",
      )
      .map((notification) => ({
        id: `notification-${notification.id}`,
        title: notification.title,
        context: notification.message,
        timestamp: notification.createdAt,
        tag:
          notification.type === "CRITICAL"
            ? "Crítica"
            : notification.type === "WARNING"
              ? "Atenção"
              : "Info",
        tone: notificationTone(notification),
        route: notificationsPlugin?.manifest.route ?? "/notifications",
        critical: notification.type === "CRITICAL",
        inProgress: false,
      })),
  ].sort((left, right) => {
    if (left.critical !== right.critical) return left.critical ? -1 : 1;
    return (
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
    );
  });

  const filteredAttention = attentionItems
    .filter((item) => {
      if (attentionFilter === "critical") return item.critical;
      if (attentionFilter === "inProgress") return item.inProgress;
      return true;
    })
    .slice(0, 6);

  const timeline: TimelineItem[] = incidents
    .flatMap((incident) => {
      const events: TimelineItem[] = [
        {
          id: `${incident.id}-opened`,
          title: "Ocorrência registrada",
          context: `${incident.code} · ${incident.title}`,
          timestamp: incident.openedAt,
          tone: incidentTone(incident),
          route: `${incidentPlugin?.manifest.route ?? "/incidents"}/${incident.id}`,
        },
      ];
      if (incident.resolvedAt) {
        events.push({
          id: `${incident.id}-resolved`,
          title: "Ocorrência resolvida",
          context: `${incident.code} · ${incident.title}`,
          timestamp: incident.resolvedAt,
          tone: "success",
          route: `${incidentPlugin?.manifest.route ?? "/incidents"}/${incident.id}`,
        });
      }
      return events;
    })
    .sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    )
    .slice(0, 5);

  const statusCounts = places.reduce<Record<MonitoringStatus, number>>(
    (counts, place) => ({
      ...counts,
      [place.monitoringStatus]: counts[place.monitoringStatus] + 1,
    }),
    { NORMAL: 0, ATTENTION: 0, CRITICAL: 0, OFFLINE: 0 },
  );
  const statusRows: Array<{
    label: string;
    value: number;
    tone: Tone;
    detail: string;
  }> = [];
  if (data.mappedPlaces.data) {
    statusRows.push(
      {
        label: "Locais normais",
        value: statusCounts.NORMAL,
        tone: "success",
        detail: "Georreferenciados",
      },
      {
        label: "Locais em atenção",
        value: statusCounts.ATTENTION,
        tone: "warning",
        detail: "Monitoramento",
      },
      {
        label: "Locais críticos ou offline",
        value: statusCounts.CRITICAL + statusCounts.OFFLINE,
        tone: "danger",
        detail: "Exigem verificação",
      },
    );
  }
  if (data.incidentDashboard.data) {
    statusRows.push({
      label: "Em atendimento",
      value: data.incidentDashboard.data.inProgress,
      tone: "info",
      detail: "Ocorrências",
    });
  }
  if (data.fieldTeams.data) {
    statusRows.push({
      label: "Pessoas em serviço",
      value: data.fieldTeams.data.onDutyPeople,
      tone: "success",
      detail: `${data.fieldTeams.data.availablePeople} disponíveis`,
    });
  }

  const failedSources = [
    ["pleito", data.elections.error],
    ["locais", data.places.error || data.mappedPlaces.error],
    ["ocorrências", data.incidentDashboard.error || data.incidents.error],
    ["equipes", data.fieldTeams.error],
    ["notificações", data.notifications.error],
  ]
    .filter((entry): entry is [string, Error] => entry[1] instanceof Error)
    .map(([label]) => label);

  return (
    <div className="dashboard">
      <section className="dashboard-heading">
        <div>
          <div className="dashboard-heading-meta">
            <span className="eyebrow">VISÃO OPERACIONAL</span>
            {election && (
              <span className={`election-status status-${election.status.toLowerCase()}`}>
                <span aria-hidden="true" />
                {STATUS_LABELS[election.status]}
              </span>
            )}
          </div>
          <h1>{election?.name ?? "Eleições 2026"}</h1>
          <p>
            Acompanhe a operação e identifique rapidamente os pontos que exigem
            atenção.
          </p>
        </div>
        {election && (
          <div className="election-context" aria-label="Contexto do pleito">
            <span>{election.year}</span>
            {activeRound && <strong>{activeRound.roundNumber}º turno</strong>}
          </div>
        )}
      </section>

      {failedSources.length > 0 && (
        <div className="partial-data-warning" role="status">
          <span>
            Dados temporariamente indisponíveis: {failedSources.join(", ")}.
          </span>
          <button onClick={summary.reload} type="button">
            Tentar novamente
          </button>
        </div>
      )}

      <section aria-label="Indicadores principais" className="metric-grid">
        {metrics.slice(0, 4).map((metric) => (
          <article className={`metric-card tone-${metric.tone}`} key={metric.label}>
            <div className="metric-label">
              <span aria-hidden="true" className="metric-indicator" />
              <span>{metric.label}</span>
            </div>
            <strong>{metric.value ?? "—"}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      <section className="primary-dashboard-grid">
        <article className="panel operational-map-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MAPA OPERACIONAL</span>
              <h2>Distribuição dos locais</h2>
            </div>
            {data.mappedPlaces.data && (
              <span className="panel-count">
                {places.length} georreferenciados
              </span>
            )}
          </div>

          {data.mappedPlaces.error ? (
            <ErrorState
              error={data.mappedPlaces.error}
              onRetry={summary.reload}
            />
          ) : points.length ? (
            <div
              aria-label={`${points.length} locais georreferenciados exibidos por coordenadas reais`}
              className="operational-map-visual"
              role="img"
            >
              <div aria-hidden="true" className="map-grid-lines" />
              {points.map(({ place, x, y }) => (
                <span
                  aria-label={`${place.name}: ${STATUS_LABELS[place.monitoringStatus]}`}
                  className={`map-marker tone-${monitoringTone(place.monitoringStatus)}`}
                  key={place.id}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={`${place.name} · ${STATUS_LABELS[place.monitoringStatus]}`}
                />
              ))}
              <span aria-hidden="true" className="map-coordinate-label map-north">
                N
              </span>
              <span aria-hidden="true" className="map-coordinate-label map-south">
                S
              </span>
            </div>
          ) : (
            <EmptyState
              title={mapPlugin ? "Sem locais georreferenciados" : "Mapa indisponível"}
              description={
                mapPlugin
                  ? "Cadastre coordenadas nos locais para exibir a distribuição operacional."
                  : "Seu acesso atual não inclui o mapa operacional."
              }
            />
          )}

          <div className="map-panel-footer">
            <div aria-label="Legenda do mapa" className="map-legend">
              {(["NORMAL", "ATTENTION", "CRITICAL", "OFFLINE"] as const).map(
                (status) => (
                  <span key={status}>
                    <i className={`tone-${monitoringTone(status)}`} />
                    {STATUS_LABELS[status]}
                  </span>
                ),
              )}
            </div>
            {mapPlugin && (
              <Link className="dashboard-link" to={mapPlugin.manifest.route}>
                Abrir mapa completo <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </article>

        <article className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">PRIORIDADES</span>
              <h2>Atenção agora</h2>
            </div>
            <span className="panel-count">{attentionItems.length} sinais</span>
          </div>

          {attentionItems.length > 0 && (
            <div aria-label="Filtrar prioridades" className="attention-filters">
              {(
                [
                  ["all", "Todas"],
                  ["critical", "Críticas"],
                  ["inProgress", "Em tratamento"],
                ] as Array<[AttentionFilter, string]>
              ).map(([filter, label]) => (
                <button
                  aria-pressed={attentionFilter === filter}
                  className={attentionFilter === filter ? "active" : ""}
                  key={filter}
                  onClick={() => setAttentionFilter(filter)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {data.incidents.error && data.notifications.error ? (
            <ErrorState
              error={data.incidents.error}
              onRetry={summary.reload}
            />
          ) : filteredAttention.length ? (
            <div className="attention-list">
              {filteredAttention.map((item) => (
                <Link className="attention-item" key={item.id} to={item.route}>
                  <time dateTime={item.timestamp}>{formatTime(item.timestamp)}</time>
                  <span className={`attention-marker tone-${item.tone}`} />
                  <span className="attention-copy">
                    <strong>{item.title}</strong>
                    <small>{item.context}</small>
                  </span>
                  <span className={`status-tag tone-${item.tone}`}>
                    {item.tag}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nenhum item neste filtro"
              description="Não há ocorrências ou alertas pendentes para esta seleção."
            />
          )}

          <div className="panel-actions">
            {incidentPlugin && (
              <Link className="dashboard-link" to={incidentPlugin.manifest.route}>
                Ver ocorrências <span aria-hidden="true">→</span>
              </Link>
            )}
            {notificationsPlugin && (
              <Link
                className="dashboard-link subtle"
                to={notificationsPlugin.manifest.route}
              >
                Notificações
              </Link>
            )}
          </div>
        </article>
      </section>

      <section className="secondary-dashboard-grid">
        <article className="panel timeline-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">EVENTOS</span>
              <h2>Linha do tempo operacional</h2>
            </div>
          </div>
          {data.incidents.error ? (
            <ErrorState error={data.incidents.error} onRetry={summary.reload} />
          ) : timeline.length ? (
            <ol className="operational-timeline">
              {timeline.map((item) => (
                <li key={item.id}>
                  <span className={`timeline-dot tone-${item.tone}`} />
                  <Link to={item.route}>
                    <strong>{item.title}</strong>
                    <span>{item.context}</span>
                  </Link>
                  <time dateTime={item.timestamp}>
                    {formatDateTime(item.timestamp)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="Sem eventos recentes"
              description="Novas ocorrências e resoluções aparecerão aqui."
            />
          )}
        </article>

        <article className="panel operation-status-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">SÍNTESE</span>
              <h2>Status da operação</h2>
            </div>
          </div>
          {statusRows.length ? (
            <div className="operation-status-list">
              {statusRows.map((row) => (
                <div className="operation-status-row" key={row.label}>
                  <span className={`status-symbol tone-${row.tone}`} />
                  <span>
                    <strong>{row.label}</strong>
                    <small>{row.detail}</small>
                  </span>
                  <b>{row.value}</b>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Status indisponível"
              description="Não há fontes operacionais acessíveis para compor este resumo."
            />
          )}
          {placesPlugin && (
            <Link className="dashboard-link" to={placesPlugin.manifest.route}>
              Ver locais <span aria-hidden="true">→</span>
            </Link>
          )}
        </article>
      </section>
    </div>
  );
}
