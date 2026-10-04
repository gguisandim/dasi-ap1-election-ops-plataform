# Governança de agentes e enforcement de SPEC

## Status

`proposed`

## Contexto

A Election Ops Platform adota Spec-Driven Development (SDD), arquitetura modular por plugins e rastreabilidade cronológica no Git. As regras atuais já orientam agentes a criar ou atualizar uma SPEC antes de mudanças funcionais, mas ainda não definem um gate explícito para classificar todas as tarefas, não delimitam de forma uniforme a autorização para commits de SPEC e não distinguem com precisão documentação normativa de documentação descritiva.

Também existe um protocolo inicial de execution issues que precisa cobrir estados adicionais de ciclo de vida, problemas de ausência/rastreabilidade de SPEC e um formato de handoff verificável. O módulo Passagem de Turno possui documentação detalhada em `docs/modules/shift-handover.md`, mas não possui uma SPEC correspondente identificável em `SPEC/`; isso deve ser auditado sem implementar ou alterar o módulo nesta tarefa.

## Problema

Sem um gate obrigatório e uma hierarquia documental inequívoca, agentes podem:

- iniciar implementação antes de decidir se a tarefa exige SPEC nova, atualização, reutilização ou isenção;
- tratar documentos descritivos em `docs/modules/` como substitutos de uma SPEC normativa;
- executar commits além da autorização fornecida pelo usuário;
- encerrar tarefas sem declarar a conformidade com a SPEC e suas evidências;
- manter execution issues indefinidamente abertos mesmo quando são risco aceito ou limitação não acionável;
- reconstruir rastreabilidade retroativa sem deixar explícito que a SPEC não antecedeu o código.

## Objetivos

- instituir um `SPEC Gate` obrigatório antes da primeira alteração de implementação;
- formalizar quando criar, atualizar, reutilizar ou dispensar uma SPEC;
- restringir commits de SPEC à autorização explícita e limitada do usuário;
- estabelecer `SPEC/` como fonte normativa e `docs/modules/` como documentação descritiva;
- ampliar categorias, estados e evidências do protocolo de execution issues;
- tornar o fluxo compatível com diferentes agentes sem duplicar regras por ferramenta;
- exigir um diagnóstico `SPEC COMPLIANCE` no handoff final;
- auditar a rastreabilidade do módulo Passagem de Turno e os execution issues existentes.

## Escopo

- `AGENTS.md` e, quando necessário para consistência local, `plugins/AGENTS.md`;
- `SPEC/README.md`;
- `docs/AI-PLUGIN-GUIDE.md`;
- `docs/execution-issues/README.md` e issues já existentes;
- `prompts/templates/implementation.md`;
- adaptador pequeno em `.github/copilot-instructions.md`;
- auditoria documental de `docs/modules/shift-handover.md`, `SPEC/` e `prompts/sessoes/`;
- verificação da árvore de dependências associada ao issue conhecido de Prisma/deepmerge-ts;
- definição do handoff de conformidade com SPEC.

## Fora de escopo

- implementar ou alterar o módulo Passagem de Turno;
- criar enforcement automatizado, script de validação ou etapa nova de CI;
- atualizar Prisma para outra versão principal ou aplicar `npm audit fix --force`;
- alterar banco, migrations, contratos de domínio, APIs, permissões ou Event Bus;
- alterar frontend, shell, plugins ou comportamento eleitoral;
- reescrever SPECs antigas para simular anterioridade;
- fazer commits de implementação, push, rebase, squash, reset ou force-push.

## Regras procedurais

1. Executar o preflight mínimo da tarefa e preservar alterações preexistentes.
2. Ler somente as instruções, SPECs e arquivos diretamente relacionados ao escopo.
3. Classificar o `SPEC Gate` antes da primeira alteração de implementação.
4. Declarar a classificação e o caminho da SPEC no andamento ou no handoff.
5. Quando uma SPEC precisar ser criada ou atualizada, concluir e commitar essa mudança antes de editar implementação.
6. Se os requisitos mudarem materialmente durante a execução, atualizar e commitar a SPEC antes de continuar a implementação afetada.
7. Não usar documentação descritiva, prompt ou código existente para alegar que uma SPEC normativa antecedeu uma implementação antiga.
8. Encerrar a tarefa com `SPEC COMPLIANCE`, evidências de validação e execution issues relevantes.

## SPEC Gate

Toda tarefa deve receber exatamente uma classificação antes da primeira alteração de implementação:

### `NEW_SPEC`

Use quando a tarefa introduz funcionalidade, contrato, regra operacional, governança normativa ou mudança material de comportamento ainda não coberta por uma SPEC válida.

Resultado obrigatório: criar a SPEC, registrá-la como `proposed` ou `approved` conforme a autorização e fazer seu commit antes da implementação.

### `UPDATE_SPEC`

Use quando existe uma SPEC relacionada, mas o pedido altera requisito, aceite, escopo ou comportamento material.

Resultado obrigatório: atualizar a SPEC e commitar a atualização antes da implementação afetada.

### `EXISTING_SPEC_OK`

Use quando uma SPEC normativa existente cobre integralmente a mudança e não precisa ser alterada.

Resultado obrigatório: informar o caminho da SPEC e referenciá-la na rastreabilidade da implementação.

### `SPEC_EXEMPT`

Use apenas para trabalho que não muda comportamento de produto nem regra normativa, como investigação somente leitura, correção editorial sem mudança semântica, manutenção mecânica ou atualização documental puramente descritiva.

Resultado obrigatório: registrar uma justificativa objetiva. A isenção não pode ser usada para ocultar mudança em UI, API, contrato, banco, permissão, fluxo operacional ou regra de governança.

Se a classificação não puder ser determinada por falta de requisito indispensável, a implementação deve permanecer bloqueada até obter contexto. A existência de mais de uma opção técnica, por si só, não constitui bloqueio.

## Política de commit da SPEC

- Um agente só pode executar `git add` e `git commit` quando o usuário autorizar explicitamente esses atos.
- A autorização pode ser limitada ao commit inicial da SPEC. Nesse caso, ela não autoriza commit da implementação nem qualquer outro comando de mutação do histórico.
- O staging deve conter somente a SPEC autorizada; o agente deve verificar `git status --short` e o diff staged antes do commit.
- O commit da SPEC deve usar o formato de `docs/COMMIT-GUIDE.md`, incluindo os trailers `Agent:` e `Spec:`.
- A SPEC deve aparecer no histórico antes do primeiro commit de implementação correspondente.
- `push`, `rebase`, `squash`, `reset`, `restore`, `force-push` e alterações equivalentes continuam proibidos sem autorização explícita própria.
- Uma autorização de commit não autoriza mudanças fora do escopo nem permite sobrescrever alterações existentes.

## SPEC versus `docs/modules/`

### `SPEC/` — normativa

Define intenção aprovada ou proposta, escopo, requisitos, regras, critérios de aceite e validação de uma mudança. É a referência que commits funcionais devem citar.

### `docs/modules/` — descritiva

Explica o estado, funcionamento ou contexto de um módulo para operação e manutenção. Pode conter material útil para propor uma SPEC, mas não substitui a SPEC nem comprova anterioridade normativa.

Quando uma funcionalidade já implementada possui apenas documentação descritiva, deve-se avaliar uma SPEC retroativa. A SPEC retroativa deve:

- usar status `retroactive`;
- indicar as fontes usadas para reconstrução;
- declarar que não antecedeu o código existente;
- não motivar rebase ou reescrita do histórico;
- servir como baseline normativa para mudanças futuras somente após revisão adequada.

## Status de SPEC

- `proposed`: requisitos documentados, ainda aguardando aprovação explícita ou decisão necessária;
- `approved`: requisitos aceitos e aptos a orientar implementação futura;
- `implemented`: critérios da SPEC implementados e validados;
- `superseded`: substituída por outra SPEC identificada;
- `retroactive`: reconstruída a partir de implementação ou registros anteriores, sem alegar anterioridade.

Mudanças de status devem refletir fatos verificáveis. O status `implemented` não deve ser aplicado apenas porque houve um commit de código; os critérios e validações precisam estar concluídos.

## Execution issues

O protocolo deve preservar evidência histórica e distinguir claramente:

- `open`: causa ainda requer ação ou decisão;
- `partially-resolved`: mitigação ou correção parcial existe, mas resta trabalho verificável;
- `resolved`: causa estrutural foi corrigida e há evidência da correção;
- `accepted-risk`: risco conhecido foi explicitamente aceito pelo responsável apropriado, com justificativa, impacto e condição/data de reavaliação;
- `not-actionable`: não há ação razoável no repositório ou no escopo atual; a evidência e o contorno permanecem registrados.

Categorias adicionais:

- `SPEC_MISSING`: uma mudança material não possui SPEC normativa aplicável;
- `SPEC_TRACEABILITY`: a SPEC existe, mas a relação cronológica, os trailers, o status ou a evidência de implementação estão incorretos ou incompletos.

Um issue não pode ser marcado como `accepted-risk` apenas por conveniência do agente. É necessária aceitação explícita de uma pessoa ou autoridade definida. Issues `resolved`, `accepted-risk` e `not-actionable` preservam o relato original e recebem evidência/decisão adicional; não devem ser apagados.

## Auditorias requeridas

### Passagem de Turno

Verificar:

- se há SPEC normativa correspondente em `SPEC/`;
- se a implementação e os commits existentes possuem rastreabilidade para uma SPEC;
- quais prompts/sessões documentam a origem do módulo;
- se é necessária uma SPEC retroativa.

Esta tarefa registra o diagnóstico, mas não cria a SPEC retroativa nem altera o módulo.

### Dependência Prisma/deepmerge-ts

Reproduzir o issue com comandos de leitura, incluindo `npm audit` e `npm ls deepmerge-ts`. Não executar correção automática forçada nem mudança principal do Prisma. Manter o issue `open` se ainda houver ação pendente; usar `accepted-risk` somente com decisão explícita e prazo/condição de revisão.

### Limitação de browser

Reavaliar o issue como limitação específica daquela execução. Se não houver correção aplicável ao repositório, usar `not-actionable` com a evidência original e o contorno preservados; não declarar retroativamente que houve inspeção visual.

## Compatibilidade entre agentes

- As regras normativas devem usar linguagem neutra quanto a fornecedor e modelo.
- `AGENTS.md` é a entrada comum para agentes no repositório.
- Adaptadores específicos de ferramenta devem ser pequenos e apontar para `AGENTS.md`, `SPEC/README.md` e os guides relevantes, sem copiar o corpo das regras.
- O template de implementação deve ser utilizável por qualquer agente e exigir `SPEC Gate`, autorização de commit, arquivos em escopo, validações e handoff.

## SPEC COMPLIANCE no handoff

Toda entrega de implementação deve incluir:

```text
SPEC COMPLIANCE: PASS | PARTIAL | BLOCKED | FAIL | N/A
SPEC Gate: NEW_SPEC | UPDATE_SPEC | EXISTING_SPEC_OK | SPEC_EXEMPT
SPEC: <caminho ou justificativa da isenção>
Evidence: <commits, arquivos, comandos e resultados relevantes>
Deviations: <nenhuma ou lista objetiva>
```

Semântica:

- `PASS`: requisitos aplicáveis e validações foram concluídos;
- `PARTIAL`: parte verificável foi entregue, com pendências explícitas que não invalidam o restante;
- `BLOCKED`: uma condição externa ou informação indispensável impede prosseguir com segurança;
- `FAIL`: requisito aplicável não foi atendido ou validação necessária falhou;
- `N/A`: somente quando a tarefa for legitimamente `SPEC_EXEMPT` ou não envolver implementação.

## Critérios de aceite

1. O `SPEC Gate` está definido de forma consistente em `AGENTS.md`, `SPEC/README.md` e `docs/AI-PLUGIN-GUIDE.md`.
2. A política diferencia criação, atualização, reutilização e isenção de SPEC com exemplos claros.
3. A autorização de commit de SPEC é explícita, limitada e não implica autorização de commit de implementação.
4. `SPEC/` é definida como normativa e `docs/modules/` como descritiva.
5. Os cinco status de SPEC e os cinco estados de execution issue estão documentados.
6. `SPEC_MISSING` e `SPEC_TRACEABILITY` estão disponíveis no protocolo de issues.
7. O issue de Prisma/deepmerge-ts possui reprodução atual e estado coerente, sem atualização principal ou correção forçada.
8. O issue de browser preserva evidência e recebe estado coerente com uma limitação específica de execução.
9. A auditoria de Passagem de Turno informa se há SPEC, rastreabilidade e necessidade de SPEC retroativa, sem mudar o módulo.
10. Existe `prompts/templates/implementation.md` curto e neutro quanto a agente.
11. Existe um adaptador pequeno para GitHub Copilot, sem duplicação extensa das regras.
12. O handoff `SPEC COMPLIANCE` está documentado com estados e evidências obrigatórias.
13. Nenhum script ou job de enforcement automático é criado nesta entrega.
14. Nenhuma funcionalidade de produto, banco, frontend ou plugin é alterada.

## Validação

- conferir o histórico e o staging do commit inicial da SPEC;
- executar `git diff --check`;
- verificar a existência dos caminhos referenciados e a consistência dos termos entre os documentos alterados;
- executar `npm run check:boundaries` como controle arquitetural compatível;
- executar `npm audit` e `npm ls deepmerge-ts` somente para reproduzir o issue de dependência;
- registrar comandos não executados ou dependentes de infraestrutura sem inventar sucesso;
- revisar o diff final para confirmar que não há mudanças de produto, automação de CI ou scripts de enforcement.
