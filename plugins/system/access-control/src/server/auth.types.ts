import type { Request } from "express";
export interface AuthenticatedUser { id: string; email: string; roles: string[]; permissions: string[]; }
export interface AuthenticatedRequest extends Request { user: AuthenticatedUser; }
