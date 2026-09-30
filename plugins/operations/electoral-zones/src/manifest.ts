import type { PluginManifest } from "@eops/plugin-sdk";
export const manifest: PluginManifest = {
  id: "electoral-zones",
  name: "Zonas Eleitorais",
  shortName: "Zonas",
  description: "Hierarquia territorial vinculada aos pleitos.",
  category: "operations",
  icon: "⌗",
  version: "0.1.0",
  status: "beta",
  route: "/electoral-zones",
};
