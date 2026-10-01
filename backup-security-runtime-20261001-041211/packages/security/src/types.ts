export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

/**
 * Minimal request contract needed by the platform guards/controllers.
 * It intentionally avoids depending on Express so the security contract stays transport-light.
 */
export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user: AuthenticatedUser;
}
