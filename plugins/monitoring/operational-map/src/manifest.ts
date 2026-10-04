import type { PluginManifest } from "@eops/plugin-sdk";
export const manifest: PluginManifest = {
  id: "operational-map",
  name: "Mapa Operacional",
  shortName: "Mapa",
  description: "Visão geográfica dos locais de votação.",
  category: "monitoring",
  navigationIcon: "map",
  icon: "◉",
  version: "0.1.0",
  status: "beta",
  route: "/map",
  permissions: ["elections.read"],
};
