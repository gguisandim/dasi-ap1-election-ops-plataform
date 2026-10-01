# Autenticação e RBAC

## Modelo

A plataforma usa autenticação por token assinado e autorização baseada em permissões persistidas no PostgreSQL.

Entidades principais:

```text
User
Role
Permission
UserRole
RolePermission
```

Roles agrupam permissões; controllers não devem tomar decisões de segurança apenas pelo nome da role.

## Perfis de demonstração

O seed sincroniza:

- `ADMIN`
- `SUPERVISOR`
- `OPERATOR`
- `TECHNICIAN`
- `VIEWER`

A senha dos usuários demo é derivada de `DEMO_ADMIN_PASSWORD`. Não use o valor de demonstração em ambiente publicado.

## Permissões atuais

### Estrutura eleitoral

- `elections.read`
- `elections.manage`

### Incidentes

- `incidents.read`
- `incidents.create`
- `incidents.assign`
- `incidents.update`
- `incidents.resolve`
- `incidents.close`

### Inventário

- `inventory.read`
- `inventory.create`
- `inventory.update`
- `inventory.move`

### Sistema/simulação

- `users.read`
- `users.manage`
- `audit.read`
- `simulation.read`
- `simulation.manage`

## Backend

Os contratos neutros de segurança ficam em `packages/security` (`@eops/security`). O plugin `access-control` implementa autenticação, usuários e os guards, mas outros plugins não importam sua implementação.

`AuthenticationGuard` e `PermissionGuard` são guards globais. Rotas públicas precisam usar `@Public()`. Requisitos específicos são declarados com `@Permissions(...)`.

Exemplo:

```ts
import { PERMISSIONS, Permissions } from "@eops/security";
@Permissions(PERMISSIONS.inventory.read)
@Controller("inventory")
export class InventoryController {
  @Permissions(PERMISSIONS.inventory.move)
  @Post(":id/movements")
  move() {}
}
```

Os controllers de Pleitos, Zonas, Locais e Seções exigem `elections.read` para leitura e `elections.manage` para mutações.

## Proveniência de auditoria

IDs que representam o autor da ação não devem vir do body HTTP. Incidentes, Inventário e Simulador recebem o `request.user.id` autenticado no controller e o propagam ao domínio/Event Bus. IDs que representam o alvo/responsável de uma atribuição continuam podendo fazer parte do DTO.

## Frontend

O token é armazenado em `localStorage` sob `eops.session`, aplicado ao `@eops/api-client` e revalidado por `/api/auth/me` ao iniciar a aplicação.

A segurança final permanece no backend. Esconder botões no frontend pode melhorar UX, mas não substitui os guards.


## Evolução por plugin

Quando um plugin introduzir uma nova permissão, adicione a chave em `packages/security/src/permissions.ts` e sincronize sua concessão em `packages/database/prisma/seed.ts`. Não replique strings de permissão em packages/plugins diferentes quando a chave puder ser reutilizada pelo catálogo central.
