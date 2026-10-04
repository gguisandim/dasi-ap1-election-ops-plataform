import type { PluginManifest } from "@eops/plugin-sdk";

export const manifest: PluginManifest = {
  id: "access-control",
  name: "Usuários e Acessos",
  shortName: "Usuários",
  description: "Autenticação, usuários, perfis e permissões.",
  category: "system",
  navigationIcon: "shield-check",
  icon: "◎",
  version: "0.1.0",
  status: "beta",
  route: "/users",
  permissions: ["users.read"],
};
