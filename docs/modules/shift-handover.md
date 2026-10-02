# Passagem de Turno

## 1. Objetivo

O módulo Passagem de Turno deve permitir registrar formalmente a transferência de contexto operacional entre operadores ou equipes ao final de um turno.

A passagem deve consolidar as informações que o próximo operador precisa conhecer para continuar a operação sem perda de contexto.

O módulo deve contemplar principalmente:

- resumo do turno;
- incidentes ainda abertos;
- tarefas e pendências;
- equipamentos indisponíveis ou com problemas;
- observações operacionais;
- operador/equipe que entrega o turno;
- operador/equipe que recebe;
- confirmação do recebimento;
- histórico da passagem.

## 2. Integração com módulos existentes

Antes de criar modelos ou funcionalidades, a implementação deve inspecionar e reutilizar os domínios existentes.

Reutilizar obrigatoriamente quando aplicável:

- Escalas e Turnos;
- FieldTeam;
- FieldMember;
- User;
- Incidentes;
- Central de Tarefas;
- Inventário/equipamentos;
- Election;
- ElectoralZone;
- PollingPlace.

Não criar versões próprias de turno, incidente, tarefa, equipamento, usuário, equipe ou operador.

A Passagem de Turno deve referenciar essas entidades.

## 3. Escopo

O módulo deve permitir:

- iniciar uma passagem de turno;
- relacioná-la ao turno correspondente;
- registrar resumo operacional;
- selecionar ou associar incidentes abertos;
- selecionar ou associar tarefas pendentes;
- selecionar ou associar equipamentos indisponíveis/problemáticos;
- registrar pendências adicionais em texto quando necessário;
- identificar quem entrega;
- identificar quem deve receber;
- confirmar recebimento;
- consultar passagens anteriores;
- consultar histórico.

## 4. Passagem de turno

Uma passagem deve possuir, no mínimo:

- identificador;
- pleito;
- turno de origem;
- responsável pela entrega;
- responsável pelo recebimento;
- resumo;
- observações;
- status;
- data/hora de criação;
- data/hora da entrega;
- data/hora da confirmação;
- histórico.

Status sugeridos:

- DRAFT
- PENDING_CONFIRMATION
- CONFIRMED
- CANCELLED

## 5. Rascunho

Enquanto estiver em DRAFT, a passagem pode ser alterada pelo usuário autorizado.

Deve ser possível:

- editar resumo;
- editar observações;
- incluir/remover referências operacionais;
- alterar o destinatário quando permitido.

Uma passagem em DRAFT ainda não representa uma entrega formal.

## 6. Envio da passagem

Ao finalizar o preenchimento, o responsável deve poder enviar a passagem.

Ao enviar:

- o status passa para PENDING_CONFIRMATION;
- deve ser registrada a data/hora da entrega;
- deve ser registrado histórico;
- o destinatário deve poder visualizar que existe uma passagem aguardando confirmação.

Depois do envio, alterações no conteúdo principal devem ser restringidas conforme as regras de negócio.

## 7. Confirmação

O operador responsável pelo próximo turno deve confirmar o recebimento.

Ao confirmar:

- status passa para CONFIRMED;
- registrar usuário que confirmou;
- registrar data/hora;
- gerar histórico;
- publicar evento no Event Bus.

A confirmação representa que o próximo responsável recebeu formalmente o contexto operacional.

O sistema não deve permitir que qualquer usuário confirme uma passagem destinada explicitamente a outro operador, salvo permissões administrativas existentes que justifiquem a ação.

## 8. Incidentes abertos

A passagem deve permitir relacionar incidentes existentes.

Não duplicar dados completos do incidente.

Exibir informações úteis, como:

- identificação;
- título/resumo;
- severidade;
- status;
- local;
- responsável, quando disponível.

Priorizar incidentes ainda não encerrados relacionados ao contexto do turno.

## 9. Tarefas e pendências

A passagem deve permitir relacionar tarefas existentes da Central de Tarefas.

Priorizar tarefas:

- PENDING;
- IN_PROGRESS;
- BLOCKED;
- atrasadas;
- críticas.

Não duplicar a entidade Task.

Além das tarefas existentes, deve existir um campo de texto para pendências operacionais que ainda não justifiquem a criação de uma tarefa formal.

## 10. Equipamentos indisponíveis

A passagem deve permitir relacionar equipamentos/ativos existentes no inventário.

Priorizar ativos com estado de indisponibilidade, manutenção, falha ou equivalente existente no domínio atual.

Não criar uma segunda entidade de equipamento.

Exibir informações suficientes para o próximo operador identificar o ativo e sua situação.

## 11. Resumo operacional

A passagem deve possuir um resumo textual obrigatório antes do envio.

O resumo deve permitir registrar:

- acontecimentos relevantes;
- estado atual da operação;
- ações realizadas;
- pontos de atenção;
- informações necessárias ao próximo turno.

## 12. Contexto automático

Sempre que possível, o sistema deve auxiliar o usuário apresentando automaticamente informações relacionadas ao turno/pleito/local, sem criar cópias redundantes.

Exemplos:

- incidentes abertos;
- tarefas pendentes;
- equipamentos indisponíveis.

O usuário decide quais itens serão efetivamente associados à passagem.

## 13. Dashboard

O módulo deve possuir indicadores, no mínimo:

- passagens em rascunho;
- aguardando confirmação;
- confirmadas;
- passagens recentes;
- passagens pendentes destinadas ao usuário atual.

Destacar passagens aguardando confirmação.

## 14. Listagem

Criar listagem de passagens com filtros por:

- pleito;
- turno;
- status;
- responsável pela entrega;
- responsável pelo recebimento;
- período.

Cada registro deve apresentar pelo menos:

- turno;
- remetente;
- destinatário;
- status;
- horário de envio;
- horário de confirmação.

## 15. Detalhes

A página de detalhes deve apresentar:

- dados do turno;
- remetente;
- destinatário;
- resumo;
- pendências;
- incidentes;
- tarefas;
- equipamentos;
- observações;
- status;
- histórico.

Quando aplicável, apresentar a ação de confirmação.

## 16. Histórico

Registrar ações relevantes:

- passagem criada;
- passagem editada;
- incidente associado/removido;
- tarefa associada/removida;
- equipamento associado/removido;
- passagem enviada;
- passagem confirmada;
- passagem cancelada.

Cada registro deve conter:

- ação;
- usuário;
- data/hora;
- descrição.

## 17. Integridade

O sistema deve validar:

- existência do turno;
- existência dos usuários/membros relacionados;
- existência das entidades referenciadas;
- compatibilidade com o contexto do pleito quando aplicável;
- impossibilidade de confirmar passagem cancelada;
- impossibilidade de confirmar duas vezes;
- impossibilidade de enviar passagem sem resumo;
- impossibilidade de enviar passagem sem destinatário.

Evitar duplicação da mesma referência dentro da passagem.

## 18. RBAC

Permissões esperadas:

- shift-handovers.read
- shift-handovers.manage
- shift-handovers.confirm

`read` permite consulta.

`manage` permite criar, editar, relacionar informações, enviar e cancelar conforme as regras.

`confirm` permite confirmar recebimento quando o usuário for o destinatário ou quando uma regra administrativa existente permitir.

Administradores devem possuir todas as permissões.

Distribuir as demais permissões seguindo o padrão atual do projeto.

## 19. Event Bus

Publicar eventos relevantes, incluindo:

- shift_handover.created
- shift_handover.submitted
- shift_handover.confirmed
- shift_handover.cancelled

Outros módulos devem reagir aos eventos pelo Event Bus, sem importar a implementação interna deste plugin.

## 20. Backend

Seguir os padrões atuais do projeto:

- NestJS;
- Prisma;
- DTOs;
- class-validator;
- RBAC;
- Event Bus;
- transações quando necessárias;
- auditoria/histórico.

## 21. Frontend

O plugin deve possuir pelo menos:

- dashboard;
- listagem;
- criação de passagem;
- edição de rascunho;
- detalhes;
- confirmação;
- filtros.

A criação deve facilitar a seleção das informações operacionais relacionadas ao turno.

Utilizar o design system existente.

## 22. Regras arquiteturais

A implementação deve:

- inspecionar os plugins existentes antes de modelar;
- reutilizar Escalas e Turnos;
- reutilizar Incidentes;
- reutilizar Central de Tarefas;
- reutilizar Inventário;
- reutilizar Field Teams;
- não duplicar entidades;
- respeitar boundaries;
- utilizar RBAC;
- utilizar Event Bus;
- preservar funcionalidades existentes;
- evitar alterações desnecessárias em outros plugins.

## 23. Critérios de aceite

O módulo será considerado funcional quando for possível:

1. criar uma passagem vinculada a um turno;
2. identificar quem entrega;
3. definir quem recebe;
4. escrever o resumo;
5. relacionar incidentes abertos;
6. relacionar tarefas pendentes;
7. relacionar equipamentos indisponíveis;
8. registrar pendências adicionais;
9. enviar a passagem;
10. impedir envio incompleto;
11. visualizar passagem aguardando confirmação;
12. confirmar recebimento;
13. impedir confirmação indevida ou duplicada;
14. consultar histórico;
15. filtrar passagens;
16. visualizar indicadores no dashboard.
