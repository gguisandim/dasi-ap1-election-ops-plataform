import { useState, type FormEvent } from "react";
import { Button, ErrorState, Field, Input } from "@eops/ui";
import { useAuth } from "../AuthContext";
import styles from "../styles/access.module.css";

export function LoginPage() {
  const { login } = useAuth(); const [email, setEmail] = useState("admin@eops.local"); const [password, setPassword] = useState(""); const [error, setError] = useState<unknown>(); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(undefined); try { await login(email, password); } catch (cause) { setError(cause); setSaving(false); } }
  return <main className={styles.login}><form onSubmit={(event) => void submit(event)}><div className={styles.logo}>EO</div><h1>Election Ops</h1><p>Acesse o centro de operações.</p>{error !== undefined && <ErrorState error={error} />}<Field label="E-mail"><Input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></Field><Field label="Senha"><Input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field><Button disabled={saving} type="submit">{saving ? "Entrando…" : "Entrar"}</Button></form></main>;
}
