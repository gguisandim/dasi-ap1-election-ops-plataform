# Documentos e Evidências — 2026-10-01

Etapa 2 de 6 da expansão de plugins operacionais da AP1.

## Prompt resumido

Criar o plugin **Documentos e Evidências**: um repositório operacional para
evidências (foto, documento, comprovante, relatório, log, captura de tela, outro)
associadas a incidentes, ativos, locais, rotas, entregas, transmissões, riscos e
demais registros — com metadados completos, checksum SHA-256, versionamento que
nunca sobrescreve, abstração de armazenamento fora do PostgreSQL, galeria de
evidências fotográficas com modal, busca por múltiplos filtros e permissões
separadas de visualizar, enviar, versionar e gerenciar. Sem dependência direta
entre plugins: vínculos por ID/contrato.

## Implementado

- Plugin `plugins/operations/documents-evidence` (categoria Operações).
- Evidência com título, descrição, tipo, situação, pleito, autor, origem,
  observações, data do fato, versão corrente e contagem de versões.
- Oito tipos: `PHOTO`, `DOCUMENT`, `RECEIPT`, `REPORT`, `LOG`, `SCREENSHOT`, `OTHER`
  — cada um com regra própria de tamanho; `PHOTO`/`SCREENSHOT` exigem MIME de imagem.
- **Abstração de storage** com `StorageStrategy` (`store`/`read`/`exists`/`remove`),
  driver local implementado e drivers `supabase`/`s3` previstos na resolução — um
  driver não implementado falha com mensagem explícita em vez de gravar no lugar
  errado. Nenhum binário é persistido no PostgreSQL.
- **Checksum SHA-256** calculado no envio, exibido na listagem, na ficha, no
  histórico de versões e no cabeçalho `X-Evidence-Checksum` de todo download.
- **Versionamento que nunca sobrescreve**: nova versão exige motivo, recebe o
  número seguinte, desmarca a anterior e mantém o objeto anterior no storage. Se a
  transação falhar, o objeto recém-gravado é removido — o banco nunca aponta para
  arquivo inexistente.
- Comparação visual entre a versão corrente e a anterior (tamanho, checksum,
  intervalo), incluindo aviso quando o checksum é idêntico.
- Verificação de integridade do acervo por evidência: aponta versões cujo objeto
  sumiu do armazenamento.
- Conferência manual de checksum na ficha: o usuário cola o hash calculado por
  fora e a plataforma responde íntegro/divergente.
- **Vínculos por ID opaco** (`EvidenceLink`) para incidente, ativo, local, zona,
  rota, entrega, transmissão, comunicado, equipe e registro genérico. Tipos
  conhecidos são validados no banco central e recebem rótulo legível.
- Galeria de evidências visuais com modal ampliado, navegação por teclado e
  metadados de procedência ao lado da imagem.
- Busca por tipo, situação, período, autor, entidade vinculada, etiqueta, nome e
  "somente sem vínculo".
- **Arquivamento em vez de exclusão**: evidência vinculada ou arquivada é
  preservada; exclusão física só para evidência ativa e nunca vinculada.
- Timeline com criação, upload, nova versão, edição de metadados, vínculo
  adicionado/removido, arquivamento, restauração e **download**.
- Upload multipart com `FileInterceptor`; formulário aceita `?link=TIPO:id` para
  que outras telas enviem o vínculo pré-preenchido.

## Não implementado

- Integração real com Supabase Storage ou S3: apenas a interface e a resolução de
  driver existem; os drivers não estão implementados (fora de escopo na spec).
- Geração de miniaturas no servidor, edição de imagem, OCR e antivírus.
- Diff de conteúdo entre versões (apenas comparação de metadados e checksum).
- Assinatura digital, carimbo de tempo externo, upload resumível e retenção
  automática por política.

## Arquivos

Criados:

- `SPEC/2026-10-01-documents-evidence.md` (commitada antes do código).
- `plugins/operations/documents-evidence/`: `package.json`, `README.md`,
  `src/manifest.ts`, `src/index.ts`.
- Backend: `evidence.{module,controller,service}.ts`, `evidence-versions.service.ts`,
  `evidence-links.service.ts`, `evidence-tags.service.ts`,
  `evidence-timeline.service.ts`, `storage/{storage.types,storage.service,local-storage.strategy}.ts`,
  `dto/evidence.dto.ts`, `types/index.ts` e
  `helpers/{file-metadata,evidence-type,evidence-code,evidence-link,tag-slug}.ts`.
- Frontend: 6 páginas, 11 componentes, `hooks/useEvidence.ts`,
  `services/evidenceService.ts`, `utils/{presentation,format,type-guards}.ts`,
  `styles/evidence.module.css`.
- Testes: 5 arquivos (`helpers/*.test.ts`, `storage/local-storage.strategy.test.ts`,
  `evidence.service.test.ts`, `evidence-versions.service.test.ts`).

Alterados:

- `packages/database/prisma/schema.prisma`, `packages/database/prisma/seed.ts`.
- `packages/security/src/permissions.ts`.
- `packages/shared/src/evidence.ts`, `packages/shared/src/index.ts`,
  `packages/shared/package.json`.
- `packages/event-bus/src/contracts.ts`.
- `packages/api-client/src/index.ts` (método `postForm` para multipart).
- `apps/api/src/app.module.ts`, `apps/web/src/pluginRegistry.ts`,
  `apps/web/package.json`.
- `plugins/system/notifications/src/server/notification.subscriber.ts`.
- `.gitignore` e `.env.example` (raiz de armazenamento local).

## Banco

Enums adicionados: `EvidenceType`, `EvidenceStatus`, `EvidenceLinkType`,
`EvidenceEventType`.

Models adicionados: `Evidence`, `EvidenceVersion`, `EvidenceLink`, `EvidenceTag`,
`EvidenceTagLink`, `EvidenceEvent`. Back-relation `evidences` em `Election`.

Índices relevantes: `[type, status]`, `[electionId, status]`, `[authorId]`,
`[createdAt]`, `[capturedAt]`, `[evidenceId, createdAt]`, `[checksum]`,
`[isCurrent]`, `[type, targetId]`; únicos em `code`, `(evidenceId, number)`,
`(evidenceId, type, targetId)`, `(evidenceId, tagId)`, `label`/`slug` de etiqueta.

Migration `202610010005_documents_evidence`: puramente aditiva — verificada por
ausência de `DROP TABLE`, `DROP COLUMN`, `DROP TYPE` e `ALTER COLUMN`. Gerada por
`prisma migrate diff` e aplicada com `npm run db:migrate:deploy`.

## Backend

Serviços separados por responsabilidade: `evidence.service` (CRUD, busca, painel,
arquivamento, integridade), `evidence-versions.service` (versionamento, download,
verificação), `evidence-links.service` (validação e resolução de vínculos),
`evidence-tags.service`, `evidence-timeline.service` e `StorageService` com
resolução de driver. DTOs com validação real, incluindo parsing de arrays em
multipart.

23 endpoints: listagem, painel, galeria, dados de apoio, etiquetas (listar/criar),
detalhe, timeline, integridade, versões, download da versão corrente e de versão
específica, criação com arquivo, adição de versão, edição de metadados,
substituição de vínculos, arquivamento, restauração e exclusão restrita.

## Frontend

Páginas: acervo, nova evidência, ficha, edição, versões e galeria.

Componentes: `EvidenceBadges` (tipo/situação/vínculo/chip), `EvidenceFilters`,
`EvidenceTable`, `EvidenceCard`, `EvidenceSummaryCards`, `EvidenceThumbnail`
(miniatura por blob autenticado), `EvidenceGallery`, `EvidenceLightbox`,
`EvidenceUploadForm`, `EvidenceMetadataForm`, `EvidenceLinkEditor`,
`EvidenceVersionList` + `EvidenceVersionForm`, `TagInput` e `EvidenceTimeline`.

Hooks: listagem, galeria, painel, detalhe, dados de apoio, URL de blob com
revogação de memória e estado de upload com validação local de tamanho/tipo.

## Segurança

`evidence.read`, `evidence.upload`, `evidence.version`, `evidence.manage` no
catálogo e no seed. ADMIN/SUPERVISOR recebem as quatro; OPERATOR recebe
`read`/`upload`/`version`; TECHNICIAN recebe `read`/`upload`; VIEWER recebe `read`.

## Event Bus

`evidence.created`, `evidence.versioned`, `evidence.archived`. Consumidos por
Notificações. `evidence.read` (download) não foi criado como evento global por ser
ruído: o registro de download já entra na timeline da própria evidência.

## Shared

`packages/shared/src/evidence.ts` exposto como `@eops/shared/evidence` (exports do
package e barrel atualizados).

## Registros globais

- **AppModule:** `DocumentsEvidenceModule` registrado.
- **pluginRegistry:** `documentsEvidencePlugin` em Operações, rota `/evidence`,
  ícone `▤`, permissão `evidence.read`; dependência adicionada em
  `apps/web/package.json`.
- **Seed:** 3 etiquetas e 1 evidência demonstrativa com 2 vínculos (incidente
  `INC-00001` e o primeiro local de votação), 1 versão com checksum SHA-256 real e
  3 eventos de timeline. O arquivo demonstrativo é textual — o seed não embute
  binários no repositório. Protegido por verificação de existência: idempotente.
- **API client:** `postForm` adicionado para upload multipart, evitando `fetch`
  fora do cliente tipado.
- **Notificações:** assinante passou a consumir os três eventos de evidência.

## Testes

`npx vitest run plugins/operations/documents-evidence` → **5 arquivos, 52 testes, todos aprovados.**

Cobrem: SHA-256 conhecido e reprodutibilidade, extração de extensão, saneamento de
nome original (incluindo travessia de diretório e caracteres de controle), geração
de nome físico único, organização por ano/mês, formatação de tamanho, validação
tipo/MIME, limites por tipo, reconhecimento de MIME, gravação e leitura no driver
local, contenção de chave fora da raiz, conteúdo ausente, remoção idempotente,
criação com código sequencial e autor, rejeição de pleito inexistente, parsing de
vínculos, regras de exclusão, arquivamento idempotente, filtros (tipo, período,
vínculo, sem vínculo, busca), exposição de checksum, versionamento sem sobrescrita,
desmarcação da versão anterior, remoção do objeto órfão em falha de transação,
download auditado e relatório de integridade.

**Defeito real encontrado e corrigido pelos testes:** o `catch` do driver local
mascarava a recusa de chave que escapa da raiz, reportando-a como "arquivo não
encontrado". A validação de contenção passou a rodar fora do `try` em `read`,
`exists` e `remove`, para que uma tentativa de acesso indevido não seja
confundida com ausência de arquivo.

## Pendências

Nenhuma pendência funcional do plugin.

Infraestrutura: as quedas de conexão com o Supabase (`P1001` e esgotamento do pool)
já documentadas na etapa 1 continuaram durante esta etapa e provocaram reexecução
do `db:seed`, que concluiu com sucesso. Nenhuma verificação HTTP adicional foi
tentada por se tratar de instabilidade externa já conhecida.

## LOC

`npm run count:loc`:

| Momento | Arquivos | Linhas |
| --- | --- | --- |
| Baseline (antes da etapa 1) | 287 | 12.253 |
| Após a etapa 1 | 343 | 20.489 |
| Após a etapa 2 | 396 | 26.720 |
| Diferença da etapa 2 | +53 | **+6.231** |

## IA

`DeepSeek`

## Modelo

`deepseek-flash[1m]`

## Tokens

`indisponível`

## Próxima etapa

Etapa 3 — Base de Conhecimento / Runbooks
(`plugins/operations/knowledge-runbooks`).
