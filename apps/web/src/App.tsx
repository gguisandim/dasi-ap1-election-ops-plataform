import { useMemo, useState } from 'react';
import { CATEGORY_LABELS, type PluginCategory } from '@eops/plugin-sdk';
import { plugins } from './pluginRegistry';
import { HomeDashboard } from './components/HomeDashboard';
import './styles/global.css';

export default function App() {
  const [activePluginId, setActivePluginId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const result = new Map<PluginCategory, typeof plugins>();
    for (const plugin of plugins) {
      const list = result.get(plugin.manifest.category) ?? [];
      list.push(plugin);
      result.set(plugin.manifest.category, list);
    }
    return result;
  }, []);

  const activePlugin = plugins.find((plugin) => plugin.manifest.id === activePluginId);
  const ActivePluginView = activePlugin?.View;

  function toggleCategory(category: PluginCategory) {
    setCollapsed((state) => ({ ...state, [category]: !state[category] }));
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand" onClick={() => setActivePluginId(null)}>
          <div className="brand-mark">EO</div>
          <div>
            <strong>Election Ops</strong>
            <span>Control Platform</span>
          </div>
        </div>

        <button className={`home-button ${activePluginId === null ? 'active' : ''}`} onClick={() => setActivePluginId(null)}>
          <span>◫</span> Visão geral
        </button>

        <nav className="plugin-nav">
          {[...grouped.entries()].map(([category, categoryPlugins]) => (
            <section className="plugin-category" key={category}>
              <button className="category-title" onClick={() => toggleCategory(category)}>
                <span>{CATEGORY_LABELS[category]}</span>
                <span>{collapsed[category] ? '+' : '−'}</span>
              </button>

              {!collapsed[category] && (
                <div className="category-items">
                  {categoryPlugins.map((plugin) => (
                    <button
                      className={activePluginId === plugin.manifest.id ? 'active' : ''}
                      key={plugin.manifest.id}
                      onClick={() => setActivePluginId(plugin.manifest.id)}
                    >
                      <span>{plugin.manifest.icon}</span>
                      <span>{plugin.manifest.shortName}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))}
        </nav>

        <footer className="sidebar-footer">
          <span>DEMO MODE</span>
          <small>v0.1.0</small>
        </footer>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <strong>{activePlugin?.manifest.name ?? 'Centro de Operações'}</strong>
            <span>{activePlugin?.manifest.description ?? 'Ambiente acadêmico de demonstração'}</span>
          </div>
          <div className="topbar-actions">
            <span className="status-dot" />
            <span>Sistema operacional</span>
          </div>
        </header>

        <div className="workspace-content">
          {ActivePluginView ? <ActivePluginView /> : <HomeDashboard plugins={plugins} />}
        </div>
      </main>
    </div>
  );
}
