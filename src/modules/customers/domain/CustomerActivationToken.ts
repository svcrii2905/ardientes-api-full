export interface CustomerActivationTokenProps {
  id?: number | null;
  customerId: number;
  codeHash: string;
  expiresAt: Date;
  attempts?: number;
  maxAttempts?: number;
  usedAt?: Date | null;
  createdBy: number;
  createdAt?: Date;
}

export class CustomerActivationToken {
  private _id: number | null;
  private readonly _customerId: number;
  private readonly _codeHash: string;
  private readonly _expiresAt: Date;
  private _attempts: number;
  private readonly _maxAttempts: number;
  private _usedAt: Date | null;
  private readonly _createdBy: number;
  private readonly _createdAt: Date;

  constructor(props: CustomerActivationTokenProps) {
    this._id = props.id ?? null;
    this._customerId = props.customerId;
    this._codeHash = props.codeHash;
    this._expiresAt = props.expiresAt;
    this._attempts = props.attempts ?? 0;
    this._maxAttempts = props.maxAttempts ?? 3;
    this._usedAt = props.usedAt ?? null;
    this._createdBy = props.createdBy;
    this._createdAt = props.createdAt ?? new Date();
  }

  get id(): number | null {
    return this._id;
  }

  setId(id: number): void {
    this._id = id;
  }

  get customerId(): number {
    return this._customerId;
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

  get maxAttempts(): number {
    return this._maxAttempts;
  }

  get usedAt(): Date | null {
    return this._usedAt;
  }

  get createdBy(): number {
    return this._createdBy;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  isUsed(): boolean {
    return this._usedAt !== null;
  }

  isExpired(): boolean {
    return new Date() > this._expiresAt;
  }

  isBlocked(): boolean {
    return this._attempts >= this._maxAttempts;
  }

  isValid(): boolean {
    return !this.isUsed() && !this.isExpired() && !this.isBlocked();
  }

  incrementAttempts(): void {
    this._attempts += 1;
  }

  markAsUsed(usedDate: Date = new Date()): void {
    this._usedAt = usedDate;
  }
}
