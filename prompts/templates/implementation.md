# Template — implementação

## Objetivo

<resultado esperado>

## SPEC Gate

- Classificação: `NEW_SPEC | UPDATE_SPEC | EXISTING_SPEC_OK | SPEC_EXEMPT`
- SPEC ou justificativa: `<caminho ou motivo>`
- Autorização de commit: `<nenhuma | somente SPEC | escopo explícito>`

## Escopo

- Arquivos/domínios permitidos: `<lista curta>`
- Fora de escopo: `<lista curta>`
- Restrições e contratos: `<itens essenciais>`

## Execution Issues Preflight

| Issue | Estado inicial | Classificação |
| --- | --- | --- |
| `<issue relevante>` | `open | partially-resolved | resolved | accepted-risk | not-actionable` | `BLOCKS_CURRENT_TASK | RELATED_NON_BLOCKING | OUT_OF_SCOPE` |

## Aceite e validação

- Critérios: `<resultados verificáveis>`
- Comandos: `<validações aplicáveis>`
- Estados alternativos: `<loading/error/empty/unavailable, quando aplicável>`

## Handoff obrigatório

```text
SPEC COMPLIANCE: PASS | PARTIAL | BLOCKED | FAIL | N/A
SPEC Gate: <classificação>
SPEC: <caminho ou justificativa>
Evidence: <commits, arquivos, comandos e resultados>
Deviations: <nenhuma ou lista objetiva>
```

```text
EXECUTION ISSUES RECONCILIATION
| Issue | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |
```
