import { describe, expect, it, vi } from "vitest";
import { EventBus, requiredPermissionForEvent } from "./index";
describe("EventBus", () => {
  it("entrega payload tipado ao subscriber", async () => {
    const bus = new EventBus(); const handler = vi.fn(); bus.subscribe("asset.moved", handler);
    await bus.emit("asset.moved", { entityId: "asset-1", assetTag: "RTR-1", origin: "Depósito", destination: "Zona 76", responsibleName: "Equipe" });
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: "asset.moved", payload: expect.objectContaining({ destination: "Zona 76" }) }));
  });

  it("entrega o mesmo evento a subscribers específicos e globais", async () => {
    const bus = new EventBus();
    const specific = vi.fn();
    const global = vi.fn();
    bus.subscribe("incident.created", specific);
    bus.subscribeAll(global);

    await bus.emit("incident.created", { entityId: "incident-1", code: "INC-1", title: "Falha", severity: "HIGH", electionId: "election-1" });

    expect(specific).toHaveBeenCalledTimes(1);
    expect(global).toHaveBeenCalledTimes(1);
    expect(global).toHaveBeenCalledWith(expect.objectContaining({ name: "incident.created", occurredAt: expect.any(Date) }));
  });

  it("suporta múltiplos subscribers e unsubscribe", async () => {
    const bus = new EventBus();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = bus.subscribeAll(first);
    bus.subscribeAll(second);
    unsubscribe();

    await bus.emit("incident.resolved", { entityId: "incident-1", code: "INC-1", title: "Falha", from: "IN_PROGRESS", to: "RESOLVED" });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ entityId: "incident-1" }) }));
  });
  it("separa a permissão de handover da permissão de shifts", () => {
    expect(requiredPermissionForEvent("shift_handover.submitted")).toBe("shift-handovers.read");
    expect(requiredPermissionForEvent("shift.started")).toBe("shifts.read");
  });
});
