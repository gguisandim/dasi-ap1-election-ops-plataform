import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { TaskApiConfig } from "./task-tools.js";
import { executeTaskTool, listTaskTools } from "./task-tools.js";

export function createTaskMcpServer(config: TaskApiConfig) {
  const server = new Server(
    { name: "eops_tasks", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listTaskTools() }));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    executeTaskTool(request.params.name, request.params.arguments, config),
  );

  return server;
}
