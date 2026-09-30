# Arquitetura de plugins

## Regra principal

Um plugin é uma unidade autônoma de domínio. Código específico não deve ser movido para `apps/web` ou `apps/api` por conveniência. Os apps são pontos de composição; implementação, services, estilos e rotas pertencem ao plugin.

## Estrutura recomendada

```text
plugins/<categoria>/<plugin>/
  package.json
  src/
    client/
      components/
      pages/
      services/
      styles/
    server/
      dto/
      controllers ou controllers próximos do módulo
      services ou services próximos do módulo
      <dominio>.module.ts
    shared/
      types/
      schemas/
      constants/
    index.ts
    manifest.ts
  tests/
```

A estrutura pode ser simplificada em plugins pequenos, mas a fronteira client/server deve permanecer explícita.

## Manifest e rotas

O `PluginManifest` declara identidade, categoria, versão, permissões e `route`. O `PlatformPlugin` pode fornecer várias rotas:

```ts
export const examplePlugin: PlatformPlugin = {
  manifest,
  routes: [
    { path: "/examples", Component: ExampleList },
    { path: "/examples/:id", Component: ExampleDetail },
  ],
};
```

O shell compõe essas rotas com React Router e usa `manifest.route` para a sidebar e identificação do módulo ativo. A propriedade `View` permanece opcional para compatibilidade com plugins demonstrativos antigos.

## Backend modular

Plugins de domínio expõem módulos NestJS dentro de `src/server`. `apps/api/src/app.module.ts` registra os módulos, mas não contém suas regras. DTOs usam `class-validator`, services acessam o `PrismaService` e controllers retornam status HTTP coerentes.

## Dependências compartilhadas

- `@eops/api-client`: transporte HTTP tipado, JSON e `ApiError`;
- `@eops/database`: schema, migrations, seed e integração Prisma;
- `@eops/plugin-sdk`: contratos de manifest e rotas;
- `@eops/shared`: tipos, enums e formatação de domínio;
- `@eops/ui`: Button, Input, Select, Badge, Card, estados, breadcrumb e paginação.

Componentes que só fazem sentido em um módulo continuam no plugin.

## Categorias

```text
operations/     núcleo da operação eleitoral
logistics/      movimentação de pessoas, equipamentos e materiais
monitoring/     mapa, eventos, incidentes e conectividade
analytics/      dashboards, BI e relatórios
system/         auditoria, administração e configurações
```

A interface lê `manifest.category` e cria os agrupamentos da sidebar automaticamente.

## CSS e comunicação com API

Plugins usam `*.module.css` para impedir colisões. O CSS global contém somente tema, reset e layout do shell. Chamadas ao backend ficam em `src/client/services` e usam `@eops/api-client`; componentes não devem chamar `fetch` diretamente.

## Checklist de novo plugin

1. Criar workspace e manifest.
2. Implementar e exportar as rotas próprias.
3. Separar páginas, componentes, services e estilos.
4. Se houver backend, criar módulo, controller, service e DTOs no plugin.
5. Registrar a exportação no shell e o módulo no bootstrap da API.
6. Adicionar validação, estados de loading/erro/vazio e testes relevantes.
