import type { PluginManifest } from "@eops/plugin-sdk";
export const manifest: PluginManifest = {
  id: "polling-sections",
  name: "Seções Eleitorais",
  shortName: "Seções",
  description: "Cadastro de seções e eleitorado estimado.",
  category: "operations",
  navigationGroup: "electoral-structure",
  navigationIcon: "landmark",
  navigationOrder: 40,
  icon: "§",
  version: "0.1.0",
  status: "beta",
  route: "/polling-sections",
  permissions: ["elections.read"],
};
