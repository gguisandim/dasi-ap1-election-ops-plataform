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

- `resolved`: causa estrutural corrigida nesta execução;
- `partially-resolved`: existe contorno ou correção parcial;
- `open`: depende de decisão, infraestrutura ou trabalho posterior.

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

resolved | partially-resolved | open
```

## Entrega

Toda entrega que use este protocolo deve listar os issues criados e informar quais guides foram atualizados. Se nenhum problema estrutural foi identificado, declare isso explicitamente sem criar um arquivo vazio de execução.
