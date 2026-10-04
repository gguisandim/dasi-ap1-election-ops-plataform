import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "@eops/database";
import { PollingPlacesService } from "./polling-places.service";

describe("PollingPlacesService", () => {
  it("pagina e calcula seções e eleitorado sem dados hardcoded", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "place-1",
        electoralZoneId: "zone-1",
        name: "Escola Ipê",
        address: "Avenida Cívica, 107",
        district: "Centro",
        city: "Nova Aurora",
        state: "PA",
        latitude: -1.45,
        longitude: -48.49,
        status: "ACTIVE",
        monitoringStatus: "NORMAL",
        createdAt: new Date(),
        updatedAt: new Date(),
        electoralZone: {
          id: "zone-1",
          number: 76,
          name: "Zona Centro",
          municipality: "Nova Aurora",
          election: { id: "election-1", name: "Eleições 2026" },
        },
        sections: [{ registeredVoters: 320 }, { registeredVoters: 310 }],
      },
    ]);
    const count = vi.fn().mockResolvedValue(1);
    const prisma = { pollingPlace: { findMany, count } } as unknown as PrismaService;
    const result = await new PollingPlacesService(prisma).findAll({
      municipality: "Nova Aurora",
      page: 1,
      pageSize: 12,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ sectionCount: 2, registeredVoters: 630 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ city: "Nova Aurora" }) }));
  });
});
