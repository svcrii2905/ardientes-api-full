import { Context } from "oak";

export async function loggerMiddleware(ctx: Context, next: () => Promise<unknown>) {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url} - ${ctx.response.status} [${ms}ms]`);
}
