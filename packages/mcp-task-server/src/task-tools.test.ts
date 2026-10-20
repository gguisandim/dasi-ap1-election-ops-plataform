
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { createTaskMcpServer } from "./server.js";
import { executeTaskTool, type TaskApiConfig } from "./task-tools.js";

const config: TaskApiConfig = {
  apiUrl: "http://localhost:3000/api",
  token: "test-token",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("servidor MCP da Central de Tarefas", () => {
  it("expõe as quatro ferramentas no protocolo MCP", async () => {
    const server = createTaskMcpServer(config);
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    const client = new Client({
      name: "task-server-test-client",
      version: "0.1.0",
    });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const discovery = await client.listTools();

    expect(discovery.tools.map(({ name }) => name)).toEqual([
      "listar_tarefas",
      "consultar_tarefa",
      "criar_tarefa",
      "atualizar_tarefa",
    ]);

    expect(
      discovery.tools.filter(
        ({ annotations }) => annotations?.readOnlyHint,
      ),
    ).toHaveLength(2);

    expect(
      discovery.tools.filter(
        ({ annotations }) => annotations?.readOnlyHint === false,
      ),
    ).toHaveLength(2);

    await client.close();
    await server.close();
  });

  it("lista tarefas com filtros suportados e encaminha Bearer", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse([{ id: "task-1" }]));

    const result = await executeTaskTool(
      "listar_tarefas",
      {
        electionId: "election 1",
        status: "PENDING",
        overdue: false,
      },
      config,
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/tasks?electionId=election+1&status=PENDING&overdue=false",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      result: [{ id: "task-1" }],
    });
  });

  it("lista tarefas sem filtros em GET /api/tasks", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse([{ id: "task-1" }]));

    const result = await executeTaskTool(
      "listar_tarefas",
      {},
      { ...config, apiUrl: "http://localhost:3001" },
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/tasks",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      result: [{ id: "task-1" }],
    });
  });

  it("consulta uma tarefa por ID codificado", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ id: "task/1" }));

    await executeTaskTool(
      "consultar_tarefa",
      { id: "task/1" },
      config,
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/tasks/task%2F1",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("valida criação antes de chamar a API e envia apenas o DTO suportado", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ id: "task-2" }));

    const invalid = await executeTaskTool(
      "criar_tarefa",
      { title: "x", electionId: "e1" },
      config,
      fetchMock,
    );

    expect(invalid.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    const created = await executeTaskTool(
      "criar_tarefa",
      {
        title: "Verificar conectividade",
        electionId: "e1",
        priority: "HIGH",
      },
      config,
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/tasks",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Verificar conectividade",
          electionId: "e1",
          priority: "HIGH",
        }),
      }),
    );

    expect(created.isError).toBeUndefined();
  });

  it("exige ao menos um campo alterável e encaminha PATCH", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ id: "task-3", status: "DONE" }),
      );

    const emptyUpdate = await executeTaskTool(
      "atualizar_tarefa",
      { id: "task-3" },
      config,
      fetchMock,
    );

    expect(emptyUpdate.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    await executeTaskTool(
      "atualizar_tarefa",
      { id: "task-3", status: "DONE" },
      config,
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/tasks/task-3",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          status: "DONE",
        }),
      }),
    );
  });

  it.each([400, 401, 403, 404, 422])(
    "retorna erro compreensível para HTTP %i",
    async (status) => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse(
            { message: `API error ${status}` },
            status,
          ),
        );

      const result = await executeTaskTool(
        "consultar_tarefa",
        { id: "task-4" },
        config,
        fetchMock,
      );

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toEqual({
        error: {
          message: `API error ${status}`,
        },
      });
    },
  );

  it("não confunde rota de listagem inexistente com tarefa não encontrada", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({}, 404));

    const result = await executeTaskTool(
      "listar_tarefas",
      {},
      { ...config, apiUrl: "http://localhost:3001" },
      fetchMock,
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: {
        message:
          "A rota da Central de Tarefas não foi encontrada. Verifique a URL da API configurada.",
      },
    });
  });

  it("trata falha de conexão sem expor dados de autenticação", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("socket failed"));

    const result = await executeTaskTool(
      "listar_tarefas",
      {},
      config,
      fetchMock,
    );

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain(config.token);

    expect(result.structuredContent).toEqual({
      error: {
        message:
          "Não foi possível conectar à API da Central de Tarefas.",
      },
    });
  });

  it("rejeita campos e valores que a API não suporta sem fazer requisição", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({}));

    const result = await executeTaskTool(
      "listar_tarefas",
      { unknownFilter: "value" },
      config,
      fetchMock,
    );

    expect(result.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
