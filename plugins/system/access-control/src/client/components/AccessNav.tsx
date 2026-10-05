import { NavLink } from "react-router-dom";
import { useAuth } from "../AuthContext";
import styles from "../styles/access.module.css";

export function AccessNav() {
  const { hasPermission } = useAuth();
  const items: Array<[string, string, boolean]> = [["/users", "Usuários", true]];
  if (hasPermission("roles.read")) items.push(["/roles", "Perfis", true], ["/roles/matrix", "Matriz", false]);
  return <nav className={styles.nav} aria-label="Usuários e acessos">
    {items.map(([to, label, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? styles.active : ""}>{label}</NavLink>)}
  </nav>;
}
