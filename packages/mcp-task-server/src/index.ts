import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTaskMcpServer } from "./server.js";

function loadConfig() {
  const apiUrl = process.env.EOPS_API_URL;
  const token = process.env.EOPS_API_TOKEN;
  if (!apiUrl?.trim() || !token?.trim()) {
    throw new Error("Configure EOPS_API_URL e EOPS_API_TOKEN no arquivo .env.mcp antes de iniciar o servidor.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw new Error("EOPS_API_URL deve ser uma URL HTTP ou HTTPS válida.");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error("EOPS_API_URL deve usar HTTP/HTTPS e não pode conter credenciais.");
  }
  if (parsedUrl.search || parsedUrl.hash) {
    throw new Error("EOPS_API_URL não pode conter query string ou fragmento.");
  }

  return { apiUrl: apiUrl.replace(/\/+$/, ""), token: token.trim() };
}

async function main() {
  const server = createTaskMcpServer(loadConfig());
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Falha ao iniciar o servidor MCP.";
  process.stderr.write(`[mcp-task-server] ${message}\n`);
  process.exitCode = 1;
});
