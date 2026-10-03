# SPEC — Especificações do produto

Esta pasta concentra as especificações funcionais da AP1.

## Regra a partir de agora

Para qualquer funcionalidade nova:

1. criar/atualizar a spec;
2. fazer commit da spec **antes** do código;
3. gerar plano/tarefas com a IA;
4. implementar;
5. seguir `docs/COMMIT-GUIDE.md`;
6. usar título `tipo(escopo): resumo` e trailers no commit de implementação:

```text
feat(<escopo>): <resumo objetivo>

Agent: codex/<modelo-real-ou-indisponivel>
Spec: SPEC/<arquivo>.md
```

Commits devem ser atômicos e respeitar o isolamento por plugin/domínio. A SPEC deve aparecer no histórico antes do primeiro commit de implementação correspondente.

## Material retroativo

As specs presentes inicialmente nesta pasta foram reconstruídas em 2026-10-01 a partir de código e request logs. Elas estão marcadas explicitamente como retroativas e não devem ser usadas para alegar que antecederam commits já feitos. Isso preserva o histórico real, sem rebase/force-push.
