import type { PluginManifest } from "@eops/plugin-sdk";
export const manifest: PluginManifest = {
  id: "electoral-zones",
  name: "Zonas Eleitorais",
  shortName: "Zonas",
  description: "Hierarquia territorial vinculada aos pleitos.",
  category: "operations",
  navigationGroup: "electoral-structure",
  navigationIcon: "map",
  navigationOrder: 20,
  icon: "⌗",
  version: "0.1.0",
  status: "beta",
  route: "/electoral-zones",
  permissions: ["elections.read"],
};
