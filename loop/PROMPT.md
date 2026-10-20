# Prompt operacional — uma sessão do loop de verificação

Use este prompt em **uma sessão nova e independente do agente por tentativa**. A atividade é manual: o gatilho é uma alteração de código no repositório, simulada pelo desenvolvedor. Não configure nem execute gatilhos automáticos.

## Objetivo desta sessão

Execute somente uma tentativa delimitada de verificação da integridade do repositório, ou uma correção mínima permitida quando houver uma falha concreta e autorização humana explícita para essa correção. Leia o estado persistido em `loop/ESTADO.md` antes de agir e registre nele apenas fatos observados nesta sessão. Não use contexto conversacional de tentativas anteriores; use somente as evidências persistidas.

## Instruções

1. Leia `AGENTS.md`, `SPEC/README.md`, `SPEC/2026-10-20-agent-verification-loop.md`, este arquivo e `loop/ESTADO.md`. Leia outros arquivos somente quando forem estritamente necessários para entender uma falha concreta em escopo permitido.
2. Confirme que o estado permite uma nova tentativa e que o limite de três sessões não foi atingido. Faça o preflight com `git status --short`; registre o resultado e preserve todas as alterações preexistentes. Não sobrescreva trabalho de terceiros.
3. Registre o identificador do gatilho manual, o número desta tentativa, o objetivo delimitado e a classificação do SPEC Gate aplicável. Para esta atividade coberta pela SPEC aprovada, use `EXISTING_SPEC_OK`, salvo se uma mudança material de requisito exigir interromper e aplicar o Gate.
4. Se esta tentativa for somente de verificação, não faça alterações. Se houver falha concreta, proponha uma correção mínima, identificando a evidência e os arquivos diretamente relacionados. **Não aplique a correção sem autorização humana explícita**; sem autorização, registre a proposta e escale.
5. Não altere testes, verificadores, critérios de aprovação, zonas proibidas ou arquivos fora do escopo autorizado. Não faça commit, push, rebase, reset ou outra alteração de histórico.
6. Ao encerrar sua sessão, registre em `loop/ESTADO.md` os arquivos tocados (ou “nenhum”), motivos, evidências e limitações. Não invente ou antecipe resultados. Não inicie outra sessão e não decida sozinho que o loop passou.

## Verificação independente e verificadores obrigatórios

**Depois que esta sessão terminar**, o desenvolvedor, como porteiro humano independente, executa e registra os seis comandos abaixo em cada rodada, nesta ordem:

```text
npm run spec:check
npm run check:boundaries
npm run typecheck
npm run lint
npm test
npm run build
```

Uma falha não autoriza omitir os comandos seguintes. Para cada comando, registre o comando literal, o exit code e um resumo do resultado. Se não puder ser iniciado por causa externa, registre `BLOQUEADO` e a justificativa; continue os demais quando for seguro e possível. Uma rodada bloqueada nunca é `PASSOU`.

## Decisão do porteiro

- **`PASSOU`** somente se todos os seis comandos terminarem com exit code `0`, não houver testes apagados/desabilitados nem alterações proibidas e todas as mudanças respeitarem a SPEC Gate e o escopo autorizado. O resultado pode ser encaminhado à revisão humana; não autoriza commit ou push.
- **`TENTAR_NOVAMENTE`** somente quando houver falha real corrigível em escopo permitido, progresso plausível, autorização humana para a ação e sessões restantes. A próxima tentativa deve usar uma nova sessão independente.
- **`ESCALAR`** em caso de ambiguidade material, falha de ambiente/bloqueio, necessidade de tocar zona proibida, ausência de autorização, falta de progresso ou esgotamento das três tentativas.

Duas tentativas consecutivas com a mesma falha essencial e sem melhoria objetiva exigem escalação antes da terceira. Considere repetida a falha do mesmo comando com a mesma identificação verificável (por exemplo, nome do teste ou diagnóstico com arquivo e linha). Há melhoria objetiva se essa falha deixar de ocorrer ou se a quantidade de ocorrências diminuir; mudança apenas de redação ou ordem no log não é melhoria. Três tentativas sem aprovação também exigem encerramento e escalação.

Quando o loop terminar, registre em `diario/2026-10-13.md` onde parou, as limitações e qual componente seria automatizado primeiro, conforme a SPEC. Identifique a data real da execução quando diferente da data indicada no nome do arquivo. Não escreva esse registro como se o loop tivesse ocorrido antes de sua execução.

## Zonas proibidas para correção autônoma

- `.github/workflows/` e configuração de CI;
- `.env`, chaves, tokens, credenciais e outros segredos;
- migrações, schema, seeds e outros arquivos sensíveis em `packages/database/prisma/`;
- autenticação, autorização, RBAC e contratos de segurança;
- scripts e configurações de testes, lint, typecheck, fronteiras, SPEC checker e critérios de aprovação;
- `AGENTS.md`, `SPEC/README.md` e SPECs existentes, exceto em fluxo específico de atualização normativa autorizado;
- qualquer módulo fora do escopo delimitado da falha.

Se a correção exigir qualquer zona proibida, pare sem modificar o arquivo e proponha a intervenção ao humano. Uma atualização material de SPEC também interrompe a parte afetada: aplique o SPEC Gate e obtenha autorização para o commit normativo antes de retomar a implementação.
