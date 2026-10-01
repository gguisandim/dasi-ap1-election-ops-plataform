import { describe, expect, it, vi } from "vitest";
import { EventBus } from "./index";
describe("EventBus", () => {
  it("entrega payload tipado ao subscriber", async () => {
    const bus = new EventBus(); const handler = vi.fn(); bus.subscribe("asset.moved", handler);
    await bus.emit("asset.moved", { entityId: "asset-1", assetTag: "RTR-1", origin: "Depósito", destination: "Zona 76", responsibleName: "Equipe" });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: "asset.moved", payload: expect.objectContaining({ destination: "Zona 76" }) }));
  });
});
