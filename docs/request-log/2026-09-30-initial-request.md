# Registro de solicitação — Base inicial

Data: 2026-09-30

## Pedido

Criar a base de uma plataforma acadêmica modular inspirada no domínio do AELIS-NG, com aparência de ambiente operacional/"SO virtual", permitindo adicionar muitos plugins e funcionalidades até atingir uma base de código extensa.

Requisitos adicionais:

- Dividir plugins em categorias para evitar uma interface poluída.
- Manter cada plugin isolado em sua própria pasta.
- Manter o CSS de cada plugin dentro da pasta do próprio plugin quando possível.
- Facilitar implementações futuras com agentes de programação.
- Manter uma pasta que registre pedidos relevantes feitos às IAs.
- Informar qual IA realizou cada etapa.
- Registrar a quantidade de tokens gastos.

## IA responsável por esta etapa

GPT-5.6 Sol — OpenAI / ChatGPT.

## Tokens gastos

O número exato de tokens consumidos por uma resposta/conversa não é exposto ao modelo durante a execução. Portanto, registrar um valor exato aqui seria inventar um dado.

Status: **indisponível para o modelo**.

Para manter rastreabilidade objetiva, o projeto registra em seu lugar:

- data do pedido;
- IA utilizada;
- descrição da tarefa;
- arquivos produzidos;
- contador de linhas de código disponível via `npm run count:loc`.

Se futuramente a interface/API utilizada fornecer `usage.input_tokens` e `usage.output_tokens`, esses números podem ser adicionados a este arquivo automaticamente.
