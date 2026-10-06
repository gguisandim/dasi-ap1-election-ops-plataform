import { NavLink } from "react-router-dom";
import styles from "../styles/shift-handovers.module.css";

export function HandoverNav() {
  return (
    <nav className={styles.nav} aria-label="Passagens de turno">
      <NavLink end to="/shift-handovers" className={({ isActive }) => isActive ? styles.active : ""}>Visão geral</NavLink>
      <NavLink to="/shift-handovers/list" className={({ isActive }) => isActive ? styles.active : ""}>Todas</NavLink>
      <NavLink to="/shift-handovers/new" className={({ isActive }) => isActive ? styles.active : ""}>Nova passagem</NavLink>
    </nav>
  );
}
