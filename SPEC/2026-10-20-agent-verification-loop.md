Status
approved
SPEC Gate
- Classificação: NEW_SPEC.
- Justificativa: o repositório possui governança para agentes e verificações, mas esta SPEC introduz a regra operacional específica de um loop recorrente, com gatilho, porteiro, estado persvccistente, orçamento e escalação.
- SPEC normativa: SPEC/2026-10-20-agent-verification-loop.md.
- Dependências normativas: SPEC/README.md, SPEC/2026-10-04-agent-governance-and-spec-enforcement.md e AGENTS.md.
Contexto e problema
A Election Ops Platform é um monorepo TypeScript organizado em apps/, packages/ e plugins/. O repositório já disponibiliza verificadores de SPEC, fronteiras entre workspaces, tipos, lint, testes e build. Hoje, executar verificações, interpretar falhas e decidir se uma intervenção do agente pode prosseguir são ações orquestradas manualmente. A Aula 7 propõe explicitar essa orquestração como um loop controlado, sem conceder autonomia irrestrita ao agente.
Objetivo
Projetar e executar uma versão manual e auditável de um loop de verificação de integridade após alterações de código, documentando um gatilho futuro por evento, critérios de parada verificáveis por máquina e pontos de escalação humana. A atividade demonstrará no máximo três iterações, com uma nova sessão independente de agente por tentativa.
Escopo
- Documentar o protocolo do agente em loop/PROMPT.md.
- Persistir o estado e as evidências de cada tentativa em loop/ESTADO.md.
- Registrar a reflexão da execução em diario/2026-10-13.md, conforme enunciado da Aula 7, identificando a data real de execução quando diferente.
- Realizar preflight de Git e leitura mínima das instruções relevantes.
- Rodar verificações reais do monorepo, registrar exit codes e decidir PASSOU, TENTAR_NOVAMENTE ou ESCALAR.
- Permitir, somente após autorização humana e quando houver falha concreta, uma correção mínima em arquivo permitido e diretamente vinculado à falha.
- Registrar a proposta de automação futura sem implantar um gatilho automático nesta entrega.
Fora de escopo
- Instalar scheduler, hook, GitHub Action ou serviço de execução autônoma.
- Criar ou modificar funcionalidades eleitorais, APIs, UI, contratos, RBAC, banco de dados ou arquitetura de plugins para demonstrar o loop.
- Desligar, apagar, enfraquecer ou reescrever testes e verificadores para obter sucesso artificial.
- Alterar arquivos proibidos, executar migrações, modificar segredos ou acessar serviços de produção.
- Fazer commits, pushes, rebases, resets ou qualquer alteração de histórico sem autorização explícita.
- Alegar aprovação de verificações não executadas.
Gatilho
Tipo: evento — alteração de código no repositório.

Justificativa: uma alteração de implementação pode introduzir regressões de compilação, testes ou fronteiras entre plugins; por isso a verificação é mais relevante após a mudança do que em um horário fixo.

Implementação nesta atividade: o desenvolvedor simula manualmente a ocorrência do evento e inicia a primeira sessão do agente. O gatilho não será automatizado agora. Se não houver falha nem tarefa de correção autorizada, a primeira volta pode ser estritamente de verificação.
Protocolo de cada iteração
1. Iniciar uma sessão nova, sem aproveitar o contexto conversacional da anterior.
2. Ler AGENTS.md, SPEC/README.md, esta SPEC, loop/PROMPT.md, loop/ESTADO.md e apenas os arquivos estritamente necessários.
3. Inspecionar git status --short e preservar alterações preexistentes; não sobrescrever trabalho de outras pessoas.
4. Ler o resultado anterior persistido e selecionar uma ação delimitada: verificar o estado atual ou, se autorizada, corrigir uma falha concreta em escopo permitido.
5. Registrar os arquivos tocados, a razão e as evidências; o agente não decide sozinho se a execução terminou.
6. Encerrar a sessão. O desenvolvedor, atuando como porteiro independente, executa os verificadores e registra exit codes e decisão em loop/ESTADO.md.
7. Se o porteiro decidir TENTAR_NOVAMENTE, iniciar nova sessão, dentro do limite de três. Se decidir PASSOU ou ESCALAR, encerrar.
Verificadores e critério de aceite
Os comandos são os disponibilizados pelo package.json raiz:
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
Todos os seis comandos são obrigatórios em cada rodada de verificação, na ordem listada; uma falha não autoriza omitir os comandos seguintes. O porteiro deve registrar, para cada comando, o comando literal, seu exit code e um resumo do resultado. Se um comando não puder ser iniciado por dependência, infraestrutura ou outra causa externa, registrar BLOQUEADO para ele e continuar os demais quando for seguro e possível. Uma rodada com comando BLOQUEADO não pode resultar em PASSOU; deve ser escalada e só pode ser encerrada após resolução ou decisão humana formalmente registrada, sem apresentar a rodada como aprovada.

PASSOU somente quando todos os comandos obrigatórios terminarem com exit code 0, não houver testes apagados/desabilitados nem alterações proibidas, e as mudanças feitas (se houver) respeitarem a SPEC Gate e o escopo autorizado. A aprovação permite encaminhar o resultado à revisão humana, não autoriza commit ou push automaticamente. Não é necessário usar as três tentativas se os critérios já forem satisfeitos.

TENTAR_NOVAMENTE somente se houver falha real, corrigível em escopo permitido, progresso plausível, autorização humana para a ação e tentativas restantes.

ESCALAR quando ocorrer qualquer condição da seção seguinte.
Orçamento e escalação humana
- Orçamento: máximo de três sessões independentes do agente para esta execução manual.
- Ausência de progresso: duas tentativas consecutivas com a mesma falha essencial, sem melhoria objetiva, exigem escalação antes da terceira. Considere a falha essencial repetida quando ocorrer no mesmo comando e tiver a mesma identificação verificável (por exemplo, nome do teste ou diagnóstico com arquivo e linha). Há melhoria objetiva quando a falha identificada deixa de ocorrer ou quando a quantidade de ocorrências desse diagnóstico diminui; mudança apenas de redação ou de ordem no log não conta como melhoria.
- Exaustão: três tentativas sem aprovação exigem encerramento e escalação.
- Ambiguidade: falta de requisitos, múltiplas interpretações materiais ou necessidade de decisão de produto exigem escalação.
- Mudança normativa: qualquer demanda de atualização material de SPEC exige interrupção da implementação afetada e aplicação do SPEC Gate, com autorização para o commit normativo antes de retomar.
- Falha de ambiente: dependências ausentes, infraestrutura inacessível ou verificações impossíveis exigem registro da limitação e decisão humana, sem aprovação simulada.
- Risco: qualquer necessidade de tocar área proibida exige parada imediata e proposta de intervenção ao humano; o agente não aplica essa mudança.
Zonas proibidas para correção autônoma
- .github/workflows/ e configuração de CI.
- Arquivos .env, chaves, tokens, credenciais e outros segredos.
- Migrações, schema, seeds e outros arquivos sensíveis em packages/database/prisma/.
- Autenticação, autorização, RBAC e contratos de segurança.
- Scripts e configurações de testes, lint, typecheck, fronteiras, SPEC checker e seus critérios de aprovação.
- AGENTS.md, SPEC/README.md e SPECs existentes, exceto em fluxo específico de atualização normativa autorizado.
- Qualquer módulo fora do escopo delimitado da falha.
Estado persistente e auditabilidade
loop/ESTADO.md deve conter o identificador do gatilho manual, estado inicial do Git, classificação do SPEC Gate, número da iteração (1 a 3), objetivo de cada sessão, arquivos alterados, comandos, exit codes, falhas encontradas, decisão do porteiro, justificativa, eventual escalação e condição de encerramento. Não preencher resultados antecipadamente.

Estados previstos: PENDENTE, EM_VERIFICACAO, PASSOU, TENTAR_NOVAMENTE, ESCALADO. As iterações concluídas não devem ser apagadas ou reescritas para aparentar sucesso.
Critérios de aceite
- [ ] loop/PROMPT.md define tarefa, gatilho, limites, zonas proibidas, verificador, parada e escalação, coerentemente com esta SPEC.
- [ ] loop/ESTADO.md registra o estado inicial e todas as iterações efetivamente realizadas, sem inventar evidências.
- [ ] Cada tentativa inicia uma nova sessão do agente.
- [ ] Após cada sessão, o porteiro humano executa e registra verificações com exit codes.
- [ ] Cada rodada registra o resultado dos seis comandos obrigatórios, inclusive os que não puderam iniciar e a justificativa.
- [ ] O fluxo termina em PASSOU ou ESCALADO dentro de no máximo três tentativas, com justificativa baseada em evidência.
- [ ] Nenhuma zona proibida é alterada pelo agente durante o loop.
- [ ] diario/2026-10-13.md registra onde o loop parou, limitações e qual componente seria automatizado primeiro.
- [ ] O handoff declara SPEC COMPLIANCE, classificação de gate, evidências e eventuais desvios.
- [ ] Commit somente após autorização explícita, com revisão de diff e rastreabilidade conforme docs/COMMIT-GUIDE.md.
Sequência de entrega
1. Revisar e aprovar esta SPEC (proposed → approved) e, mediante autorização explícita, commitar somente esta SPEC.
2. Criar loop/PROMPT.md e modelo inicial de loop/ESTADO.md sem inventar execução.
3. Executar manualmente o loop em até três sessões; após cada uma, realizar a verificação independente e registrar a decisão.
4. Escrever diario/2026-10-13.md, identificando também a data efetiva da execução.
5. Revisar evidências e solicitar autorização específica para o commit final; não fazer push automaticamente.
Riscos e mitigação
- Loop caro ou infinito: limite de três sessões e encerramento por aprovação ou escalação.
- Aprovação autorreferente: o porteiro executa as verificações separadamente do agente.
- Correção indevida de testes: scripts e testes/verificadores não podem ser adulterados para obter verde.
- Regressão de funcionalidades: validações globais e proibição de mudanças fora do escopo.
- Rastreabilidade falsa: registrar datas e resultados reais, preservando o histórico e sem fabricar execuções.
Evidências esperadas
Arquivos versionados: SPEC/2026-10-20-agent-verification-loop.md, loop/PROMPT.md, loop/ESTADO.md e diario/2026-10-13.md. Evidências técnicas: saídas/exit codes dos comandos, git status, diff revisado e commits realizados somente quando autorizados.