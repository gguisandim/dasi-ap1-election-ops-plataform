# Arquitetura de plugins

## Regra principal

Um plugin é uma unidade autônoma. Código específico de um plugin não deve ser colocado em `apps/web` apenas por conveniência.

## Estrutura padrão

```text
plugins/<categoria>/<plugin>/
  package.json
  src/
    index.ts
    manifest.ts
    components/
    pages/
    services/
    styles/
    types/
```

- `manifest.ts`: identidade, categoria, rota, versão e permissões.
- `pages/`: telas completas do módulo.
- `components/`: componentes exclusivos do módulo.
- `services/`: chamadas de API, regras de acesso a dados e adaptadores.
- `styles/`: CSS Modules exclusivos do plugin.
- `types/`: modelos TypeScript específicos do domínio.

## Categorias iniciais

```text
operations/     núcleo da operação eleitoral
logistics/      movimentação de pessoas, equipamentos e materiais
monitoring/     eventos, incidentes, conectividade e transmissão
analytics/      dashboards, BI, relatórios e exportações
system/         auditoria, administração, permissões e configurações
```

A interface lê `manifest.category` e cria automaticamente os agrupamentos da barra lateral.

## Isolamento de CSS

Os plugins usam `*.module.css`. Assim, classes como `.card`, `.hero` e `.tableCard` são transformadas em nomes locais pelo bundler e não colidem com estilos de outros plugins.

## Novo plugin

Exemplo:

```text
plugins/monitoring/network-health/
  package.json
  src/
    index.ts
    manifest.ts
    pages/Overview.tsx
    components/HealthCard.tsx
    services/networkHealthService.ts
    styles/overview.module.css
    types/index.ts
```

Depois basta adicionar o pacote às dependências do shell e registrá-lo em `apps/web/src/pluginRegistry.ts`.

No futuro, o registro manual pode ser substituído por descoberta automática de manifests durante o build.
