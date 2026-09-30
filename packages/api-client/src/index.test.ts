import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "./index";

afterEach(() => vi.unstubAllGlobals());

describe("ApiClient", () => {
  it("envia JSON e devolve a resposta tipada", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "e-1" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await new ApiClient("/api").post<{ id: string }>(
      "/elections",
      { name: "Pleito" },
    );
    expect(result.id).toBe("e-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/elections",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("normaliza erros HTTP retornados pela API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Não encontrado" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(new ApiClient("/api").get("/missing")).rejects.toEqual(
      expect.objectContaining<ApiError>({
        status: 404,
        message: "Não encontrado",
      }),
    );
  });
});
