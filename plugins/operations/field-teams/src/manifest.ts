import type { PluginManifest } from "@eops/plugin-sdk";

export const manifest: PluginManifest = {
  id: "field-teams",
  name: "Equipes de Campo",
  shortName: "Equipes",
  description: "Pessoal, capacidades, disponibilidade e presença operacional.",
  category: "operations",
  navigationGroup: "field-support",
  navigationIcon: "users",
  navigationOrder: 10,
  icon: "♟",
  version: "0.1.0",
  status: "beta",
  route: "/field-teams",
  permissions: ["field-teams.read"],
};
