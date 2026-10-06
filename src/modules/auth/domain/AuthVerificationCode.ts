export type VerificationCodeType = "PASSWORD_RESET" | "EMAIL_VERIFICATION";

export interface AuthVerificationCodeProps {
  id: number;
  userId: number;
  type: VerificationCodeType;
  targetEmail: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt?: Date | null;
  ipAddress?: string | null;
  createdAt?: Date;
}

export class AuthVerificationCode {
  private readonly _id: number;
  private readonly _userId: number;
  private readonly _type: VerificationCodeType;
  private readonly _targetEmail: string;
  private readonly _codeHash: string;
  private readonly _expiresAt: Date;
  private readonly _attempts: number;
  private readonly _usedAt?: Date | null;
  private readonly _ipAddress?: string | null;
  private readonly _createdAt?: Date;

  constructor(props: AuthVerificationCodeProps) {
    this._id = props.id;
    this._userId = props.userId;
    this._type = props.type;
    this._targetEmail = props.targetEmail;
    this._codeHash = props.codeHash;
    this._expiresAt = props.expiresAt;
    this._attempts = props.attempts;
    this._usedAt = props.usedAt;
    this._ipAddress = props.ipAddress;
    this._createdAt = props.createdAt;
  }

  get id(): number {
    return this._id;
  }

  get userId(): number {
    return this._userId;
  }

  get type(): VerificationCodeType {
    return this._type;
  }

  get targetEmail(): string {
    return this._targetEmail;
  }

  get codeHash(): string {
    return this._codeHash;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get attempts(): number {
    return this._attempts;
  }

  get usedAt(): Date | null | undefined {
    return this._usedAt;
  }

  get ipAddress(): string | null | undefined {
    return this._ipAddress;
  }

  get createdAt(): Date | undefined {
    return this._createdAt;
  }

  isUsed(): boolean {
    return this._usedAt !== null && this._usedAt !== undefined;
  }

  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  hasExceededAttempts(maxAttempts: number = 3): boolean {
    return this._attempts >= maxAttempts;
  }

  isValidForVerification(maxAttempts: number = 3): boolean {
    return !this.isUsed() && !this.isExpired() && !this.hasExceededAttempts(maxAttempts);
  }
}
