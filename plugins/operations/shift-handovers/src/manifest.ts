import type { PluginManifest } from "@eops/plugin-sdk";

export const manifest: PluginManifest = {
  id: "shift-handovers",
  name: "Passagem de Turno",
  shortName: "Passagens",
  description: "Continuidade operacional entre equipes e turnos.",
  category: "operations",
  navigationGroup: "planning",
  navigationIcon: "scroll-text",
  navigationOrder: 35,
  icon: "⇄",
  version: "0.1.0",
  status: "beta",
  route: "/shift-handovers",
  permissions: ["shift-handovers.read"],
};
