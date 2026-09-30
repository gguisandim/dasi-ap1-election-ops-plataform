import "dotenv/config";
import {
  ElectionStatus,
  ElectionType,
  MonitoringStatus,
  PrismaClient,
  ResourceStatus,
  RoundStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const zones = [
  {
    number: 76,
    name: "Zona Centro",
    municipality: "Nova Aurora",
    state: "PA",
    base: [-1.4558, -48.4902],
  },
  {
    number: 77,
    name: "Zona Guamá",
    municipality: "Nova Aurora",
    state: "PA",
    base: [-1.4672, -48.4621],
  },
  {
    number: 91,
    name: "Zona das Águas",
    municipality: "Vila Esperança",
    state: "PA",
    base: [-1.3651, -48.3728],
  },
  {
    number: 104,
    name: "Zona Metropolitana",
    municipality: "Rio Verde do Norte",
    state: "PA",
    base: [-1.2914, -48.3813],
  },
];
const placeKinds = [
  "Escola Estadual",
  "Centro Comunitário",
  "Instituto Municipal",
  "Escola Parque",
];
const neighborhoods = [
  "Centro",
  "Jardim das Mangueiras",
  "São Lucas",
  "Nova União",
  "Águas Claras",
  "Bela Vista",
];

async function main() {
  await prisma.pollingSection.deleteMany();
  await prisma.pollingPlace.deleteMany();
  await prisma.electoralZone.deleteMany();
  await prisma.electionRound.deleteMany();
  await prisma.election.deleteMany();

  const election = await prisma.election.create({
    data: {
      name: "Eleições Gerais 2026 — Região Demonstração",
      description:
        "Pleito fictício para treinamento e demonstração da plataforma.",
      year: 2026,
      type: ElectionType.GENERAL,
      status: ElectionStatus.PREPARATION,
      rounds: {
        create: [
          {
            roundNumber: 1,
            date: new Date("2026-10-04T11:00:00.000Z"),
            status: RoundStatus.SCHEDULED,
          },
          {
            roundNumber: 2,
            date: new Date("2026-10-25T11:00:00.000Z"),
            status: RoundStatus.SCHEDULED,
          },
        ],
      },
    },
  });

  for (const [zoneIndex, zoneData] of zones.entries()) {
    const zone = await prisma.electoralZone.create({
      data: {
        electionId: election.id,
        number: zoneData.number,
        name: zoneData.name,
        municipality: zoneData.municipality,
        state: zoneData.state,
        status: ResourceStatus.ACTIVE,
      },
    });

    for (let placeIndex = 0; placeIndex < 8; placeIndex += 1) {
      const neighborhood =
        neighborhoods[(placeIndex + zoneIndex) % neighborhoods.length];
      const placeNumber = zoneIndex * 8 + placeIndex + 1;
      const place = await prisma.pollingPlace.create({
        data: {
          electoralZoneId: zone.id,
          name: `${placeKinds[placeIndex % placeKinds.length]} ${["Ipê", "Jatobá", "Guará", "Açaí"][zoneIndex]} ${placeIndex + 1}`,
          address: `Avenida Cívica, ${100 + placeNumber * 7}`,
          district: neighborhood,
          city: zoneData.municipality,
          state: zoneData.state,
          latitude:
            zoneData.base[0] +
            (placeIndex % 4) * 0.006 -
            Math.floor(placeIndex / 4) * 0.004,
          longitude:
            zoneData.base[1] +
            (placeIndex % 4) * 0.007 +
            Math.floor(placeIndex / 4) * 0.005,
          status: ResourceStatus.ACTIVE,
          monitoringStatus: [
            MonitoringStatus.NORMAL,
            MonitoringStatus.NORMAL,
            MonitoringStatus.NORMAL,
            MonitoringStatus.ATTENTION,
            MonitoringStatus.NORMAL,
            MonitoringStatus.CRITICAL,
            MonitoringStatus.NORMAL,
            MonitoringStatus.OFFLINE,
          ][placeIndex],
          sections: {
            create: Array.from(
              { length: 5 + (placeIndex % 4) },
              (_, sectionIndex) => ({
                number:
                  zoneData.number * 100 + placeIndex * 10 + sectionIndex + 1,
                registeredVoters:
                  285 + ((placeNumber * 23 + sectionIndex * 17) % 116),
                status: ResourceStatus.ACTIVE,
              }),
            ),
          },
        },
      });
      console.log(`Criado local fictício: ${place.name}`);
    }
  }

  const [zoneCount, placeCount, sectionCount] = await Promise.all([
    prisma.electoralZone.count(),
    prisma.pollingPlace.count(),
    prisma.pollingSection.count(),
  ]);
  console.log(
    `Seed concluído: 1 pleito, ${zoneCount} zonas, ${placeCount} locais e ${sectionCount} seções.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
