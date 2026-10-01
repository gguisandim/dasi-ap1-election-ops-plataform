import { apiClient } from "@eops/api-client";
import type { PlatformPlugin } from "@eops/plugin-sdk";
import type { AssetDashboard } from "@eops/shared/inventory";
import type { ElectionSummary, PollingPlaceSummary } from "@eops/shared/elections";
import type { IncidentDashboard } from "@eops/shared/incidents";
import type { Paginated } from "@eops/shared/common";
import { ErrorState, Loading, useAsync } from "@eops/ui";
import { Link } from "react-router-dom";

interface Props {
  plugins: PlatformPlugin[];
}

interface NotificationSummary {
  unread: number;
}

export function HomeDashboard({ plugins }: Props) {
  const canReadIncidents = plugins.some((plugin) => plugin.manifest.id === "incidents");
  const canReadInventory = plugins.some((plugin) => plugin.manifest.id === "inventory");
  const summary = useAsync(async () => {
    const [elections, places, incidents, inventory, notifications] =
      await Promise.all([
        apiClient.get<ElectionSummary[]>("/elections"),
        apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", {
          query: { pageSize: 1 },
        }),
        canReadIncidents
          ? apiClient.get<IncidentDashboard>("/incidents/dashboard")
          : Promise.resolve<IncidentDashboard>({ open: 0, critical: 0, inProgress: 0, resolvedToday: 0, slaOverdue: 0 }),
        canReadInventory
          ? apiClient.get<AssetDashboard>("/inventory/dashboard")
          : Promise.resolve<AssetDashboard>({ total: 0, unavailable: 0, maintenance: 0, inTransit: 0, allocated: 0 }),
        apiClient.get<NotificationSummary>("/notifications"),
      ]);
    const election = elections[0];
    return {
      election,
      zones: election?.zoneCount ?? 0,
      places: places.total,
      sections: election?.sectionCount ?? 0,
      incidents,
      inventory,
      unreadNotifications: notifications.unread,
    };
  }, [canReadIncidents, canReadInventory]);

  const metrics: Array<[string, number]> = summary.data
    ? [
        ["Zonas cadastradas", summary.data.zones],
        ["Locais operacionais", summary.data.places],
        ["Seções eleitorais", summary.data.sections],
        ...(canReadIncidents
          ? ([
              ["Incidentes ativos", summary.data.incidents.open],
              ["Incidentes críticos", summary.data.incidents.critical],
            ] as Array<[string, number]>)
          : []),
        ...(canReadInventory
          ? ([
              ["Ativos cadastrados", summary.data.inventory.total],
              ["Ativos indisponíveis", summary.data.inventory.unavailable],
            ] as Array<[string, number]>)
          : []),
        ["Notificações não lidas", summary.data.unreadNotifications],
      ]
    : [];

  return (
    <div className="dashboard">
      <section className="hero">
        <span className="eyebrow">AMBIENTE OPERACIONAL</span>
        <h1>{summary.data?.election?.name ?? "Election Ops Platform"}</h1>
        <p>
          Visão consolidada da estrutura eleitoral, incidentes, ativos e alertas
          operacionais persistidos no PostgreSQL.
        </p>
      </section>
      {summary.loading && <Loading label="Consultando indicadores…" />}
      {summary.error && (
        <ErrorState error={summary.error} onRetry={summary.reload} />
      )}
      {summary.data && (
        <section className="metric-grid">
          {metrics.map(([label, value]) => (
            <article className="metric-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>
      )}
      <section className="content-grid">
        <article className="panel map-placeholder">
          <div>
            <span className="eyebrow">MAPA OPERACIONAL</span>
            <h2>Visão geográfica dos locais</h2>
            <p>
              O estado do marcador considera incidentes ativos e condições dos
              equipamentos vinculados ao local.
            </p>
            <Link className="dashboard-link" to="/map">
              Abrir mapa
            </Link>
          </div>
          <div className="map-dot dot-a" />
          <div className="map-dot dot-b" />
          <div className="map-dot dot-c" />
        </article>
        <article className="panel">
          <span className="eyebrow">CENTRO OPERACIONAL</span>
          <h2>Acesso rápido</h2>
          <div className="plugin-list">
            {[
              ["incidents", "🚨", "Central de Incidentes", "SLA e timeline"],
              ["inventory", "▦", "Inventário e Ativos", "Alocação e movimentações"],
              ["notifications", "🔔", "Notificações", "Alertas da operação"],
              ["operational-simulator", "▶", "Simulador Operacional", "Cenários e replay"],
            ]
              .map(([id, icon, name, description]) => ({
                plugin: plugins.find((entry) => entry.manifest.id === id),
                icon,
                name,
                description,
              }))
              .filter((entry) => entry.plugin)
              .map(({ plugin, icon, name, description }) => (
                <Link
                  className="plugin-list-item"
                  to={plugin!.manifest.route}
                  key={plugin!.manifest.id}
                >
                  <span>{icon}</span>
                  <div>
                    <strong>{name}</strong>
                    <small>{description}</small>
                  </div>
                </Link>
              ))}
          </div>
          <small className="dashboard-module-count">
            {plugins.length} plugins carregados
          </small>
        </article>
      </section>
    </div>
  );
}
