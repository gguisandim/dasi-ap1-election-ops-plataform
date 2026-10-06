import type { PluginManifest } from "@eops/plugin-sdk";

export const manifest: PluginManifest = {
  id: "postmortems",
  name: "Postmortem e RCA",
  shortName: "Postmortem",
  description:
    "Análise pós-incidente: causa raiz, timeline operacional, lições e ações corretivas.",
  category: "operations",
  navigationGroup: "field-support",
  navigationIcon: "file-search",
  navigationOrder: 45,
  icon: "⌘",
  version: "0.1.0",
  status: "beta",
  route: "/postmortems",
  permissions: ["postmortems.read"],
};
