# Sessões e prompts — fonte de verdade

Esta pasta deve guardar exportações **literais** das sessões usadas para programar o projeto. Não reescreva prompts depois do fato. Inclua mensagens curtas como “continue”, correções e tentativas que falharam.

## O que já foi recuperado

- `2026-09-30-codex-etapas-1-4-prompt-e-registro.md`: contém o prompt literal preservado dentro do request-log da execução.
- `2026-10-01-codex-raw-session.md`: export bruto parcial da sessão Codex das etapas 5–9.

## O que ainda precisa ser importado da máquina

Execute `scripts/coletar-sessoes-codex.ps1`. Ele procura sessões no diretório local do Codex e copia somente arquivos que mencionam este projeto para `prompts/sessoes/codex-export/`. Revise antes do commit para garantir que não há segredos.

Os arquivos em `prompts/resumos/` são apenas resumos históricos e **não substituem** exportações literais.
