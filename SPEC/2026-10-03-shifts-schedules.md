# Escalas e Turnos

**Data:** 2026-10-03  
**Status:** Implementado  
**Plugin:** `plugins/operations/shifts`

## 1. Objetivo

Disponibilizar gerenciamento operacional de escalas e turnos para organização das equipes envolvidas na operação eleitoral.

O módulo deve permitir acompanhar cobertura, presença, ausência, sobreaviso, substituições e conflitos mantendo histórico operacional e isolamento entre plugins.

## 2. Escopo

O módulo contempla:

- criação e atualização de turnos;
- dashboard;
- listagem;
- detalhes;
- alocação de operadores/membros;
- presença;
- ausência;
- sobreaviso;
- acionamento de sobreaviso;
- substituição;
- detecção de conflitos de horário;
- cálculo de cobertura;
- alertas de cobertura insuficiente;
- histórico de alterações;
- filtros;
- integração com RBAC;
- Event Bus;
- auditoria.

## 3. Estrutura

Frontend:

```text
plugins/operations/shifts/src/client
```

Backend:

```text
plugins/operations/shifts/src/server
```

Regras operacionais:

```text
plugins/operations/shifts/src/server/shift-rules.ts
```

Testes:

```text
plugins/operations/shifts/src/server/shift-rules.test.ts
```

Migration:

```text
packages/database/prisma/migrations/
202610010006_shifts_schedules/migration.sql
```

## 4. Dashboard

Endpoint:

```http
GET /api/shifts/dashboard
```

O dashboard deve utilizar dados calculados no backend.

Cobertura operacional não deve ser duplicada como regra no frontend.

## 5. Referências

Endpoint:

```http
GET /api/shifts/references
```

Dados necessários para criação de turnos e alocações devem ser obtidos através desse contrato ou de contratos públicos equivalentes.

## 6. Turnos

Endpoints:

```http
GET   /api/shifts
GET   /api/shifts/:id
POST  /api/shifts
PATCH /api/shifts/:id
```

O módulo deve permitir:

- criação;
- consulta;
- atualização;
- filtragem;
- navegação para detalhes.

## 7. Alocações

Endpoint:

```http
POST /api/shifts/:id/assignments
```

As regras de alocação pertencem ao backend.

Conflitos de horário devem ser verificados antes de confirmar alocações incompatíveis.

## 8. Presença

Endpoint:

```http
POST /api/shifts/:id/assignments/:assignmentId/presence
```

Deve registrar presença de forma persistente e auditável.

## 9. Ausência

Endpoint:

```http
POST /api/shifts/:id/assignments/:assignmentId/absence
```

Ausências devem impactar o cálculo operacional de cobertura quando aplicável.

## 10. Sobreaviso

Endpoint:

```http
POST /api/shifts/:id/assignments/:assignmentId/on-call/activate
```

O sistema deve permitir acionamento de integrante em sobreaviso de acordo com as regras do domínio.

## 11. Substituição

Endpoint:

```http
POST /api/shifts/:id/assignments/:assignmentId/replace
```

A substituição deve preservar histórico e aplicar novamente verificações de conflito necessárias.

## 12. Ciclo de vida

Endpoints:

```http
POST /api/shifts/:id/start
POST /api/shifts/:id/complete
POST /api/shifts/:id/cancel
```

As transições devem ser controladas pelo backend.

## 13. Cobertura operacional

A cobertura deve ser calculada, e não mantida como valor duplicado arbitrariamente.

A implementação deve identificar situações de cobertura insuficiente e permitir que a interface apresente alertas correspondentes.

As regras ficam concentradas em:

```text
shift-rules.ts
```

e/ou no service do domínio.

## 14. Conflitos

A implementação deve impedir ou sinalizar alocações incompatíveis.

Exemplos de situações relevantes:

- sobreposição de turnos;
- participante já comprometido em outro turno;
- substituição incompatível;
- cobertura insuficiente.

A decisão final pertence à regra de domínio no backend.

## 15. Histórico

Mudanças relevantes devem permitir rastreabilidade.

Exemplos:

- criação;
- alteração;
- inclusão de membro;
- presença;
- ausência;
- acionamento;
- substituição;
- início;
- conclusão;
- cancelamento.

## 16. RBAC

Ações devem respeitar permissões existentes em:

```text
packages/security
```

O backend deve aplicar a autorização, não apenas o frontend.

## 17. Event Bus e auditoria

O módulo pode publicar eventos relativos a mudanças operacionais.

Plugins consumidores, como auditoria e notificações, devem reagir via Event Bus.

Não é permitido:

```text
shifts → audit/src/**
shifts → notifications/src/**
```

## 18. Isolamento

Também é proibido importar diretamente implementação interna de:

- equipes de campo;
- tarefas;
- checklist;
- handover;
- qualquer outro plugin.

Use contratos e IDs públicos.

## 19. Interface

O plugin deve possuir navegação própria com:

- dashboard;
- listagem;
- criação;
- detalhe.

Os estilos específicos permanecem em CSS Module dentro do plugin.

## 20. Relação com Passagem de Turno

Passagem de Turno é um domínio relacionado, porém não deve ser absorvido automaticamente por este módulo.

Integrações futuras devem ocorrer por contratos explícitos.

Caso o plugin de handover seja implementado, relações Prisma devem possuir ambos os lados corretamente definidos e não devem gerar acoplamento entre implementações frontend/backend dos plugins.

## 21. Critérios de aceite

A implementação é considerada válida quando:

- turno pode ser criado;
- turno pode ser atualizado;
- dashboard funciona;
- listagem e filtros funcionam;
- detalhe funciona;
- membros podem ser alocados;
- conflitos são detectados;
- presença funciona;
- ausência funciona;
- sobreaviso pode ser acionado;
- substituição funciona;
- cobertura é calculada;
- alertas de cobertura podem ser apresentados;
- histórico permanece rastreável;
- RBAC funciona;
- integração com Event Bus não quebra isolamento;
- testes de regras passam;
- typecheck passa;
- build passa;
- `check:boundaries` passa.

## 22. Fora de escopo

Não faz parte desta SPEC:

- implementação completa de Passagem de Turno;
- redesign global da plataforma;
- incorporar lógica de Field Teams ao plugin;
- mover regras de turno para `apps/web`;
- criar dependência direta com outro plugin.

## 23. Arquivos principais

```text
plugins/operations/shifts/**
docs/modules/shifts-schedules.md
packages/database/prisma/migrations/202610010006_shifts_schedules/migration.sql
```

Arquivos compartilhados podem ser alterados somente quando necessários para registro, tipos, permissões, persistência ou integração.