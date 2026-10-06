# @eops/shared

Contratos compartilhados, separados por domínio para reduzir acoplamento e contexto de implementação.

Subpaths disponíveis:

- `@eops/shared/auth`
- `@eops/shared/command-center`
- `@eops/shared/common`
- `@eops/shared/communications`
- `@eops/shared/correlation`
- `@eops/shared/elections`
- `@eops/shared/evidence`
- `@eops/shared/format`
- `@eops/shared/incidents`
- `@eops/shared/inventory`
- `@eops/shared/knowledge`
- `@eops/shared/postmortems`
- `@eops/shared/reports`
- `@eops/shared/resource-requests`
- `@eops/shared/risks`
- `@eops/shared/simulation`
- `@eops/shared/transmission`
- `@eops/shared/workforce`

`@eops/shared` continua reexportando tudo por compatibilidade, mas código novo deve preferir o subpath do domínio.

## Regra de sintaxe: apenas código apagável

Estes arquivos são carregados **em tempo de execução** pelo Node, sem build intermediário: o mapa de `exports` aponta para `src/<dominio>.ts`. O Node 22 executa TypeScript em modo *strip-only*, que remove tipos mas **não transforma sintaxe**.

Use somente sintaxe apagável:

```text
permitido     const ... as const, type, interface, function, classes sem decorators
proibido      enum, namespace, property parameters (constructor(private x)), import =
```

Um `enum` em qualquer arquivo alcançado por um subpath faz a API falhar no carregamento do módulo com `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. O erro **não** aparece em `typecheck`, `lint` ou `test`: só na execução.

O padrão adotado é `const X = [...] as const` mais `type X = (typeof X)[number]`, no lugar de `enum`.

## Resolução de tipos

A API compila com `moduleResolution` *Bundler* e resolve os subpaths pelo mapa de `exports`. Pacotes que compilam com `moduleResolution: "Node"` (node10) ignoram `exports`; por isso o `package.json` declara também `typesVersions`, apontando cada subpath para o fonte correspondente. Ao criar um subpath novo, declare-o nos **dois** lugares: `exports` e `typesVersions`.
