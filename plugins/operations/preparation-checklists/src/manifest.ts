import type { PluginManifest } from "@eops/plugin-sdk";

export const manifest: PluginManifest = {
  id: "preparation-checklists",
  name: "Checklist de Preparação",
  shortName: "Preparação",
  description: "Preparação, evidências e aprovação dos locais de votação.",
  category: "operations",
  icon: "✓",
  version: "0.1.0",
  status: "beta",
  route: "/preparation-checklists",
  permissions: ["preparation-checklists.read"],
};