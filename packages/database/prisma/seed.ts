
        },

      },

    });

  }

  if (!await prisma.risk.findUnique({ where: { code: "RSK-00002" } })) {

    await prisma.risk.create({

      data: {

        code: "RSK-00002",

        title: "Rota única de acesso ao local da Zona 91",

        description:

          "Há apenas uma via de acesso ao local. Bloqueio por obra ou chuva forte impede a chegada da equipe e dos materiais.",

        electionId: election.id,

        electoralZoneId: places[1].electoralZoneId,

        pollingPlaceId: places[1].id,

        categoryId: riskCategory("LOGISTICS").id,

        ownerName: "Coordenação de Logística",

        responsibleName: "Equipe de Rotas",

        // MEDIUM × MEDIUM = 9 ⇒ MODERATE.

        probability: RiskProbability.MEDIUM,

        impact: RiskImpact.MEDIUM,

        score: 9,

        level: RiskLevel.MODERATE,

        status: RiskStatus.IDENTIFIED,

        identifiedAt: new Date("2026-09-25T14:00:00.000Z"),

        dueDate: new Date("2026-10-02T18:00:00.000Z"),

        events: {

          create: [

            {

              type: RiskEventType.CREATED,

              message: "Risco registrado com score 9 (MODERATE).",

              actorName: "Coordenação de Logística",

              createdAt: new Date("2026-09-25T14:00:00.000Z"),

            },

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
