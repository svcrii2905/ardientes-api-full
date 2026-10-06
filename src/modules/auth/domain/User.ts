/**
 * Entidad User para el contexto de autenticación y control de acceso (IAM)
 */
export interface UserProps {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  isActive: boolean;
  tokenVersion?: number;
  roles: string[];
  permissions: string[];
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date | null;
}

export interface SafeUserDTO {
  id: number;
  username: string;
  email: string;
  fullName: string;
  isActive: boolean;
  tokenVersion?: number;
  roles: string[];
  permissions: string[];
  lastLoginAt?: string | null;
}

export class User {
  private readonly _id: number;
  private readonly _username: string;
  private readonly _email: string;
  private readonly _passwordHash: string;
  private readonly _fullName: string;
  private readonly _isActive: boolean;
  private readonly _tokenVersion: number;
  private readonly _roles: string[];
  private readonly _permissions: string[];
  private readonly _createdAt?: Date;
  private readonly _updatedAt?: Date;
  private readonly _lastLoginAt?: Date | null;

  constructor(props: UserProps) {
    this._id = props.id;
    this._username = props.username;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._fullName = props.fullName;
    this._isActive = props.isActive;
    this._tokenVersion = props.tokenVersion ?? 1;
    this._roles = [...props.roles];
    this._permissions = [...props.permissions];
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
    this._lastLoginAt = props.lastLoginAt;
  }

  get id(): number {
    return this._id;
  }

  get username(): string {
    return this._username;
  }

  get email(): string {
    return this._email;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get fullName(): string {
    return this._fullName;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get tokenVersion(): number {
    return this._tokenVersion;
  }

  get roles(): string[] {
    return [...this._roles];
  }

  get permissions(): string[] {
    return [...this._permissions];
  }

  get createdAt(): Date | undefined {
    return this._createdAt;
  }

  get updatedAt(): Date | undefined {
    return this._updatedAt;
  }

  get lastLoginAt(): Date | null | undefined {
    return this._lastLoginAt;
  }

  /**
   * Verifica si el usuario tiene un rol específico
   */
  hasRole(roleName: string): boolean {
    return this._roles.includes(roleName.toUpperCase());
  }

  /**
   * Verifica si el usuario tiene un permiso específico (o si es ADMIN)
   */
  hasPermission(permissionCode: string): boolean {
    if (this.hasRole("ADMIN")) return true;
    return this._permissions.includes(permissionCode);
  }

  /**
   * Verifica si el usuario posee al menos uno de los permisos indicados
   */
  hasAnyPermission(permissionCodes: string[]): boolean {
    if (this.hasRole("ADMIN")) return true;
    return permissionCodes.some((p) => this._permissions.includes(p));
  }

  /**
   * Verifica si el usuario posee todos los permisos indicados
   */
  hasAllPermissions(permissionCodes: string[]): boolean {
    if (this.hasRole("ADMIN")) return true;
    return permissionCodes.every((p) => this._permissions.includes(p));
  }

  /**
   * Retorna una representación plana segura sin passwordHash
   */
  toSafeObject(): SafeUserDTO {
    return {
      id: this._id,
      username: this._username,
      email: this._email,
      fullName: this._fullName,
      isActive: this._isActive,
      tokenVersion: this._tokenVersion,
      roles: [...this._roles],
      permissions: [...this._permissions],
      lastLoginAt: this._lastLoginAt?.toISOString() ?? null,
    };
  }
}
