# Protocolo de execution issues

Esta pasta registra problemas estruturais encontrados por agentes durante execuções. O objetivo é transformar dificuldades recorrentes em melhorias verificáveis de prompts, SPECs, guides, contratos, dependências, ferramentas e validações.

`docs/execution-issues/` não substitui `prompts/sessoes/`. Os prompts continuam sendo o registro literal das sessões; aqui fica o diagnóstico técnico do que dificultou ou comprometeu uma execução.

## Quando registrar

Registre um issue quando outro agente, executando uma tarefa semelhante, puder repetir o mesmo erro por causa de uma deficiência no ambiente de alinhamento.

Não registre:

- typo trivial corrigido imediatamente;
- erro de TypeScript ou lint criado e corrigido na mesma execução;
- tentativa intermediária normal;
- bug local sem impacto para tarefas futuras;
- log extenso sem diagnóstico estrutural.

Nunca inclua segredos, tokens, senhas, credenciais ou conteúdo de `.env`.

## Categorias

- `PROMPT_AMBIGUITY`: o prompt permite interpretações materialmente diferentes.
- `GUIDE_CONFLICT`: dois documentos fornecem instruções incompatíveis.
- `GUIDE_MISSING`: uma regra necessária não está documentada.
- `GUIDE_OUTDATED`: um guide descreve arquitetura ou fluxo que não corresponde mais ao código.
- `SPEC_MISSING`: uma mudança material não possui SPEC normativa aplicável.
- `SPEC_TRACEABILITY`: a SPEC existe, mas ordem cronológica, status, trailers ou evidências estão ausentes ou incorretos.
- `SPEC_CONFLICT`: o pedido e a SPEC existente exigem comportamentos incompatíveis.
- `REPO_DIVERGENCE`: a estrutura real diverge do que as instruções afirmam.
- `ENVIRONMENT`: problema relacionado ao ambiente local, Codespace ou sistema operacional.
- `DEPENDENCY`: dependência ausente, incompatível ou declarada no package incorreto.
- `VALIDATION`: validação obrigatória falha ou não verifica corretamente a mudança.
- `DATA_OR_INFRA`: banco, API externa ou infraestrutura necessária não está disponível.
- `TOOL_LIMITATION`: a ferramenta não oferece o recurso necessário para uma verificação relevante.
- `PERMISSION_OR_SCOPE`: a solução exigiria ultrapassar o escopo autorizado.

## Severidade e estado

Severidade:

- `blocking`: impede a conclusão segura da tarefa;
- `non-blocking`: permite prosseguir com contorno, mas reduz confiança ou eficiência.

Estado:

- `open`: a causa ainda requer ação ou decisão;
- `partially-resolved`: existe mitigação ou correção parcial, mas resta trabalho verificável;
- `resolved`: a causa estrutural foi corrigida e há evidência da correção;
- `accepted-risk`: o risco foi aceito explicitamente pela autoridade apropriada, com justificativa e condição/data de reavaliação;
- `not-actionable`: não existe ação razoável no repositório ou no escopo atual; evidência e contorno permanecem preservados.

Um agente não pode marcar um issue como `accepted-risk` por conta própria. A aceitação deve identificar quem decidiu, por quê e quando reavaliar. Issues encerrados não são apagados nem reescritos: acrescente a decisão e a evidência para preservar o histórico.

## Feedback loop

Quando a correção documental for clara e segura:

1. registre o issue;
2. corrija o guide, prompt, script ou contrato correspondente;
3. marque o issue como `resolved`;
4. descreva a correção na entrega.

Quando a correção exigir uma decisão arquitetural:

1. registre o issue;
2. não invente uma regra;
3. marque como `open` ou `partially-resolved`;
4. apresente a recomendação na entrega.

Quando o problema for específico da execução e não houver correção aplicável ao repositório:

1. preserve o relato e a evidência original;
2. registre o contorno utilizado;
3. marque como `not-actionable` e explique o limite de ação;
4. não transforme ausência de validação em sucesso retroativo.

Dependências vulneráveis permanecem `open` enquanto houver ação técnica pendente. Use `accepted-risk` somente após decisão explícita, com impacto, responsável e gatilho de revisão documentados.

## Classificação operacional no preflight

Antes da implementação material, classifique cada issue relevante para a execução atual:

- `BLOCKS_CURRENT_TASK`: afeta correção, segurança aplicável, integridade arquitetural, validação necessária, SPEC aplicável ou dados indispensáveis. Não prossiga com implementação material até resolver ou obter orientação;
- `RELATED_NON_BLOCKING`: relaciona-se à execução e deve aparecer no handoff, mas não impede o trabalho seguro;
- `OUT_OF_SCOPE`: permanece real e preservado, porém não deve ser resolvido incidentalmente nem bloquear a tarefa atual.

O estado persistente (`open`, `resolved` etc.) e a classificação operacional respondem perguntas diferentes. Um issue `open` pode ser não bloqueante ou fora de escopo.

## Regra de honestidade

Marque `resolved` somente quando a causa estrutural tiver sido corrigida ou quando evidência verificável demonstrar que a condição registrada deixou de existir. Não basta o problema não reaparecer, não ter sido reproduzido ou não bloquear a execução atual.

Preserve o relato original e acrescente a decisão de encerramento ou reavaliação. Não apague evidência histórica incompatível com o estado atual.

## Nome do arquivo

Use a data e um slug da tarefa:

```text
docs/execution-issues/AAAA-MM-DD-<tarefa>.md
```

Problemas da mesma execução podem ficar no mesmo arquivo, com IDs sequenciais.

## Template

```md
# Execution issues — <nome da tarefa>

## Contexto

- Data:
- Prompt/sessão:
- SPEC:
- Agente:
- Escopo:

---

## ISSUE-001

### Categoria

GUIDE_OUTDATED

### Severidade

blocking | non-blocking

### Etapa

descoberta | implementação | validação | build

### Problema observado

Descrição objetiva.

### Evidência

Arquivo, comando ou mensagem mínima relevante.

### O que era esperado

Regra, documentação ou comportamento que deveria ter evitado o problema.

### Impacto

O que foi impedido, atrasado ou ficou ambíguo.

### Contorno utilizado

Como a execução prosseguiu, quando aplicável.

### Correção estrutural sugerida

Documento, guide, script ou contrato que deve mudar.

### Estado

open | partially-resolved | resolved | accepted-risk | not-actionable

### Decisão e evidência de encerramento

Obrigatório para `resolved`, `accepted-risk` e `not-actionable`. Informe mudança, decisão, responsável quando aplicável, comando/arquivo de evidência e condição de reavaliação.
```

## Entrega

Toda execução material deve incluir no handoff:

### `EXECUTION ISSUES PREFLIGHT`

```text
| Issue | Estado inicial | Classificação |
```

### `EXECUTION ISSUES RECONCILIATION`

```text
| Issue | Antes | Depois | Ação | Evidência | Bloqueia próxima fase? |
```

Liste também os issues criados ou atualizados e os guides alterados. Se nenhum problema estrutural foi identificado, declare isso explicitamente sem criar um arquivo vazio de execução.

Entregas de implementação também devem incluir o bloco `SPEC COMPLIANCE` definido em `SPEC/README.md`. Execution issues complementam esse diagnóstico; não substituem o gate nem a evidência de validação.
