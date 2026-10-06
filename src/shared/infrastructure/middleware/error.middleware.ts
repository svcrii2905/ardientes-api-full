import { Context, isHttpError, Status } from "oak";
import { DomainError } from "../../domain/error.ts";

export async function errorMiddleware(ctx: Context, next: () => Promise<unknown>) {
  try {
    await next();
  } catch (err) {
    let status = Status.InternalServerError;
    let message = "Internal Server Error";
    let errorCode = "INTERNAL_ERROR";

    if (err instanceof DomainError) {
      status = err.statusCode;
      message = err.message;
      errorCode = err.errorCode;
    } else if (isHttpError(err)) {
      status = err.status;
      message = err.message;
    } else if (err instanceof Error) {
      console.error("[Unhandled Error]:", err);
      message = err.message;
    } else {
      console.error("[Unknown Error]:", err);
    }

    ctx.response.status = status;
    ctx.response.body = {
      error: {
        code: errorCode,
        message: message,
      },
    };
  }
}
