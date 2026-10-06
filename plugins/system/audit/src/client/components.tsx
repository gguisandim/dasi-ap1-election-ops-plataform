import { Badge } from "@eops/ui";
import styles from "./styles/audit.module.css";

const SEVERITY_TONES: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  CRITICAL: "danger",
  WARNING: "warning",
  NOTICE: "success",
  INFO: "neutral",
};

export function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <span className={styles.muted}>—</span>;
  return <Badge tone={SEVERITY_TONES[severity] ?? "neutral"}>{severity}</Badge>;
}

/** Declara categorias omitidas sem expor a contagem de linhas removidas. */
export function RestrictedNotice({ categories }: { categories: string[] }) {
  if (!categories.length) return null;
  return (
    <div className={styles.restricted} role="note">
      <strong>Acesso parcial ao resultado</strong>
      <p>Categorias omitidas porque o seu perfil não possui a permissão de leitura do domínio correspondente.</p>
      <ul>{categories.map((category) => <li key={category}><code>{category}</code></li>)}</ul>
    </div>
  );
}
