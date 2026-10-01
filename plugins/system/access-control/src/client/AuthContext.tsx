import { configureApiToken } from "@eops/api-client";
import type { CurrentUser } from "@eops/shared/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authService } from "./services/authService";

interface AuthValue { user: CurrentUser | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>; hasPermission: (permission: string) => boolean; }
const AuthContext = createContext<AuthValue | null>(null);
const TOKEN_KEY = "eops.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { const token = localStorage.getItem(TOKEN_KEY); if (!token) { setLoading(false); return; } configureApiToken(token); void authService.me().then(setUser).catch(() => { localStorage.removeItem(TOKEN_KEY); configureApiToken(); }).finally(() => setLoading(false)); }, []);
  async function login(email: string, password: string) { const result = await authService.login(email, password); localStorage.setItem(TOKEN_KEY, result.token); configureApiToken(result.token); setUser(result.user); }
  async function logout() { try { await authService.logout(); } finally { localStorage.removeItem(TOKEN_KEY); configureApiToken(); setUser(null); } }
  return <AuthContext.Provider value={{ user, loading, login, logout, hasPermission: (permission) => Boolean(user?.permissions.includes(permission)) }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth deve ser usado dentro de AuthProvider."); return value; }
