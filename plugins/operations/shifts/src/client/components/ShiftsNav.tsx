import { NavLink } from "react-router-dom";
import styles from "../styles/shifts.module.css";

export function ShiftsNav() {
  return (
    <nav className={styles.nav} aria-label="Escalas e Turnos">
      {[
        ["/shifts", "Visão geral"],
        ["/shifts/list", "Lista"],
        ["/shifts/calendar", "Calendário"],
        ["/shifts/coverage", "Cobertura"],
        ["/shifts/templates", "Templates"],
        ["/shifts/new", "Novo turno"],
      ].map(([to, label]) => (
        <NavLink
          end
          key={to}
          to={to}
          className={({ isActive }) => (isActive ? styles.active : "")}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
