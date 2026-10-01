import { SetMetadata } from "@nestjs/common";
export const PUBLIC_ROUTE = "eops.public";
export const REQUIRED_PERMISSIONS = "eops.permissions";
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const Permissions = (...permissions: string[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);
