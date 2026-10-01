import { NavLink } from "react-router-dom";
import styles from "../styles/tasks.module.css";

export function TasksNav() {
  return <nav className={styles.nav} aria-label="Central de Tarefas">
    {[["/tasks", "Visão geral"], ["/tasks/kanban", "Kanban"], ["/tasks/list", "Lista"], ["/tasks/new", "Nova tarefa"]].map(([to, label]) => <NavLink end key={to} to={to} className={({ isActive }) => isActive ? styles.active : ""}>{label}</NavLink>)}
  </nav>;
}