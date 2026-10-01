# Documentos e Evidências

Repositório operacional de evidências: fotos, comprovantes, relatórios, logs e
capturas de tela vinculados aos registros que comprovam, com integridade
verificável por SHA-256 e versionamento que nunca sobrescreve o arquivo anterior.

- **Categoria:** Operações
- **Rota raiz:** `/evidence`
- **Permissões:** `evidence.read`, `evidence.upload`, `evidence.version`, `evidence.manage`
- **Spec:** [`SPEC/2026-10-01-documents-evidence.md`](../../../SPEC/2026-10-01-documents-evidence.md)

## Páginas

| Rota | Página |
| --- | --- |
| `/evidence` | Acervo: indicadores, filtros e tabela com checksum |
| `/evidence/new` | Registro de evidência com upload |
| `/evidence/:id` | Ficha: arquivo, integridade, vínculos e timeline |
| `/evidence/:id/edit` | Metadados e vínculos |
| `/evidence/:id/versions` | Histórico de versões e comparação |
| `/evidence/gallery` | Galeria visual com ampliação |

## Armazenamento

O conteúdo binário **nunca** é gravado no PostgreSQL. O banco guarda apenas
metadados e a chave do objeto; o arquivo vive no driver configurado.

```text
EVIDENCE_STORAGE_DRIVER=local              # local | supabase | s3
EVIDENCE_STORAGE_ROOT=storage/evidence
```

`local` é o driver implementado. `supabase` e `s3` são previstos pela interface
`StorageStrategy` (`store`, `read`, `exists`, `remove`) e falham com mensagem
explícita enquanto não existir driver — nunca gravam no lugar errado por omissão.

O driver local recusa qualquer chave que escape da raiz de armazenamento, e o
nome físico do objeto é um identificador único: o nome enviado pelo usuário é
preservado apenas como metadado de exibição.

## Integridade

Todo arquivo recebe SHA-256 no momento do envio. O checksum aparece na listagem,
na ficha e no histórico de versões, e o cabeçalho `X-Evidence-Checksum` acompanha
todo download — permitindo conferir o que chegou contra o que foi registrado.
`GET /evidence/:id/integrity` aponta versões cujo objeto sumiu do armazenamento.

## Versionamento

Adicionar uma versão exige **motivo**. A anterior passa a `isCurrent = false`,
continua baixável e permanece no storage; o número é sempre `atual + 1`. Se a
transação falhar, o objeto recém-gravado é removido para que o banco nunca aponte
para um arquivo inexistente.

## Vínculos

`EvidenceLink` referencia registros por **ID opaco** — nenhum plugin é importado.
`INCIDENT`, `ASSET`, `POLLING_PLACE`, `ELECTORAL_ZONE`, `ROUTE`, `DELIVERY`,
`TRANSMISSION`, `COMMUNICATION` e `FIELD_TEAM` têm existência validada no banco
central e ganham rótulo legível; `OTHER` aceita qualquer identificador, servindo
de saída para registros ainda sem entidade própria na plataforma.

## Descarte

Evidência auditável não é apagada: **arquiva-se**. `ARCHIVED` sai das listagens
padrão, não recebe novas versões e pode ser restaurada. A exclusão física só é
permitida para evidência ativa, nunca vinculada.

## Estrutura

```text
src/
  manifest.ts / index.ts
  server/
    evidence.module.ts                    registro NestJS
    evidence.controller.ts                endpoints (multipart no upload)
    evidence.service.ts                   CRUD, busca, arquivamento, integridade
    evidence-versions.service.ts          versionamento e download
    evidence-links.service.ts             validação e resolução de vínculos
    evidence-tags.service.ts              etiquetas
    evidence-timeline.service.ts          eventos
    storage/                              StorageStrategy + driver local + serviço
    helpers/                              regras puras e testáveis
    dto/                                  validação de entrada
  client/
    pages/ components/ hooks/ services/ styles/ utils/
```

## Integrações globais

- **Event Bus:** `evidence.created`, `evidence.versioned`, `evidence.archived`,
  consumidos por Notificações.
- **Shared:** contratos em `@eops/shared/evidence`.
- **API client:** `postForm` adicionado a `@eops/api-client` para upload
  multipart, evitando `fetch` fora do cliente tipado.
- **Banco:** models `Evidence*` no `schema.prisma` central, migration
  `202610010005_documents_evidence`.

## Testes

```bash
npx vitest run plugins/operations/documents-evidence
```

Cobrem checksum, nomes e chaves de armazenamento, validação tipo/MIME, limites por
tipo, escrita e leitura no driver local, contenção de caminho, criação com código
sequencial, regras de exclusão, arquivamento idempotente, filtros, versionamento
sem sobrescrita, remoção do objeto órfão em falha de transação e integridade.
