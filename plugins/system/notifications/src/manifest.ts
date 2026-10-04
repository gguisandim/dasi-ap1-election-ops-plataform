import type { PluginManifest } from "@eops/plugin-sdk";

export const manifest: PluginManifest = {
  id: "notifications",
  name: "Notificações",
  shortName: "Notificações",
  description: "Alertas internos e preferências.",
  category: "system",
  icon: "●",
  navigationIcon: "bell",
  version: "0.1.0",
  status: "beta",
  route: "/notifications",
};
