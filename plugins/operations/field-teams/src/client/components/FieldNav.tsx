import { NavLink } from "react-router-dom";
import styles from "../styles/fieldTeams.module.css";

export function FieldNav() {
  return <nav className={styles.nav}>{[["/field-teams", "Dashboard"], ["/field-teams/teams", "Equipes"], ["/field-teams/members", "Membros"], ["/field-teams/dispatch", "Despachos"], ["/field-teams/shifts", "Escalas"], ["/field-teams/allocations", "Alocações"], ["/field-teams/checks", "Check-in/out"]].map(([to, label]) => <NavLink end key={to} to={to} className={({ isActive }) => isActive ? styles.active : ""}>{label}</NavLink>)}</nav>;
}
