import type { PluginManifest } from "@eops/plugin-sdk";

export const manifest: PluginManifest = {
  id: "shifts",
  name: "Escalas e Turnos",
  shortName: "Escalas",
  description: "Planejamento de turnos, cobertura e presença das equipes de campo.",
  category: "operations",
  icon: "◷",
  version: "0.1.0",
  status: "beta",
  route: "/shifts",
  permissions: ["shifts.read"],
};
