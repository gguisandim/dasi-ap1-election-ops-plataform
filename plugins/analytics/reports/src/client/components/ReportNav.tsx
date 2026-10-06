import { NavLink } from "react-router-dom";
import styles from "../../styles/overview.module.css";

const items: Array<[string, string]> = [
  ["/reports", "Visão geral"],
  ["/reports/operations", "Operações"],
  ["/reports/incidents", "Incidentes"],
  ["/reports/transmission", "Transmissão"],
  ["/reports/workforce", "Equipes"],
  ["/reports/logistics", "Logística"],
  ["/reports/assets", "Ativos"],
  ["/reports/timeseries", "Séries"],
  ["/reports/sla", "SLA"],
  ["/reports/zones", "Zonas"],
  ["/reports/views", "Visões"],
  ["/reports/export", "Exportação"],
];

export function ReportNav() {
  return <nav className={styles.nav} aria-label="Relatórios por domínio">{items.map(([to, label]) => <NavLink end key={to} to={to} className={({ isActive }) => isActive ? styles.active : ""}>{label}</NavLink>)}</nav>;
}
