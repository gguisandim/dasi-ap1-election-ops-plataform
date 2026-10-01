# @eops/security

Contrato neutro de segurança da plataforma.

Este package existe para impedir que plugins de domínio dependam da implementação do plugin `system/access-control`.

Exporta:

- `Public` e `Permissions`;
- metadados usados pelos guards;
- `AuthenticatedUser` e `AuthenticatedRequest`;
- `PERMISSIONS` e `PLATFORM_PERMISSION_KEYS`.

O plugin `access-control` continua responsável por login, tokens, guards e administração de usuários. Plugins de domínio devem importar apenas de `@eops/security`.
