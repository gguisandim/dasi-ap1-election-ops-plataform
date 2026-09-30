import { useMemo, useState } from "react";
import { CATEGORY_LABELS, type PluginCategory } from "@eops/plugin-sdk";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { plugins } from "./pluginRegistry";
import { HomeDashboard } from "./components/HomeDashboard";
import "./styles/global.css";

export default function App() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const grouped = useMemo(() => {
    const result = new Map<PluginCategory, typeof plugins>();
    for (const plugin of plugins)
      result.set(plugin.manifest.category, [
        ...(result.get(plugin.manifest.category) ?? []),
        plugin,
      ]);
    return result;
  }, []);
  const activePlugin = plugins.find(
    (plugin) =>
      location.pathname === plugin.manifest.route ||
      location.pathname.startsWith(`${plugin.manifest.route}/`),
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <div className="brand-mark">EO</div>
          <div>
            <strong>Election Ops</strong>
            <span>Control Platform</span>
          </div>
        </Link>
        <NavLink
          className={({ isActive }) =>
            `home-button ${isActive ? "active" : ""}`
          }
          end
          to="/"
        >
          <span>◫</span> Visão geral
        </NavLink>
        <nav className="plugin-nav">
          {[...grouped.entries()].map(([category, categoryPlugins]) => (
            <section className="plugin-category" key={category}>
              <button
                className="category-title"
                onClick={() =>
                  setCollapsed((state) => ({
                    ...state,
                    [category]: !state[category],
                  }))
                }
              >
                <span>{CATEGORY_LABELS[category]}</span>
                <span>{collapsed[category] ? "+" : "−"}</span>
              </button>
              {!collapsed[category] && (
                <div className="category-items">
                  {categoryPlugins.map((plugin) => (
                    <NavLink
                      className={({ isActive }) => (isActive ? "active" : "")}
                      key={plugin.manifest.id}
                      to={plugin.manifest.route}
                    >
                      <span>{plugin.manifest.icon}</span>
                      <span>{plugin.manifest.shortName}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </section>
          ))}
        </nav>
        <footer className="sidebar-footer">
          <span>POSTGRESQL</span>
          <small>v0.2.0</small>
        </footer>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <strong>
              {activePlugin?.manifest.name ?? "Centro de Operações"}
            </strong>
            <span>
              {activePlugin?.manifest.description ??
                "Gestão modular de operações eleitorais"}
            </span>
          </div>
          <div className="topbar-actions">
            <span className="status-dot" />
            <span>API configurada</span>
          </div>
        </header>
        <div className="workspace-content">
          <Routes>
            <Route path="/" element={<HomeDashboard plugins={plugins} />} />
            {plugins
              .flatMap(
                (plugin) =>
                  plugin.routes ??
                  (plugin.View
                    ? [{ path: plugin.manifest.route, Component: plugin.View }]
                    : []),
              )
              .map(({ path, Component }) => (
                <Route key={path} path={path} element={<Component />} />
              ))}
            <Route
              path="*"
              element={
                <div className="not-found">
                  <h1>Página não encontrada</h1>
                  <Link to="/">Voltar ao início</Link>
                </div>
              }
            />
          </Routes>
        </div>
      </main>
    </div>
  );
}
