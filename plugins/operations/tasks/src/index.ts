import type { PlatformPlugin } from "@eops/plugin-sdk";
import { manifest } from "./manifest";
import { TaskDetailPage } from "./client/pages/TaskDetailPage";
import { TasksDashboardPage } from "./client/pages/TasksDashboardPage";
import { TasksKanbanPage } from "./client/pages/TasksKanbanPage";
import { TasksListPage } from "./client/pages/TasksListPage";
import { NewTaskPage } from "./client/pages/NewTaskPage";

export const tasksPlugin: PlatformPlugin = {
  manifest,
  View: TasksDashboardPage,
  routes: [
    { path: "/tasks", Component: TasksDashboardPage },
    { path: "/tasks/kanban", Component: TasksKanbanPage },
    { path: "/tasks/list", Component: TasksListPage },
    { path: "/tasks/new", Component: NewTaskPage },
    { path: "/tasks/:id", Component: TaskDetailPage },
  ],
};