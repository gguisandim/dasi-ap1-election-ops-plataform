import "dotenv/config";
import { scryptSync } from "node:crypto";
import { PLATFORM_PERMISSION_KEYS, PERMISSIONS } from "@eops/security";
import {
  AssetCondition,
  AssetStatus,
  CommunicationAudienceType,
  CommunicationDeliveryStatus,
  CommunicationEventType,
  CommunicationPriority,
  CommunicationStatus,
  ElectionStatus,
  ElectionType,
  IncidentEventType,
  IncidentSeverity,
  IncidentStatus,
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
const incidentCategories = [
  ["CONNECTIVITY", "Conectividade"],
  ["EQUIPMENT", "Equipamento"],
  ["POWER", "Energia elétrica"],
  ["TRANSPORT", "Transporte"],
  ["TRANSMISSION", "Transmissão"],
  ["SECURITY", "Segurança"],
  ["OPERATIONAL", "Operacional"],
  ["OTHER", "Outros"],
] as const;
const assetTypes = [
  ["VOTING_MACHINE", "Urna"], ["NOTEBOOK", "Notebook"], ["ROUTER", "Roteador"],
  ["MODEM", "Modem"], ["BATTERY", "Bateria"], ["PRINTER", "Impressora"],
  ["ELECTION_KIT", "Kit Eleitoral"], ["RADIO", "Rádio"], ["PHONE", "Celular"], ["OTHER", "Outro"],
] as const;
const fieldRoleDefinitions = [["COORDINATOR", "Coordenador"], ["TECHNICIAN", "Técnico"], ["DRIVER", "Motorista"], ["LOGISTICS", "Logística"], ["SUPPORT", "Suporte"], ["SUPERVISOR", "Supervisor"]] as const;
const specialtyDefinitions = [["NETWORK", "Rede"], ["HARDWARE", "Hardware"], ["SOFTWARE", "Software"], ["TRANSMISSION", "Transmissão"], ["LOGISTICS", "Logística"], ["ELECTRICAL", "Elétrica"]] as const;
const communicationCategories = [
  ["CONNECTIVITY", "Conectividade", "#4f9ae8"],
  ["POWER", "Energia", "#d8ad4a"],
  ["LOGISTICS", "Logística", "#35c88b"],
  ["TRANSMISSION", "Transmissão", "#8f7ae8"],
  ["SECURITY", "Segurança", "#e86f7a"],
  ["OPERATIONAL", "Operacional", "#72aee6"],
] as const;
const communicationTemplates = [
  ["Abertura de turno", "OPERATIONAL", "Abertura de turno operacional", "Equipes, confirmem o checklist inicial e a disponibilidade dos equipamentos antes do início do turno.", "NORMAL", "abertura, turno"],
  ["Falha de energia", "POWER", "Oscilação de energia no local", "Registramos oscilação de energia no local. Confirme o acionamento da bateria de contingência e informe a supervisão.", "HIGH", "energia"],
  ["Retomada de transmissão", "TRANSMISSION", "Transmissão normalizada", "A transmissão foi normalizada no ponto indicado. Registre a conclusão no monitor de transmissão.", "NORMAL", "transmissao"],
  ["Interrupção de conectividade", "CONNECTIVITY", "Perda de conectividade no enlace", "O enlace principal apresentou perda de conectividade. Acione o plano de contingência e mantenha a supervisão informada.", "CRITICAL", "conectividade"],
] as const;
const permissions = PLATFORM_PERMISSION_KEYS;
const roles = [
  ["ADMIN", "Administrador"], ["SUPERVISOR", "Supervisor"], ["OPERATOR", "Operador"],
  ["TECHNICIAN", "Técnico"], ["VIEWER", "Consulta"],
] as const;
function demoPasswordHash(password: string) {
  const salt = "eops-demo-seed-2026";
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

async function main() {
  const permissionRecords = [];
  for (const key of permissions) {
    permissionRecords.push(await prisma.permission.upsert({ where: { key }, update: { description: key }, create: { key, description: key } }));
  }
  const roleRecords = [];
  for (const [key, name] of roles) {
    const role = await prisma.role.upsert({ where: { key }, update: { name, system: true }, create: { key, name, description: `Perfil padrão ${name}.`, system: true } });
    const allowed = permissionRecords.filter((permission) => {
      if (key === "ADMIN") return true;
      if (key === "SUPERVISOR") return permission.key !== PERMISSIONS.users.manage;
      if (key === "OPERATOR") return new Set<string>([PERMISSIONS.elections.read, PERMISSIONS.incidents.read, PERMISSIONS.incidents.create, PERMISSIONS.incidents.update, PERMISSIONS.inventory.read, PERMISSIONS.routes.read, PERMISSIONS.routes.manage, PERMISSIONS.transmission.read, PERMISSIONS.transmission.manage, PERMISSIONS.reports.read, PERMISSIONS.fieldTeams.read, PERMISSIONS.fieldTeams.manage, PERMISSIONS.communications.read, PERMISSIONS.communications.manage, PERMISSIONS.communications.publish, PERMISSIONS.simulation.read, PERMISSIONS.simulation.manage]).has(permission.key);
      if (key === "TECHNICIAN") return new Set<string>([PERMISSIONS.elections.read, PERMISSIONS.incidents.read, PERMISSIONS.incidents.update, PERMISSIONS.incidents.resolve, PERMISSIONS.inventory.read, PERMISSIONS.inventory.update, PERMISSIONS.inventory.move, PERMISSIONS.routes.read, PERMISSIONS.transmission.read, PERMISSIONS.transmission.manage, PERMISSIONS.reports.read, PERMISSIONS.fieldTeams.read, PERMISSIONS.fieldTeams.manage, PERMISSIONS.communications.read, PERMISSIONS.simulation.read]).has(permission.key);
      return permission.key.endsWith(".read");
    });
    for (const permission of allowed) {
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });
    }
    roleRecords.push(role);
  }
  const passwordHash = demoPasswordHash(process.env.DEMO_ADMIN_PASSWORD ?? "DemoElectionOps2026!");
  const demoUsers = [
    ["ADMIN", "Administrador Demo", "admin@eops.local"], ["SUPERVISOR", "Supervisora Demo", "supervisor@eops.local"],
    ["OPERATOR", "Operador Demo", "operator@eops.local"], ["TECHNICIAN", "Técnica Demo", "technician@eops.local"],
    ["VIEWER", "Consulta Demo", "viewer@eops.local"],
  ] as const;
  const userRecords = [];
  for (const [roleKey, name, email] of demoUsers) {
    const user = await prisma.user.upsert({ where: { email }, update: { name, passwordHash, status: "ACTIVE" }, create: { name, email, passwordHash, status: "ACTIVE" } });
    const role = roleRecords.find((item) => item.key === roleKey)!;
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
    userRecords.push(user);
  }
  for (const user of userRecords) {
    if (!await prisma.notification.findFirst({ where: { userId: user.id, eventName: "seed.welcome" } })) {
      await prisma.notification.create({ data: { userId: user.id, type: "INFO", title: "Ambiente de demonstração pronto", message: "Pleito, estrutura, incidentes e ativos fictícios foram carregados.", eventName: "seed.welcome", entityType: "System" } });
    }
  }
  const electionData = {
    name: "Eleições Gerais 2026 — Região Demonstração",
    description: "Pleito fictício para treinamento e demonstração da plataforma.",
    year: 2026,
    type: ElectionType.GENERAL,
    status: ElectionStatus.PREPARATION,
  };
  const existingElection = await prisma.election.findFirst({
    where: { year: electionData.year, type: electionData.type },
  });
  const election = existingElection
    ? await prisma.election.update({ where: { id: existingElection.id }, data: electionData })
    : await prisma.election.create({ data: electionData });
  const scenario = await prisma.simulationScenario.findFirst({ where: { name: "Dia de votação — falhas combinadas" } }) ?? await prisma.simulationScenario.create({ data: { name: "Dia de votação — falhas combinadas", description: "Cenário demonstrativo com conectividade, equipamentos, transmissão e logística.", configuration: { recommendedSpeed: 20, probability: "MEDIUM", failures: ["connectivity", "equipment", "transmission", "logistics"] } } });
  if (!await prisma.simulation.findFirst({ where: { electionId: election.id, name: "Treinamento operacional padrão" } })) {
    await prisma.simulation.create({ data: { name: "Treinamento operacional padrão", electionId: election.id, scenarioId: scenario.id, speed: 20, probability: "MEDIUM" } });
  }
  await prisma.electionRound.upsert({
      where: { electionId_roundNumber: { electionId: election.id, roundNumber: 1 } },
      update: { date: new Date("2026-10-04T11:00:00.000Z"), status: RoundStatus.SCHEDULED },
      create: { electionId: election.id, roundNumber: 1, date: new Date("2026-10-04T11:00:00.000Z"), status: RoundStatus.SCHEDULED },
    });
  await prisma.electionRound.upsert({
      where: { electionId_roundNumber: { electionId: election.id, roundNumber: 2 } },
      update: { date: new Date("2026-10-25T11:00:00.000Z"), status: RoundStatus.SCHEDULED },
      create: { electionId: election.id, roundNumber: 2, date: new Date("2026-10-25T11:00:00.000Z"), status: RoundStatus.SCHEDULED },
    });

  const existingStructure = await Promise.all([
    prisma.electoralZone.count({ where: { electionId: election.id } }),
    prisma.pollingPlace.count({ where: { electoralZone: { electionId: election.id } } }),
    prisma.pollingSection.count({ where: { pollingPlace: { electoralZone: { electionId: election.id } } } }),
  ]);
  if (existingStructure[0] < 4 || existingStructure[1] < 32 || existingStructure[2] < 208) {
  for (const [zoneIndex, zoneData] of zones.entries()) {
    const zone = await prisma.electoralZone.upsert({
      where: { electionId_number: { electionId: election.id, number: zoneData.number } },
      update: {
        name: zoneData.name,
        municipality: zoneData.municipality,
        state: zoneData.state,
        status: ResourceStatus.ACTIVE,
      },
      create: {
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
      const name = `${placeKinds[placeIndex % placeKinds.length]} ${["Ipê", "Jatobá", "Guará", "Açaí"][zoneIndex]} ${placeIndex + 1}`;
      const placeData = {
        electoralZoneId: zone.id,
        name,
        address: `Avenida Cívica, ${100 + placeNumber * 7}`,
        district: neighborhood,
        city: zoneData.municipality,
        state: zoneData.state,
        latitude: zoneData.base[0] + (placeIndex % 4) * 0.006 - Math.floor(placeIndex / 4) * 0.004,
        longitude: zoneData.base[1] + (placeIndex % 4) * 0.007 + Math.floor(placeIndex / 4) * 0.005,
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
      };
      const existingPlace = await prisma.pollingPlace.findFirst({
        where: { electoralZoneId: zone.id, name },
      });
      const place = existingPlace
        ? await prisma.pollingPlace.update({ where: { id: existingPlace.id }, data: placeData })
        : await prisma.pollingPlace.create({ data: placeData });
      for (let sectionIndex = 0; sectionIndex < 5 + (placeIndex % 4); sectionIndex += 1) {
        const number = zoneData.number * 100 + placeIndex * 10 + sectionIndex + 1;
        const registeredVoters = 285 + ((placeNumber * 23 + sectionIndex * 17) % 116);
        await prisma.pollingSection.upsert({
            where: { pollingPlaceId_number: { pollingPlaceId: place.id, number } },
            update: { registeredVoters, status: ResourceStatus.ACTIVE },
            create: { pollingPlaceId: place.id, number, registeredVoters, status: ResourceStatus.ACTIVE },
          });
      }
      console.log(`Local fictício sincronizado: ${place.name}`);
    }
  }
  } else {
    console.log("Estrutura eleitoral existente preservada: 4 zonas, 32 locais e 208 seções.");
  }

  const categories = [];
  for (const [key, name] of incidentCategories) {
    categories.push(
      await prisma.incidentCategory.upsert({
        where: { key },
        update: { name, active: true },
        create: { key, name, description: `Categoria demonstrativa: ${name}.` },
      }),
    );
  }
  const places = await prisma.pollingPlace.findMany({
    include: { electoralZone: true },
    orderBy: { name: "asc" },
    take: 4,
  });
  const fieldRoles = [];
  for (const [key, name] of fieldRoleDefinitions) fieldRoles.push(await prisma.fieldRole.upsert({ where: { key }, update: { name, active: true }, create: { key, name, description: `Função operacional: ${name}.` } }));
  const fieldSpecialties = [];
  for (const [key, name] of specialtyDefinitions) fieldSpecialties.push(await prisma.fieldSpecialty.upsert({ where: { key }, update: { name, active: true }, create: { key, name, description: `Especialidade operacional: ${name}.` } }));
  const demoTeam = await prisma.fieldTeam.upsert({ where: { code: "EQ-DEMO-01" }, update: { electionId: election.id, name: "Equipe de Campo Alfa", responsibleName: "Coordenação Operacional", status: "ACTIVE" }, create: { code: "EQ-DEMO-01", electionId: election.id, name: "Equipe de Campo Alfa", responsibleName: "Coordenação Operacional", status: "ACTIVE", notes: "Equipe demonstrativa para cobertura inicial." } });
  const demoMembers = [["Ana Ribeiro", "COORDINATOR", "ana.campo@eops.local", ["LOGISTICS"]], ["Carlos Nunes", "TECHNICIAN", "carlos.campo@eops.local", ["NETWORK", "TRANSMISSION"]], ["Marina Lopes", "DRIVER", "marina.campo@eops.local", ["LOGISTICS"]]] as const;
  for (const [name, roleKey, email, specialtyKeys] of demoMembers) {
    const role = fieldRoles.find((item) => item.key === roleKey)!;
    const member = await prisma.fieldMember.findFirst({ where: { teamId: demoTeam.id, email } }) ?? await prisma.fieldMember.create({ data: { teamId: demoTeam.id, roleId: role.id, name, email, phone: "(91) 90000-0000", status: "AVAILABLE" } });
    for (const specialtyKey of specialtyKeys) { const specialty = fieldSpecialties.find((item) => item.key === specialtyKey)!; await prisma.fieldMemberSpecialty.upsert({ where: { memberId_specialtyId: { memberId: member.id, specialtyId: specialty.id } }, update: {}, create: { memberId: member.id, specialtyId: specialty.id } }); }
  }
  const demoShiftStart = new Date("2026-10-04T09:00:00.000Z");
  if (!await prisma.fieldShift.findFirst({ where: { teamId: demoTeam.id, startsAt: demoShiftStart } })) await prisma.fieldShift.create({ data: { teamId: demoTeam.id, electoralZoneId: places[0].electoralZoneId, pollingPlaceId: places[0].id, startsAt: demoShiftStart, endsAt: new Date("2026-10-04T21:00:00.000Z"), notes: "Turno demonstrativo do dia de votação." } });
  if (!await prisma.fieldAllocation.findFirst({ where: { teamId: demoTeam.id, pollingPlaceId: places[0].id, startsAt: demoShiftStart } })) await prisma.fieldAllocation.create({ data: { electionId: election.id, teamId: demoTeam.id, electoralZoneId: places[0].electoralZoneId, pollingPlaceId: places[0].id, activity: "Cobertura operacional", startsAt: demoShiftStart, endsAt: new Date("2026-10-04T21:00:00.000Z"), status: "SCHEDULED" } });
  const category = (key: string) => categories.find((item) => item.key === key)!;
  const types = [];
  for (const [key, name] of assetTypes) {
    types.push(await prisma.assetType.upsert({
      where: { key }, update: { name, active: true }, create: { key, name, description: `Tipo demonstrativo: ${name}.` },
    }));
  }
  const seededAssets = [];
  for (const [placeIndex, place] of places.entries()) {
    for (let assetIndex = 0; assetIndex < 3; assetIndex += 1) {
      const sequence = placeIndex * 3 + assetIndex + 1;
      const type = types[(placeIndex + assetIndex) % types.length];
      seededAssets.push(await prisma.asset.upsert({
        where: { assetTag: `EQP-${String(sequence).padStart(4, "0")}` },
        update: { pollingPlaceId: place.id, electoralZoneId: place.electoralZoneId },
        create: {
          assetTag: `EQP-${String(sequence).padStart(4, "0")}`,
          name: `${type.name} operacional ${sequence}`,
          typeId: type.id,
          serialNumber: `DEMO-${20260000 + sequence}`,
          manufacturer: "Fabricante Demonstração",
          model: `Modelo ${String.fromCharCode(64 + ((sequence - 1) % 4) + 1)}`,
          status: sequence === 6 ? AssetStatus.MAINTENANCE : AssetStatus.IN_USE,
          condition: sequence === 6 ? AssetCondition.ATTENTION : AssetCondition.GOOD,
          electoralZoneId: place.electoralZoneId,
          pollingPlaceId: place.id,
        },
      }));
    }
  }
  if (await prisma.assetMovement.count({ where: { assetId: seededAssets[0].id } }) === 0) {
    await prisma.assetMovement.create({
      data: {
        assetId: seededAssets[0].id,
        toZoneId: places[0].electoralZoneId,
        toPollingPlaceId: places[0].id,
        originLabel: "Depósito central",
        destinationLabel: places[0].name,
        responsibleName: "Equipe Logística Demonstração",
        reason: "Distribuição inicial para preparação do pleito",
        statusBefore: AssetStatus.AVAILABLE,
        statusAfter: AssetStatus.IN_USE,
        movedAt: new Date("2026-09-29T13:00:00.000Z"),
      },
    });
  }
  const openedAt = new Date("2026-09-30T11:30:00.000Z");
  await prisma.incident.upsert({
    where: { code: "INC-00001" },
    update: { assetId: seededAssets[0].id },
    create: {
      code: "INC-00001",
      title: "Conectividade instável no enlace principal",
      description: "O local apresenta perda intermitente de pacotes durante a preparação operacional.",
      severity: IncidentSeverity.HIGH,
      status: IncidentStatus.IN_PROGRESS,
      electionId: election.id,
      electoralZoneId: places[0].electoralZoneId,
      pollingPlaceId: places[0].id,
      categoryId: category("CONNECTIVITY").id,
      assetId: seededAssets[0].id,
      assignedToName: "Equipe de Redes Alfa",
      openedAt,
      slaDeadline: new Date("2026-09-30T15:30:00.000Z"),
      events: {
        create: [
          { type: IncidentEventType.INCIDENT_CREATED, message: "Incidente registrado pela supervisão local.", createdAt: openedAt },
          { type: IncidentEventType.ASSIGNED, message: "Incidente atribuído à Equipe de Redes Alfa.", createdAt: new Date("2026-09-30T11:38:00.000Z") },
          { type: IncidentEventType.STATUS_CHANGED, message: "Atendimento remoto iniciado.", createdAt: new Date("2026-09-30T11:45:00.000Z") },
        ],
      },
      assignments: { create: { assignedToName: "Equipe de Redes Alfa", reason: "Plantão de conectividade", assignedAt: new Date("2026-09-30T11:38:00.000Z") } },
    },
  });
  await prisma.incident.upsert({
    where: { code: "INC-00002" },
    update: { assetId: seededAssets[5].id },
    create: {
      code: "INC-00002",
      title: "Bateria de contingência com autonomia reduzida",
      description: "Teste preventivo indicou autonomia abaixo do parâmetro operacional.",
      severity: IncidentSeverity.MEDIUM,
      status: IncidentStatus.TRIAGED,
      electionId: election.id,
      electoralZoneId: places[1].electoralZoneId,
      pollingPlaceId: places[1].id,
      categoryId: category("POWER").id,
      assetId: seededAssets[5].id,
      openedAt: new Date("2026-09-30T12:10:00.000Z"),
      slaDeadline: new Date("2026-09-30T20:10:00.000Z"),
      events: { create: [{ type: IncidentEventType.INCIDENT_CREATED, message: "Incidente criado a partir da vistoria preventiva." }, { type: IncidentEventType.STATUS_CHANGED, message: "Triagem concluída; substituição recomendada." }] },
    },
  });
  await prisma.incident.upsert({
    where: { code: "INC-00003" },
    update: {},
    create: {
      code: "INC-00003",
      title: "Impressora de apoio indisponível",
      description: "Equipamento reserva não conclui a inicialização.",
      severity: IncidentSeverity.LOW,
      status: IncidentStatus.RESOLVED,
      electionId: election.id,
      electoralZoneId: places[2].electoralZoneId,
      pollingPlaceId: places[2].id,
      categoryId: category("EQUIPMENT").id,
      openedAt: new Date("2026-09-30T09:00:00.000Z"),
      resolvedAt: new Date("2026-09-30T10:05:00.000Z"),
      slaDeadline: new Date("2026-10-01T09:00:00.000Z"),
      events: { create: [{ type: IncidentEventType.INCIDENT_CREATED, message: "Falha identificada no checklist." }, { type: IncidentEventType.RESOLVED, message: "Equipamento reserva substituído e testado." }] },
    },
  });

  const communicationCategoryRecords = [];
  for (const [key, name, color] of communicationCategories) {
    communicationCategoryRecords.push(
      await prisma.communicationCategory.upsert({
        where: { key },
        update: { name, color, active: true },
        create: { key, name, color, description: `Categoria de comunicado: ${name}.` },
      }),
    );
  }
  const communicationCategory = (key: string) =>
    communicationCategoryRecords.find((item) => item.key === key)!;
  for (const [name, categoryKey, defaultTitle, body, priority] of communicationTemplates) {
    await prisma.communicationTemplate.upsert({
      where: { name },
      update: { defaultTitle, body, categoryId: communicationCategory(categoryKey).id },
      create: {
        name,
        description: `Template demonstrativo: ${name}.`,
        defaultTitle,
        body,
        priority,
        categoryId: communicationCategory(categoryKey).id,
      },
    });
  }
  const seededCommunication = await prisma.communication.upsert({
    where: { code: "COM-00001" },
    update: {},
    create: {
      code: "COM-00001",
      title: "Confirmação de checklist antes da abertura dos locais",
      content:
        "Todas as equipes devem confirmar o checklist de abertura — energia, conectividade e urna — até 30 minutos antes do horário previsto.\n\nDivergências devem ser registradas como incidente na Central de Incidentes.",
      priority: CommunicationPriority.HIGH,
      status: CommunicationStatus.PUBLISHED,
      electionId: election.id,
      categoryId: communicationCategory("OPERATIONAL").id,
      authorName: "Coordenação Operacional",
      observations: "Comunicado demonstrativo criado pelo seed para exercitar o acompanhamento de leitura.",
      publishedAt: new Date("2026-10-01T09:00:00.000Z"),
      dispatchedAt: new Date("2026-10-01T09:00:05.000Z"),
      expiresAt: new Date("2026-10-04T11:00:00.000Z"),
      recipientCount: userRecords.length,
      tags: {
        create: [
          { tag: { connect: { id: (await prisma.communicationTag.upsert({ where: { label: "turno" }, update: {}, create: { label: "turno", slug: "turno" } })).id } } },
          { tag: { connect: { id: (await prisma.communicationTag.upsert({ where: { label: "checklist" }, update: {}, create: { label: "checklist", slug: "checklist" } })).id } } },
        ],
      },
      audiences: { create: [{ type: CommunicationAudienceType.ALL, label: "Todos os usuários ativos" }] },
      timeline: {
        create: [
          { type: CommunicationEventType.CREATED, message: "Comunicado criado.", actorName: "Coordenação Operacional", createdAt: new Date("2026-10-01T08:55:00.000Z") },
          { type: CommunicationEventType.PUBLISHED, message: "Comunicado publicado.", actorName: "Coordenação Operacional", createdAt: new Date("2026-10-01T09:00:00.000Z") },
          { type: CommunicationEventType.DISPATCHED, message: `${userRecords.length} destinatário(s) receberam o comunicado.`, createdAt: new Date("2026-10-01T09:00:05.000Z") },
        ],
      },
    },
    include: { audiences: true },
  });
  const communicationAudience = seededCommunication.audiences[0];
  const recipientStates: Array<[number, CommunicationDeliveryStatus, number | null]> = [
    [0, CommunicationDeliveryStatus.CONFIRMED, 42],
    [1, CommunicationDeliveryStatus.VIEWED, null],
    [2, CommunicationDeliveryStatus.DELIVERED, null],
    [3, CommunicationDeliveryStatus.PENDING, null],
  ];
  for (const [index, deliveryStatus, confirmationMinutes] of recipientStates) {
    const user = userRecords[index];
    if (!user) continue;
    const confirmedAt = confirmationMinutes
      ? new Date(Date.parse("2026-10-01T09:00:00.000Z") + confirmationMinutes * 60_000)
      : null;
    await prisma.communicationRecipient.upsert({
      where: {
        communicationId_dedupeKey: {
          communicationId: seededCommunication.id,
          dedupeKey: `user:${user.id}`,
        },
      },
      update: {},
      create: {
        communicationId: seededCommunication.id,
        audienceId: communicationAudience?.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        roleLabel: user.email.split("@")[0],
        sourceLabel: "Todos os usuários ativos",
        deliveryStatus,
        deliveredAt: new Date("2026-10-01T09:00:05.000Z"),
        viewedAt:
          deliveryStatus === CommunicationDeliveryStatus.VIEWED || confirmedAt
            ? new Date("2026-10-01T09:20:00.000Z")
            : null,
        confirmedAt,
        dedupeKey: `user:${user.id}`,
      },
    });
  }
  if (!await prisma.communication.findFirst({ where: { code: "COM-00002" } })) {
    await prisma.communication.create({
      data: {
        code: "COM-00002",
        title: "Reforço de equipe na Zona 76",
        content: "A Zona 76 receberá reforço de equipe no turno da tarde. Confirme a disponibilidade dos membros designados.",
        priority: CommunicationPriority.NORMAL,
        status: CommunicationStatus.SCHEDULED,
        electionId: election.id,
        categoryId: communicationCategory("LOGISTICS").id,
        authorName: "Coordenação Operacional",
        scheduledAt: new Date("2026-10-04T07:00:00.000Z"),
        audiences: {
          create: [{ type: CommunicationAudienceType.ELECTORAL_ZONE, electoralZoneId: places[0].electoralZoneId, label: `Zona ${places[0].electoralZone.number}` }],
        },
        timeline: {
          create: [
            { type: CommunicationEventType.CREATED, message: "Comunicado criado.", actorName: "Coordenação Operacional" },
            { type: CommunicationEventType.SCHEDULED, message: "Comunicado agendado para 2026-10-04T07:00:00.000Z.", actorName: "Coordenação Operacional" },
          ],
        },
      },
    });
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
