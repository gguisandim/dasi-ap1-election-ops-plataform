import type { PluginManifest } from "@eops/plugin-sdk";

export const manifest: PluginManifest = {
  id: "operational-simulator",
  name: "Simulador Operacional",
  shortName: "Simulador",
  description: "Cenários, falhas e replay do dia de operação.",
  category: "simulation",
  icon: "▶",
  navigationIcon: "sliders",
  version: "0.1.0",
  status: "experimental",
  route: "/simulator",
  permissions: ["simulation.read"],
};
