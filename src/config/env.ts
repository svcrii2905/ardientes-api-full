import { load } from "dotenv";

await load({
  export: true,
  allowEmptyValues: true,
});

export const config = {
  port: parseInt(Deno.env.get("PORT") || "8000", 10),

  db: {
    hostname: Deno.env.get("DB_HOSTNAME") || "127.0.0.1",
    username: Deno.env.get("DB_USERNAME") || "root",
    password: Deno.env.get("DB_PASSWORD") || "",
    database: Deno.env.get("DB_DATABASE") || "ardientes_pos",
    port: parseInt(Deno.env.get("DB_PORT") || "3306", 10),
    poolSize: parseInt(Deno.env.get("DB_POOL_SIZE") || "10", 10),
  },

  jwt: {
    secret: Deno.env.get("JWT_SECRET") ?? "",
  },

  // Lista de orígenes permitidos (CORS) separados por coma.
  // En desarrollo puede estar vacío y se usará "*".
  allowedOrigins: Deno.env.get("ALLOWED_ORIGINS") ?? "",

  rateLimit: {
    windowMs: parseInt(Deno.env.get("RATE_LIMIT_WINDOW_MS") || "900000", 10),
    maxRequests: parseInt(Deno.env.get("RATE_LIMIT_MAX_REQUESTS") || "10", 10),
  },

  mail: {
    smtpHost: Deno.env.get("SMTP_HOST") || "",
    smtpPort: parseInt(Deno.env.get("SMTP_PORT") || "587", 10),
    smtpUser: Deno.env.get("SMTP_USER") || "",
    smtpPass: Deno.env.get("SMTP_PASS") || "",
    smtpSecure: Deno.env.get("SMTP_SECURE") === "true",
    fromEmail: Deno.env.get("SMTP_FROM") || "no-reply@ardientes.com",
    fromName: Deno.env.get("SMTP_FROM_NAME") || "Ardientes POS",
    enabled: Deno.env.get("SMTP_ENABLED") === "true",
  },
};

// Production configuration validation
const nodeEnv = Deno.env.get("NODE_ENV")?.toLowerCase() ?? "development";
if (nodeEnv === "production") {
  const required = [
    "PORT",
    "DB_HOSTNAME",
    "DB_USERNAME",
    "DB_PASSWORD",
    "DB_DATABASE",
    "DB_PORT",
    "JWT_SECRET",
    "ALLOWED_ORIGINS",
    "RATE_LIMIT_WINDOW_MS",
    "RATE_LIMIT_MAX_REQUESTS",
  ];
  const missing = required.filter((v) => {
    const val = Deno.env.get(v);
    return !val || val.trim() === "";
  });
  if (missing.length > 0) {
    console.error(`Missing required environment variable(s) for production: ${missing.join(", ")}`);
    Deno.exit(1);
  }
}