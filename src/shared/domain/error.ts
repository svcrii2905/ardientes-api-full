export class DomainError extends Error {
  public statusCode: number;
  public errorCode: string;

  constructor(message: string, statusCode: number = 400, errorCode: string = "DOMAIN_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    // @ts-ignore Error.captureStackTrace is V8 specific, usually available in Deno
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409, "CONFLICT_ERROR");
  }
}
