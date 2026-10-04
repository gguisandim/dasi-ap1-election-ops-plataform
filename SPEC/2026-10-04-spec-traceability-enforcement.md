# Enforcement de rastreabilidade de SPEC

## Status

`approved`

## Contexto

A primeira fase de governança definiu o fluxo normativo entre SPEC Gate, SPEC, implementação, validação, compliance e execution issues. Essa fase deixou enforcement automatizado explicitamente fora de escopo. A segunda fase introduz uma verificação técnica mínima, determinística e independente de LLM para validar sinais objetivos no histórico Git.

## Problema

As regras de trailers e anterioridade de SPEC dependem atualmente de revisão humana ou do comportamento voluntário do agente. Um commit funcional pode omitir o agente, apontar para um documento fora de `SPEC/`, referenciar um arquivo não versionado ou introduzir a SPEC no mesmo commit da implementação sem que exista uma verificação local padronizada.

## Objetivos

- criar um checker rápido, conservador e explicável para commits Git;
- validar trailers `Agent:` e `Spec:` em commits sujeitos à política;
- permitir isenção explícita com justificativa estruturalmente válida;
- garantir que uma SPEC referenciada esteja em `SPEC/`, seja Markdown, esteja versionada e anteceda o commit analisado;
- disponibilizar o checker por `npm run spec:check`;
- fornecer testes automatizados dos casos objetivos da V1;
- manter a implementação adequada para uso local e integração futura em CI.

## Escopo

- `scripts/check-spec-traceability.mjs`;
- testes do checker em `scripts/check-spec-traceability.test.mjs`;
- script `spec:check` em `package.json`;
- documentação mínima do uso e da política nos guides diretamente relacionados;
- registro literal do prompt em `prompts/sessoes/2026-10-04-spec-traceability-enforcement.md`;
- execution issue para limitações estruturais encontradas nesta execução, quando aplicável.

## Fora de escopo

- analisar semanticamente o diff para decidir se ele deveria possuir SPEC;
- provar automaticamente todos os casos de `UPDATE_SPEC`;
- validar qualidade ou veracidade da justificativa de isenção;
- reescrever, corrigir ou rejeitar automaticamente commits;
- adicionar job de CI nesta fase;
- alterar funcionalidades eleitorais, plugins, banco, frontend ou contratos de domínio;
- corrigir retroativamente commits históricos anteriores à adoção desta política;
- fazer commit da implementação nesta execução.

## Modelo de traceabilidade

O checker analisa uma revisão ou intervalo de revisões Git informado na linha de comando. Sem argumento, analisa `HEAD`. Para CI ou auditorias locais, aceita uma expressão única reconhecida por `git rev-list`, por exemplo:

```text
npm run spec:check -- origin/main..HEAD
npm run spec:check -- HEAD~3..HEAD
npm run spec:check -- <commit>
```

Os commits são processados em ordem cronológica e cada falha identifica o commit, a regra e a correção esperada. A V1 trabalha apenas com título, trailers e árvores Git; não lê nem interpreta semanticamente o diff.

## Commits sujeitos à política

Os tipos Conventional Commit abaixo exigem `Agent:` e `Spec:`:

- `feat`;
- `fix`;
- `refactor`;
- `perf`.

O tipo pode possuir escopo e marcador de breaking change, por exemplo `feat(shell): ...` ou `fix(api)!: ...`.

Os tipos `docs`, `chore`, `test`, `build`, `ci` e `style`, commits de merge e títulos não reconhecidos ficam isentos por tipo na V1 e podem omitir trailers. Se qualquer commit, inclusive um isento por tipo, declarar `Agent:`, `Spec:` ou `Spec-Exempt-Reason:`, o conjunto declarado passa a ser validado integralmente para evitar metadados parciais ou enganosos.

## Formato dos trailers

### Agent

Formato:

```text
Agent: <identificador>
```

O identificador aceita uma parte simples ou duas partes separadas por `/`. Cada parte pode conter letras ASCII, números, ponto, sublinhado e hífen.

Exemplos válidos:

```text
Agent: human
Agent: codex/gpt-5
Agent: claude/sonnet
Agent: opencode/deepseek
```

O checker não mantém lista de fornecedores. O trailer deve ocorrer exatamente uma vez quando exigido.

### Spec

Formato normal:

```text
Spec: SPEC/<arquivo>.md
```

O caminho deve:

- usar `/` como separador;
- ser relativo e permanecer dentro de `SPEC/`;
- terminar em `.md`;
- não conter segmentos `.` ou `..`;
- existir na árvore do commit analisado;
- existir na árvore do primeiro pai do commit analisado, provando anterioridade simples;
- ocorrer exatamente uma vez quando exigido.

Uma referência como `docs/modules/foo.md` é inválida. A existência na árvore Git comprova que o arquivo está versionado; a existência no primeiro pai impede que SPEC e implementação sejam introduzidas juntas.

## SPEC_EXEMPT

Um commit sujeito à política pode declarar isenção explícita:

```text
Agent: <identificador>
Spec: EXEMPT
Spec-Exempt-Reason: <justificativa curta>
```

Regras objetivas:

- `Agent:` continua obrigatório;
- `Spec-Exempt-Reason:` deve ocorrer exatamente uma vez e conter texto não vazio após trim;
- `Spec-Exempt-Reason:` é proibido quando `Spec:` aponta para arquivo;
- o checker não julga semanticamente a qualidade da justificativa.

## Regras do checker

Para cada commit selecionado:

1. identificar o tipo pelo título Conventional Commit;
2. decidir se o tipo exige trailers;
3. extrair trailers reconhecidos do bloco final da mensagem usando as regras do Git;
4. rejeitar ausência, duplicidade ou formato inválido de trailers obrigatórios;
5. validar `Agent:` sem impor fornecedor;
6. para `Spec: EXEMPT`, exigir justificativa;
7. para caminho de SPEC, validar sintaxe e confinamento em `SPEC/`;
8. confirmar o arquivo na árvore do commit;
9. confirmar o arquivo na árvore do primeiro pai;
10. acumular todas as falhas e encerrar com código diferente de zero se houver qualquer violação.

Erros operacionais, como revisão Git inválida ou execução fora de um repositório, também devem produzir mensagem explicável e código diferente de zero. Uma execução sem violações informa quantos commits foram verificados.

## Atualização de SPEC

A V1 não tenta determinar se uma mudança material exigia `UPDATE_SPEC`, nem prova que a versão correta da SPEC foi atualizada antes do código. Ela garante apenas que o caminho referenciado já existia em um ancestral direto e continua presente no commit. A revisão humana e o SPEC Gate permanecem responsáveis por classificar `UPDATE_SPEC`.

## Limitações

- não há inferência semântica baseada no conteúdo do diff;
- tipos não obrigatórios podem omitir trailers mesmo que uma revisão humana conclua que a mudança era material;
- a anterioridade usa o primeiro pai e não reconstrói intenções em merges complexos;
- uma SPEC preexistente pode estar desatualizada sem que a V1 detecte;
- a V1 não verifica status interno da SPEC;
- o prompt recebido para esta execução termina truncado no início da seção 13; esta SPEC não presume requisitos adicionais ausentes do texto preservado;
- CI permanece fora do escopo, embora a interface aceite ranges para integração futura.

## Critérios de aceite

1. `npm run spec:check` analisa `HEAD` por padrão.
2. Um range/revision Git pode ser fornecido após `--`.
3. `feat`, `fix`, `refactor` e `perf` sem `Agent:` ou `Spec:` falham.
4. Um `Agent:` estruturalmente válido e vendor-neutral é aceito.
5. `Spec:` fora de `SPEC/`, não Markdown, não versionado ou inexistente falha.
6. SPEC criada no mesmo commit da implementação falha por falta de anterioridade.
7. SPEC presente no primeiro pai e no commit analisado é aceita.
8. `Spec: EXEMPT` sem `Spec-Exempt-Reason:` falha.
9. `Spec-Exempt-Reason:` com caminho normal de SPEC falha.
10. Commits de tipo não obrigatório sem trailers são aceitos.
11. Trailers parciais ou duplicados falham quando declarados.
12. O checker acumula violações, apresenta mensagens acionáveis e retorna código diferente de zero.
13. Testes automatizados cobrem caminhos de sucesso, ausência de trailers, referência inválida, anterioridade e isenção.
14. Nenhuma funcionalidade eleitoral ou job de CI é alterado.

## Validação

- `npm run spec:check`;
- `npm run spec:check -- <range-de-fixture-ou-histórico-controlado>` quando aplicável;
- `npx vitest run scripts/check-spec-traceability.test.mjs`;
- `npm run check:boundaries`;
- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run build`;
- `git diff --check`;
- revisão final de staging para confirmar que nenhum commit além da SPEC foi criado.
