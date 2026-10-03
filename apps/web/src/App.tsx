import { useEffect, useMemo, useState } from "react";
import { CATEGORY_LABELS, type PluginCategory } from "@eops/plugin-sdk";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { LoginPage, useAuth } from "@eops/plugin-access-control";
import { Loading } from "@eops/ui";
import { NotificationBell } from "@eops/plugin-notifications";
import { plugins } from "./pluginRegistry";
import { HomeDashboard } from "./components/HomeDashboard";
import "./styles/global.css";

export default function App() {
  const location = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({ operations: true });
  const [navigationOpen, setNavigationOpen] = useState(false);
  const accessiblePlugins = useMemo(
    () =>
      plugins.filter((plugin) =>
        (plugin.manifest.permissions ?? []).every((permission) =>
          user?.permissions.includes(permission),
        ),
      ),
    [user],
  );
  const grouped = useMemo(() => {
    const result = new Map<PluginCategory, typeof plugins>();
    for (const plugin of accessiblePlugins)
      result.set(plugin.manifest.category, [
        ...(result.get(plugin.manifest.category) ?? []),
        plugin,
      ]);
    return result;
  }, [accessiblePlugins]);
  const activePlugin = accessiblePlugins.find(
    (plugin) =>
      location.pathname === plugin.manifest.route ||
      location.pathname.startsWith(`${plugin.manifest.route}/`),
  );
  const userInitials = user?.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    setNavigationOpen(false);
  }, [location.pathname]);

  if (authLoading) return <Loading label="Validando sessão…" />;
  if (location.pathname === "/login") {
    if (user)
      return (
        <Navigate
          to={(location.state as { from?: string } | null)?.from ?? "/"}
          replace
        />
      );
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    );
  }
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  return (
    <div className="app-shell">
      <button
        aria-label="Fechar menu de navegação"
        className={`sidebar-scrim ${navigationOpen ? "visible" : ""}`}
        onClick={() => setNavigationOpen(false)}
        type="button"
      />
      <aside
        aria-label="Navegação principal"
        className={`sidebar ${navigationOpen ? "sidebar-open" : ""}`}
        id="primary-navigation"
      >
        <Link className="brand" onClick={() => setNavigationOpen(false)} to="/">
          <div className="brand-mark">EO</div>
          <div>
            <strong>Election Ops</strong>
            <span>Centro operacional</span>
          </div>
        </Link>
        <NavLink
          className={({ isActive }) =>
            `home-button ${isActive ? "active" : ""}`
          }
          end
          onClick={() => setNavigationOpen(false)}
          to="/"
        >
          <span aria-hidden="true">◫</span> Visão geral
        </NavLink>
        <nav aria-label="Módulos da plataforma" className="plugin-nav">
          {[...grouped.entries()].map(([category, categoryPlugins]) => {
            const containsActiveRoute = activePlugin?.manifest.category === category;
            const expanded =
              containsActiveRoute || Boolean(expandedCategories[category]);
            const regionId = `category-${category}`;

            return (
              <section className="plugin-category" key={category}>
                <button
                  aria-controls={regionId}
                  aria-expanded={expanded}
                  className="category-title"
                  onClick={() =>
                    setExpandedCategories((state) => ({
                      ...state,
                      [category]: containsActiveRoute ? true : !expanded,
                    }))
                  }
                  type="button"
                >
                  <span>{CATEGORY_LABELS[category]}</span>
                  <span aria-hidden="true" className="category-chevron">
                    ⌄
                  </span>
                </button>
                {expanded && (
                  <div className="category-items" id={regionId}>
                    {categoryPlugins.map((plugin) => (
                      <NavLink
                        className={({ isActive }) => (isActive ? "active" : "")}
                        key={plugin.manifest.id}
                        onClick={() => setNavigationOpen(false)}
                        to={plugin.manifest.route}
                      >
                        <span aria-hidden="true" className="plugin-icon">
                          {plugin.manifest.icon}
                        </span>
                        <span>{plugin.manifest.shortName}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </nav>
        <footer className="sidebar-footer">
          <span className="sidebar-system-status">
            <span aria-hidden="true" className="status-dot" />
            Sistema ativo
          </span>
          <small>v0.2.0</small>
        </footer>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="topbar-context">
            <button
              aria-controls="primary-navigation"
              aria-expanded={navigationOpen}
              aria-label="Abrir menu de navegação"
              className="mobile-menu-toggle"
              onClick={() => setNavigationOpen((open) => !open)}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>
            <div>
              <strong>
                {activePlugin?.manifest.name ?? "Centro de Operações"}
              </strong>
              <span>
                {activePlugin?.manifest.description ??
                  "Gestão modular de operações eleitorais"}
              </span>
            </div>
          </div>
          <div className="topbar-actions">
            <NotificationBell />
            <div
              aria-label={`Sessão ativa: ${user.name}`}
              className="user-session"
            >
              <span aria-hidden="true" className="user-avatar">
                {userInitials || "U"}
              </span>
              <span className="user-name">{user.name}</span>
            </div>
            <button
              className="logout-button"
              onClick={() => void logout()}
              type="button"
            >
              Sair
            </button>
          </div>
        </header>
        <div className="workspace-content">
          <Routes>
            <Route
              path="/"
              element={<HomeDashboard plugins={accessiblePlugins} />}
            />
            {accessiblePlugins
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
