import type { PluginManifest } from "@eops/plugin-sdk";

export const manifest: PluginManifest = {
  id: "command-center",
  name: "Central de Comando",
  shortName: "Comando",
  description:
    "Visão operacional agregada do pleito: saúde, atenção, zonas e situação corrente.",
  category: "monitoring",
  navigationIcon: "layout-dashboard",
  navigationOrder: 5,
  icon: "◎",
  version: "0.1.0",
  status: "beta",
  route: "/command-center",
  permissions: ["command-center.read"],
};
