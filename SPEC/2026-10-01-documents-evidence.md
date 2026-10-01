# Documentos e Evidências — especificação

- **Data:** 2026-10-01
- **Status:** escrita antes do código de implementação
- **Plugin:** `plugins/operations/documents-evidence`
- **Categoria:** Operações

## O quê e por quê

### Problema

As evidências da operação eleitoral — foto de uma urna danificada, comprovante de
entrega assinado, relatório de falha de transmissão, captura de tela de um erro —
não têm onde viver. Ficam em celulares, pastas locais e conversas, sem vínculo com
o registro operacional correspondente e sem garantia de integridade. Consequências:

1. **evidência sem contexto** — um arquivo solto não diz a qual incidente, local
   ou entrega pertence;
2. **integridade não verificável** — não há como provar que o arquivo não foi
   alterado depois de arquivado;
3. **substituição silenciosa** — uma nova versão sobrescreve a anterior sem
   histórico, destruindo a trilha de auditoria.

### Motivação

Fornecer um repositório operacional de evidências com vínculo explícito ao registro
que elas comprovam, checksum SHA-256 para integridade e versionamento que nunca
sobrescreve silenciosamente.

### Usuários

| Perfil | Necessidade |
| --- | --- |
| Equipe de campo | Enviar foto ou comprovante vinculado a um local/incidente |
| Supervisão | Consultar evidências por tipo, período, autor e entidade vinculada |
| Auditoria | Verificar integridade (checksum) e reconstruir o histórico de versões |
| Administração | Arquivar evidências obsoletas sem apagar o histórico |

### Valor operacional

- Um incidente passa a ter prova anexada e recuperável por busca.
- O checksum permite detectar corrupção ou substituição do arquivo.
- O versionamento preserva a versão anterior, o motivo da alteração e o autor.

## Critérios de aceitação

1. É possível registrar uma evidência com título, descrição, tipo, arquivo, tags,
   origem, data do fato e observações.
2. O arquivo é gravado fora do PostgreSQL, por uma abstração de storage com
   implementação local e interface preparada para Supabase Storage/S3.
3. Todo arquivo recebe checksum SHA-256 calculado no momento do upload.
4. Cada evidência possui uma versão **atual**; a versão anterior permanece
   consultável e baixável.
5. Uma nova versão exige motivo da alteração e incrementa a numeração.
6. Uma evidência pode ser vinculada a incidente, ativo, local de votação, zona,
   rota, entrega, transmissão, risco, comunicado ou equipe — por ID opaco, sem
   importar implementação de outro plugin.
7. Vínculos com entidades conhecidas são validados e recebem rótulo de exibição.
8. Evidências fotográficas possuem galeria com miniatura, modal ampliado e
   metadados.
9. A busca filtra por tipo, período, autor, entidade vinculada, etiqueta e nome.
10. Evidência auditável não sofre exclusão física: arquiva-se e restaura-se.
11. `npm run check:boundaries`, `npm run typecheck`, `npm run lint` e `npm run build`
    passam.

## Fora do escopo

- Integração real com Supabase Storage ou S3. O driver local é o implementado; a
  interface existe para os demais, e um driver não configurado falha com mensagem
  explícita em vez de silenciosamente.
- Edição de imagem, geração de miniaturas no servidor, OCR e antivírus.
- Versionamento de conteúdo textual dentro do arquivo (diff).
- Assinatura digital e carimbo de tempo externo.
- Exclusão em massa e retenção automática por política.
- Upload resumível / arquivos acima do limite configurado.

## Domínio

### Entidades

| Entidade | Papel |
| --- | --- |
| `Evidence` | Registro operacional: título, descrição, tipo, autor, origem, data do fato, status |
| `EvidenceVersion` | Arquivo versionado: número, nome original, extensão, MIME, tamanho, checksum, chave de storage, motivo |
| `EvidenceLink` | Vínculo tipado com um registro operacional, por ID opaco |
| `EvidenceTag` / `EvidenceTagLink` | Etiquetas reutilizáveis e sua relação N:N |
| `EvidenceEvent` | Timeline: criação, upload, nova versão, edição de metadados, vínculo, arquivamento |

### Enums

- `EvidenceType`: `PHOTO`, `DOCUMENT`, `RECEIPT`, `REPORT`, `LOG`, `SCREENSHOT`, `OTHER`
- `EvidenceStatus`: `ACTIVE`, `ARCHIVED`
- `EvidenceLinkType`: `INCIDENT`, `ASSET`, `POLLING_PLACE`, `ELECTORAL_ZONE`, `ROUTE`, `DELIVERY`, `TRANSMISSION`, `RISK`, `COMMUNICATION`, `FIELD_TEAM`, `OTHER`
- `EvidenceEventType`: `CREATED`, `UPLOADED`, `VERSION_ADDED`, `METADATA_UPDATED`, `LINK_ADDED`, `LINK_REMOVED`, `ARCHIVED`, `RESTORED`, `DOWNLOADED`

### Regras de negócio

1. **Código**: `EVD-00001`, sequencial e único.
2. **Criação** exige arquivo; a versão `1` é criada junto com a evidência e marcada
   como atual.
3. **Nova versão**: `number = atual + 1`; a anterior passa a `isCurrent = false` e
   **nunca** é removida nem sobrescrita. `reason` é obrigatório.
4. **Checksum**: SHA-256 do conteúdo binário, em hexadecimal minúsculo. Repetir o
   mesmo conteúdo produz o mesmo checksum — base da detecção de alteração.
5. **Integridade de formato**: o tipo `PHOTO`/`SCREENSHOT` aceita apenas MIME de
   imagem; o tipo declarado e o MIME real precisam ser compatíveis.
6. **Vínculos**: `(evidenceId, type, targetId)` é único. Tipos conhecidos são
   validados contra o banco central e recebem rótulo; `OTHER` aceita qualquer ID.
7. **Arquivamento** é o caminho de descarte: `ARCHIVED` sai das listagens padrão e
   não recebe novas versões, mas continua consultável e restaurável.
8. **Exclusão física** só é permitida enquanto a evidência nunca teve vínculo nem
   foi arquivada — evidência auditável é preservada.
9. **Download** é registrado na timeline.

## Interface

| Página | Rota |
| --- | --- |
| Busca e listagem | `/evidence` |
| Nova evidência | `/evidence/new` |
| Detalhe | `/evidence/:id` |
| Edição de metadados e vínculos | `/evidence/:id/edit` |
| Versões | `/evidence/:id/versions` |
| Galeria de evidências fotográficas | `/evidence/gallery` |

## Backend

```text
GET    /evidence                       listagem paginada com filtros
GET    /evidence/dashboard             indicadores do acervo
GET    /evidence/types                 metadados dos tipos (rótulo, aceita imagem)
GET    /evidence/tags                  etiquetas com contagem de uso
POST   /evidence/tags                  cria/recupera etiqueta
GET    /evidence/:id                   detalhe com versões, vínculos e timeline
GET    /evidence/:id/versions          versões
GET    /evidence/:id/timeline          timeline
GET    /evidence/:id/file              baixa o arquivo da versão atual
GET    /evidence/:id/versions/:versionId/download   baixa uma versão específica
POST   /evidence                       cria evidência com arquivo (multipart)
POST   /evidence/:id/versions          adiciona versão com arquivo (multipart)
PATCH  /evidence/:id                   atualiza metadados e etiquetas
PUT    /evidence/:id/links             substitui vínculos
POST   /evidence/:id/archive           arquiva
POST   /evidence/:id/restore           restaura
DELETE /evidence/:id                   exclui apenas evidência sem vínculo
```

## Eventos

| Evento | Quando |
| --- | --- |
| `evidence.created` | Evidência registrada com a primeira versão |
| `evidence.versioned` | Nova versão adicionada |
| `evidence.archived` | Evidência arquivada |

## Permissões

| Permissão | Uso |
| --- | --- |
| `evidence.read` | Consultar, buscar, ver galeria e baixar arquivos |
| `evidence.upload` | Registrar novas evidências |
| `evidence.version` | Adicionar versões a evidências existentes |
| `evidence.manage` | Editar metadados, gerenciar vínculos, arquivar, restaurar e excluir |

## LOC / completude

Backend separado por responsabilidade (evidências, versões, vínculos, timeline,
storage), storage como abstração com driver local, DTOs com validação real,
helpers puros testáveis, componentes de UI reutilizáveis, galeria com modal,
CSS Module próprio e testes das regras críticas — sem código morto.
