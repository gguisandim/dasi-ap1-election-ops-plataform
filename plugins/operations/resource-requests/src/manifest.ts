import type { PluginManifest } from "@eops/plugin-sdk";

export const manifest: PluginManifest = {
  id: "resource-requests",
  name: "Solicitações de Recurso",
  shortName: "Recursos",
  description:
    "Pedido operacional de recurso: triagem, aprovação, atendimento e histórico.",
  category: "operations",
  navigationGroup: "field-support",
  navigationIcon: "package-plus",
  navigationOrder: 30,
  icon: "▤",
  version: "0.1.0",
  status: "beta",
  route: "/resource-requests",
  permissions: ["resource-requests.read"],
};
