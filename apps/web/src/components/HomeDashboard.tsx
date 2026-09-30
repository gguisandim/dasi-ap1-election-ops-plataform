import { apiClient } from "@eops/api-client";
import type { PlatformPlugin } from "@eops/plugin-sdk";
import type {
  ElectionSummary,
  Paginated,
  PollingPlaceSummary,
} from "@eops/shared";
import { ErrorState, Loading, useAsync } from "@eops/ui";
import { Link } from "react-router-dom";

interface Props {
  plugins: PlatformPlugin[];
}

export function HomeDashboard({ plugins }: Props) {
  const summary = useAsync(async () => {
    const [elections, places] = await Promise.all([
      apiClient.get<ElectionSummary[]>("/elections"),
      apiClient.get<Paginated<PollingPlaceSummary>>("/polling-places", {
        query: { pageSize: 1 },
      }),
    ]);
    const election = elections[0];
    return {
      election,
      zones: election?.zoneCount ?? 0,
      places: places.total,
      sections: election?.sectionCount ?? 0,
    };
  }, []);
  return (
    <div className="dashboard">
      <section className="hero">
        <span className="eyebrow">AMBIENTE OPERACIONAL</span>
        <h1>{summary.data?.election?.name ?? "Election Ops Platform"}</h1>
        <p>
          Gestão persistente da estrutura eleitoral, do pleito ao local
          georreferenciado.
        </p>
      </section>
      {summary.loading && <Loading label="Consultando indicadores…" />}
      {summary.error && (
        <ErrorState error={summary.error} onRetry={summary.reload} />
      )}
      {summary.data && (
        <section className="metric-grid">
          {[
            ["Zonas cadastradas", summary.data.zones],
            ["Locais operacionais", summary.data.places],
            ["Seções eleitorais", summary.data.sections],
            ["Plugins carregados", plugins.length],
          ].map(([label, value]) => (
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
              Marcadores, filtros e estados operacionais alimentados pelo
              PostgreSQL.
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
          <span className="eyebrow">PLUGINS</span>
          <h2>{plugins.length} módulos carregados</h2>
          <div className="plugin-list">
            {plugins.slice(0, 6).map((plugin) => (
              <Link
                className="plugin-list-item"
                to={plugin.manifest.route}
                key={plugin.manifest.id}
              >
                <span>{plugin.manifest.icon}</span>
                <div>
                  <strong>{plugin.manifest.name}</strong>
                  <small>{plugin.manifest.version}</small>
                </div>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
