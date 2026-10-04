# SPEC — referência canônica

Esta pasta contém as especificações normativas da Election Ops Platform. Uma SPEC define intenção, escopo, requisitos, critérios de aceite e validação. Documentos em `docs/modules/` descrevem módulos, prompts registram solicitações e o código mostra o estado implementado; nenhum deles substitui uma SPEC normativa.

## SPEC Gate

Antes da primeira alteração de implementação, classifique a tarefa em exatamente uma opção:

| Classificação | Quando usar | Ação obrigatória |
| --- | --- | --- |
| `NEW_SPEC` | Nova funcionalidade, contrato, regra operacional, governança normativa ou mudança material ainda não coberta | Criar e commitar a SPEC antes da implementação |
| `UPDATE_SPEC` | A SPEC existe, mas requisito, aceite ou escopo material mudou | Atualizar e commitar a SPEC antes da implementação afetada |
| `EXISTING_SPEC_OK` | Uma SPEC existente cobre integralmente a tarefa | Informar e reutilizar o caminho da SPEC |
| `SPEC_EXEMPT` | Investigação somente leitura, correção editorial sem mudança semântica ou manutenção puramente mecânica | Registrar justificativa objetiva |

Não use `SPEC_EXEMPT` para mudanças em UI, API, contrato, banco, permissão, fluxo operacional, regra de negócio ou regra normativa de governança.

Exemplos:

- novo dashboard operacional: `NEW_SPEC`;
- mudança nos estados aceitos por uma API já especificada: `UPDATE_SPEC`;
- correção de uma implementação que diverge de critério inequívoco da SPEC: `EXISTING_SPEC_OK`;
- ajuste de typo sem mudança de sentido: `SPEC_EXEMPT`.

## Ordem obrigatória

1. executar o preflight e preservar o working tree;
2. declarar `SPEC_GATE` e `SPEC` (ou a justificativa de isenção);
3. criar ou atualizar a SPEC, quando aplicável;
4. obter autorização explícita para qualquer `git add` ou `git commit`;
5. commitar somente a SPEC autorizada antes da primeira alteração de implementação;
6. implementar em escopo restrito;
7. validar de forma compatível com a mudança;
8. entregar o diagnóstico `SPEC COMPLIANCE`.

Se o requisito mudar materialmente durante a implementação, pare a parte afetada, classifique como `UPDATE_SPEC`, atualize e commite a SPEC antes de prosseguir.

## Política de commit da SPEC

A existência desta regra não concede permissão para usar Git de forma mutável. Um agente só pode executar `git add` e `git commit` com autorização explícita do usuário.

Quando a autorização for limitada ao commit inicial da SPEC:

- faça staging somente da SPEC indicada;
- revise `git status --short`, `git diff --cached --check` e os arquivos staged;
- use o formato e os trailers de `docs/COMMIT-GUIDE.md`;
- não commite a implementação;
- não faça push, rebase, squash, reset, restore, force-push ou outra reescrita sem autorização própria.

Formato recomendado:

```text
docs(spec): define <mudança>

Agent: <ferramenta/modelo-real-ou-indisponivel>
Spec: SPEC/<arquivo>.md
```

O commit da SPEC deve aparecer no histórico antes do primeiro commit de implementação correspondente. Não reescreva o histórico para fabricar anterioridade.

## Enforcement técnico

Execute:

```bash
npm run spec:check
```

O checker analisa `HEAD` por padrão. Para validar mais de um commit:

```bash
npm run spec:check -- <base>..HEAD
```

Na V1, commits `feat`, `fix`, `refactor` e `perf` exigem exatamente um trailer `Agent:` e um `Spec:`. O caminho de SPEC deve seguir `SPEC/<arquivo>.md`, estar versionado no commit e já existir em seu primeiro pai.

Uma isenção explícita usa:

```text
Agent: <identificador>
Spec: EXEMPT
Spec-Exempt-Reason: <justificativa curta>
```

O checker exige a justificativa, mas não avalia sua qualidade semântica. Commits de outros tipos podem omitir trailers; se declararem qualquer trailer da política, o conjunto inteiro será validado. A V1 não infere intenção pelo diff nem prova todos os casos de `UPDATE_SPEC`. A regra normativa completa está em `SPEC/2026-10-04-spec-traceability-enforcement.md`.

## Status

Toda SPEC deve declarar um destes estados:

- `proposed`: requisitos documentados e ainda sujeitos a aprovação ou decisão;
- `approved`: requisitos aceitos e aptos a orientar implementação;
- `implemented`: critérios implementados e validados com evidência;
- `superseded`: substituída por outra SPEC identificada;
- `retroactive`: reconstruída a partir de implementação ou registros anteriores.

Uma SPEC `retroactive` deve citar as fontes de reconstrução e declarar que não antecedeu o código. Ela não justifica rebase, squash ou force-push. O estado `implemented` exige critérios e validações concluídos, não apenas a existência de um commit de código.

## SPEC versus documentação de módulo

- `SPEC/`: fonte normativa para mudanças e rastreabilidade de commits funcionais;
- `docs/modules/`: descrição do módulo e contexto de operação/manutenção;
- `prompts/sessoes/`: registro literal das solicitações e sessões;
- código e histórico Git: evidência do que foi implementado e quando.

Se uma funcionalidade antiga tiver apenas documentação descritiva, avalie uma SPEC `retroactive`. Preserve o histórico real e registre eventual ausência ou falha de rastreabilidade conforme `docs/execution-issues/README.md`.

## Handoff — SPEC COMPLIANCE

Toda entrega de implementação deve terminar com:

```text
SPEC COMPLIANCE: PASS | PARTIAL | BLOCKED | FAIL | N/A
SPEC Gate: NEW_SPEC | UPDATE_SPEC | EXISTING_SPEC_OK | SPEC_EXEMPT
SPEC: <caminho ou justificativa da isenção>
Evidence: <commits, arquivos, comandos e resultados relevantes>
Deviations: <nenhuma ou lista objetiva>
```

- `PASS`: requisitos aplicáveis e validações foram concluídos;
- `PARTIAL`: parte verificável foi entregue, com pendências explícitas;
- `BLOCKED`: condição externa ou informação indispensável impede prosseguir;
- `FAIL`: requisito aplicável não foi atendido ou validação necessária falhou;
- `N/A`: somente para tarefa legitimamente isenta ou sem implementação.

## Material retroativo existente

As SPECs reconstruídas em 2026-10-01 a partir de código e request logs são retroativas. Elas não devem ser usadas para alegar que antecederam commits já realizados.
