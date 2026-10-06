import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORY_LABELS,
  NAVIGATION_GROUP_LABELS,
  NAVIGATION_GROUP_ORDER,
  type PlatformPlugin,
  type PluginCategory,
  type PluginNavigationIcon,
} from "@eops/plugin-sdk";
import {
  Archive,
  Bell,
  BookOpen,
  Boxes,
  CalendarClock,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  Landmark,
  LayoutDashboard,
  ListTodo,
  Map as MapIcon,
  MapPin,
  PackagePlus,
  Menu,
  MessageSquare,
  RadioTower,
  Route as RouteIcon,
  ScrollText,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  TriangleAlert,
  Users,
  Vote,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { LoginPage, useAuth } from "@eops/plugin-access-control";
import { Loading } from "@eops/ui";
import { NotificationBell } from "@eops/plugin-notifications";
import { plugins } from "./pluginRegistry";
import { HomeDashboard } from "./components/HomeDashboard";
import "./styles/global.css";

const navigationIcons: Record<PluginNavigationIcon, LucideIcon> = {
  archive: Archive,
  bell: Bell,
  "book-open": BookOpen,
  boxes: Boxes,
  "calendar-clock": CalendarClock,
  chart: ChartNoAxesCombined,
  "clipboard-check": ClipboardCheck,
  "file-check": FileCheck2,
  "file-search": FileSearch,
  landmark: Landmark,
  "list-todo": ListTodo,
  map: MapIcon,
  "map-pin": MapPin,
  "layout-dashboard": LayoutDashboard,
  "package-plus": PackagePlus,
  "message-square": MessageSquare,
  "radio-tower": RadioTower,
  route: RouteIcon,
  "scroll-text": ScrollText,
  "shield-check": ShieldCheck,
  siren: Siren,
  sliders: SlidersHorizontal,
  "triangle-alert": TriangleAlert,
  users: Users,
  vote: Vote,
};

function PluginIcon({ plugin }: { plugin: PlatformPlugin }) {
  const Icon = plugin.manifest.navigationIcon
    ? navigationIcons[plugin.manifest.navigationIcon]
    : null;

  if (Icon) return <Icon aria-hidden="true" size={17} strokeWidth={1.8} />;
  return <span aria-hidden="true">{plugin.manifest.icon}</span>;
}

export default function App() {
  const location = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({ operations: true });
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);
  const logoutButtonRef = useRef<HTMLButtonElement>(null);
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
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        userMenuButtonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    logoutButtonRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [userMenuOpen]);

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

  const renderPluginLink = (plugin: PlatformPlugin) => (
    <NavLink
      className={({ isActive }) => (isActive ? "active" : "")}
      key={plugin.manifest.id}
      onClick={() => setNavigationOpen(false)}
      to={plugin.manifest.route}
    >
      <span className="plugin-icon">
        <PluginIcon plugin={plugin} />
      </span>
      <span>{plugin.manifest.shortName}</span>
    </NavLink>
  );

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
          <LayoutDashboard aria-hidden="true" size={17} strokeWidth={1.8} />
          Visão geral
        </NavLink>
        <nav aria-label="Módulos da plataforma" className="plugin-nav">
          {[...grouped.entries()].map(([category, categoryPlugins]) => {
            const containsActiveRoute = activePlugin?.manifest.category === category;
            const expanded =
              containsActiveRoute || Boolean(expandedCategories[category]);
            const regionId = `category-${category}`;
            const sortedPlugins = [...categoryPlugins].sort(
              (left, right) =>
                (left.manifest.navigationOrder ?? 100) -
                (right.manifest.navigationOrder ?? 100),
            );
            const groupedPluginIds = new Set(
              category === "operations"
                ? sortedPlugins
                    .filter((plugin) => plugin.manifest.navigationGroup)
                    .map((plugin) => plugin.manifest.id)
                : [],
            );
            const ungroupedPlugins = sortedPlugins.filter(
              (plugin) => !groupedPluginIds.has(plugin.manifest.id),
            );

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
                  <ChevronDown
                    aria-hidden="true"
                    className="category-chevron"
                    size={15}
                  />
                </button>
                {expanded && (
                  <div className="category-items" id={regionId}>
                    {category === "operations" &&
                      NAVIGATION_GROUP_ORDER.map((navigationGroup) => {
                        const groupPlugins = sortedPlugins.filter(
                          (plugin) =>
                            plugin.manifest.navigationGroup === navigationGroup,
                        );
                        if (!groupPlugins.length) return null;
                        return (
                          <div className="navigation-subgroup" key={navigationGroup}>
                            <span className="navigation-subgroup-label">
                              {NAVIGATION_GROUP_LABELS[navigationGroup]}
                            </span>
                            {groupPlugins.map(renderPluginLink)}
                          </div>
                        );
                      })}
                    {ungroupedPlugins.map(renderPluginLink)}
                  </div>
                )}
              </section>
            );
          })}
        </nav>
        <footer className="sidebar-footer">
          <span>Election Ops</span>
          <small>v0.2.0 · Desenvolvimento</small>
        </footer>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="topbar-context">
            <button
              aria-controls="primary-navigation"
              aria-expanded={navigationOpen}
              aria-label={
                navigationOpen
                  ? "Fechar menu de navegação"
                  : "Abrir menu de navegação"
              }
              className="mobile-menu-toggle"
              onClick={() => setNavigationOpen((open) => !open)}
              type="button"
            >
              {navigationOpen ? (
                <X aria-hidden="true" size={19} />
              ) : (
                <Menu aria-hidden="true" size={19} />
              )}
            </button>
            <div>
              <strong>{activePlugin?.manifest.name ?? "Visão geral"}</strong>
              <span>
                {activePlugin?.manifest.description ??
                  "Situação operacional e prioridades"}
              </span>
            </div>
          </div>
          <div className="topbar-actions">
            <NotificationBell />
            <div className="user-menu" ref={userMenuRef}>
              <button
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={`Abrir menu de ${user.name}`}
                className="user-menu-trigger"
                onClick={() => setUserMenuOpen((open) => !open)}
                ref={userMenuButtonRef}
                type="button"
              >
                <span aria-hidden="true" className="user-avatar">
                  {userInitials || "U"}
                </span>
                <span className="user-name">{user.name}</span>
                <ChevronDown aria-hidden="true" size={14} />
              </button>
              {userMenuOpen && (
                <div aria-label="Menu do usuário" className="user-menu-popover" role="menu">
                  <div className="user-menu-identity">
                    <strong>{user.name}</strong>
                    <span>Sessão autenticada</span>
                  </div>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      void logout();
                    }}
                    ref={logoutButtonRef}
                    role="menuitem"
                    type="button"
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
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
