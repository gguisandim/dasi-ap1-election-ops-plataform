import type { PlatformPlugin } from '@eops/plugin-sdk';

interface Props {
  plugins: PlatformPlugin[];
}

const metrics = [
  ['Zonas monitoradas', '101'],
  ['Locais operacionais', '1.842'],
  ['Incidentes ativos', '12'],
  ['Transmissões concluídas', '93,4%']
];

export function HomeDashboard({ plugins }: Props) {
  return (
    <div className="dashboard">
      <section className="hero">
        <span className="eyebrow">AMBIENTE DE DEMONSTRAÇÃO</span>
        <h1>Visão operacional do pleito</h1>
        <p>Shell modular para monitoramento, logística, incidentes, inventário e análise.</p>
      </section>

      <section className="metric-grid">
        {metrics.map(([label, value]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel map-placeholder">
          <div>
            <span className="eyebrow">MAPA OPERACIONAL</span>
            <h2>Estado do Pará</h2>
            <p>Área reservada para MapLibre/Leaflet, zonas eleitorais e alertas georreferenciados.</p>
          </div>
          <div className="map-dot dot-a" />
          <div className="map-dot dot-b" />
          <div className="map-dot dot-c" />
        </article>

        <article className="panel">
          <span className="eyebrow">PLUGINS</span>
          <h2>{plugins.length} módulos carregados</h2>
          <div className="plugin-list">
            {plugins.slice(0, 5).map((plugin) => (
              <div className="plugin-list-item" key={plugin.manifest.id}>
                <span>{plugin.manifest.icon}</span>
                <div>
                  <strong>{plugin.manifest.name}</strong>
                  <small>{plugin.manifest.version}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
