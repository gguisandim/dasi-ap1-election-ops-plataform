# Escalas e Turnos

## 1. Objetivo

O módulo Escalas e Turnos deve permitir planejar e acompanhar a cobertura operacional das equipes durante um pleito.

O sistema deve organizar turnos, operadores, sobreavisos, substituições, faltas e cobertura operacional, permitindo identificar rapidamente períodos ou locais sem pessoal suficiente.

## 2. Integração com Equipes de Campo

O projeto já possui o módulo `field-teams`.

Antes de criar qualquer modelo ou funcionalidade, a implementação deve inspecionar esse módulo e reutilizar suas entidades, equipes, membros, funções, especialidades e demais conceitos existentes sempre que forem compatíveis.

Não criar uma segunda entidade de equipe, membro ou operador quando o conceito já existir.

O novo módulo pode estender o domínio existente ou possuir modelos próprios apenas para conceitos específicos de escala e turno.

## 3. Escopo

O módulo deve permitir:

- criar turnos;
- definir início e fim;
- montar escalas;
- alocar operadores/equipes;
- associar escala a pleito;
- associar escala a zona/local quando aplicável;
- registrar sobreaviso;
- registrar falta;
- realizar substituições;
- acompanhar cobertura;
- identificar turnos descobertos;
- registrar observações;
- consultar histórico.

## 4. Turno

Um turno deve possuir, quando aplicável:

- identificador;
- nome;
- pleito;
- data;
- horário inicial;
- horário final;
- zona opcional;
- local opcional;
- quantidade mínima necessária de operadores;
- status;
- observações.

Status sugeridos:

- SCHEDULED
- IN_PROGRESS
- COMPLETED
- CANCELLED

O horário final deve ser posterior ao horário inicial.

## 5. Alocação

Deve ser possível alocar pessoas/equipes existentes em um turno.

Uma alocação deve indicar:

- turno;
- operador/membro;
- função operacional quando aplicável;
- situação;
- horário de entrada;
- horário de saída;
- observações.

Situações sugeridas:

- SCHEDULED
- PRESENT
- ABSENT
- REPLACED
- ON_CALL

A implementação deve reutilizar usuários/membros/equipes existentes.

## 6. Sobreaviso

Deve ser possível marcar uma alocação como sobreaviso.

O sistema deve permitir identificar:

- quem está de sobreaviso;
- para qual turno;
- período;
- eventual acionamento.

Caso o sobreaviso seja acionado, isso deve ser registrado no histórico.

## 7. Faltas

Deve ser possível registrar que um operador escalado faltou.

A falta deve permitir:

- motivo opcional;
- data/hora do registro;
- responsável pelo registro;
- observação.

Uma falta deve afetar imediatamente o cálculo da cobertura operacional.

## 8. Substituições

Deve ser possível substituir um operador.

A substituição deve registrar:

- operador original;
- substituto;
- turno;
- responsável pela alteração;
- data/hora;
- motivo opcional.

O histórico da alocação original deve ser preservado.

## 9. Cobertura operacional

A cobertura deve ser calculada utilizando a quantidade mínima necessária e as alocações válidas do turno.

Exemplo:

Operadores necessários: 4
Operadores disponíveis: 3

Cobertura: 75%

O sistema deve destacar:

- cobertura completa;
- cobertura parcial;
- turno sem cobertura.

Sempre que possível, não persistir percentuais redundantes; calcular a partir dos dados existentes.

## 10. Conflitos de escala

O sistema deve detectar quando a mesma pessoa é alocada em turnos incompatíveis ou sobrepostos.

A implementação deve impedir ou sinalizar claramente conflitos de horário.

Não considerar como conflito uma situação que o domínio existente explicitamente permita.

## 11. Dashboard

O módulo deve possuir dashboard contendo no mínimo:

- turnos do dia;
- turnos em andamento;
- operadores escalados;
- operadores presentes;
- faltas;
- substituições;
- pessoas em sobreaviso;
- turnos com cobertura insuficiente.

Deve existir destaque para situações que exigem atenção.

## 12. Visualização das escalas

Criar uma visualização operacional que permita compreender rapidamente:

- data;
- turno;
- equipe;
- operadores;
- horário;
- situação;
- cobertura.

Pode ser utilizada tabela, cards ou calendário simplificado, respeitando o design system existente.

## 13. Filtros

Permitir filtros por:

- pleito;
- data;
- zona;
- local;
- equipe;
- operador;
- status do turno;
- situação da alocação.

## 14. Detalhes do turno

A página de detalhes deve apresentar:

- informações do turno;
- cobertura;
- equipe/alocações;
- presentes;
- ausentes;
- sobreaviso;
- substituições;
- observações;
- histórico.

A partir dessa tela deve ser possível executar as principais ações operacionais autorizadas.

## 15. Histórico

Registrar alterações relevantes, incluindo:

- turno criado;
- turno alterado;
- operador alocado;
- presença registrada;
- falta registrada;
- sobreaviso registrado;
- sobreaviso acionado;
- substituição realizada;
- turno iniciado;
- turno concluído;
- turno cancelado.

Cada registro deve indicar usuário, data/hora, ação e descrição.

## 16. Entidades existentes

Reutilizar obrigatoriamente quando aplicável:

- Election;
- ElectoralZone;
- PollingPlace;
- User;
- entidades e conceitos existentes de `field-teams`.

Não duplicar esses domínios.

## 17. RBAC

Permissões esperadas:

- shifts.read
- shifts.manage

`shifts.read` permite consultar escalas e turnos.

`shifts.manage` permite criar e editar turnos, realizar alocações, registrar faltas, sobreavisos e substituições.

Administradores devem possuir todas as permissões.

Distribuir as permissões às demais roles seguindo o padrão atual do projeto.

## 18. Event Bus

Publicar eventos relevantes utilizando o Event Bus existente.

Eventos recomendados:

- shift.created
- shift.started
- shift.completed
- shift.assignment_changed
- shift.absence_registered
- shift.replacement_registered
- shift.coverage_insufficient

Evitar acoplamento direto entre plugins.

## 19. Backend

Seguir a arquitetura existente:

- NestJS;
- Prisma;
- DTOs;
- class-validator;
- RBAC;
- Event Bus;
- services/controllers/modules conforme o padrão atual.

As operações que alterem múltiplos registros relacionados devem utilizar transações quando necessário.

## 20. Frontend

O módulo deve possuir pelo menos:

- dashboard;
- listagem/visualização de escalas;
- criação de turno;
- detalhes do turno;
- gerenciamento de alocações;
- registro de falta;
- substituição;
- sobreaviso;
- filtros.

Utilizar o design system existente.

## 21. Regras arquiteturais

A implementação deve:

- seguir o guia arquitetural do projeto;
- inspecionar `field-teams` antes de modelar o domínio;
- reutilizar conceitos existentes;
- evitar entidades duplicadas;
- respeitar limites entre plugins;
- utilizar Event Bus para integração;
- utilizar RBAC existente;
- preservar funcionalidades atuais;
- não modificar outros módulos apenas para facilitar a implementação.

## 22. Critérios de aceite

O módulo será considerado funcional quando for possível:

1. criar um turno;
2. definir horário e necessidade mínima;
3. alocar operadores/equipe;
4. detectar conflito de escala;
5. registrar presença;
6. registrar falta;
7. registrar sobreaviso;
8. realizar substituição;
9. calcular cobertura operacional;
10. identificar cobertura insuficiente;
11. consultar histórico;
12. filtrar escalas;
13. visualizar indicadores no dashboard.
