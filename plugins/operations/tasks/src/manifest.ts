import type { PluginManifest } from "@eops/plugin-sdk";

export const manifest: PluginManifest = {
  id: "tasks",
  name: "Central de Tarefas",
  shortName: "Tarefas",
  description: "Planejamento, atribuição e acompanhamento das tarefas do pleito.",
  category: "operations",
  navigationGroup: "planning",
  navigationIcon: "list-todo",
  navigationOrder: 20,
  icon: "☷",
  version: "0.1.0",
  status: "beta",
  route: "/tasks",
  permissions: ["tasks.read"],
};
