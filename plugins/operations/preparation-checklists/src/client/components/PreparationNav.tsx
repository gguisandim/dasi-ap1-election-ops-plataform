import { NavLink } from "react-router-dom";
import styles from "../styles/preparationChecklists.module.css";

export function PreparationNav() {
  return <nav className={styles.nav} aria-label="Checklist de Preparação">
    {[["/preparation-checklists", "Dashboard"], ["/preparation-checklists/list", "Checklists"], ["/preparation-checklists/overview", "Visão consolidada"], ["/preparation-checklists/new", "Novo checklist"], ["/preparation-checklists/templates", "Modelos"]].map(([to, label]) => <NavLink end key={to} to={to} className={({ isActive }) => isActive ? styles.active : ""}>{label}</NavLink>)}
  </nav>;
}