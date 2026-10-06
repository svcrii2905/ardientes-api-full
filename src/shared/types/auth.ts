/**
 * Representación del usuario autenticado en el contexto de las peticiones HTTP (ctx.state.user)
 */
export interface AuthenticatedUser {
  id: number;
  username: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}

export interface AppState {
  user?: AuthenticatedUser;
  [key: string]: unknown;
}
