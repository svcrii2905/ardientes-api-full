import { assertEquals, assert } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { NodemailerMailService } from "../modules/auth/infrastructure/services/NodemailerMailService.ts";
import { config } from "../config/env.ts";

Deno.test("SMTP Service - 1. Modo Mock cuando SMTP_ENABLED es false", async () => {
  // Asegurar que si está en false, verifyConnection reporta modo mock
  const originalEnabled = config.mail.enabled;
  config.mail.enabled = false;

  const mailService = new NodemailerMailService();
  const verifyResult = await mailService.verifyConnection();

  assertEquals(verifyResult.success, false);
  assert(verifyResult.message.includes("SMTP está deshabilitado") || verifyResult.message.includes("mock"));

  // sendVerificationCode no debe arrojar error en modo mock
  let threw = false;
  try {
    await mailService.sendVerificationCode({
      to: "mock@ardientes.com",
      code: "998877",
      type: "PASSWORD_RESET",
      recipientName: "Test Mock",
    });
  } catch {
    threw = true;
  }

  assertEquals(threw, false);
  config.mail.enabled = originalEnabled;
});

Deno.test("SMTP Service - 2. Sanitización de errores sin exponer credenciales", async () => {
  const originalPass = config.mail.smtpPass;
  const originalHost = config.mail.smtpHost;
  const originalEnabled = config.mail.enabled;

  config.mail.smtpPass = "SuperSecretPasswordDoNotLeak123";
  config.mail.smtpHost = "127.0.0.1"; // Host local donde no hay SMTP
  config.mail.smtpPort = 65432;      // Puerto cerrado
  config.mail.enabled = true;

  const mailService = new NodemailerMailService();
  const res = await mailService.verifyConnection();

  // El resultado debe fallar por puerto cerrado, pero NUNCA contener la contraseña
  assertEquals(res.success, false);
  assert(!res.message.includes("SuperSecretPasswordDoNotLeak123"), "La contraseña no debe aparecer en el error");

  config.mail.smtpPass = originalPass;
  config.mail.smtpHost = originalHost;
  config.mail.enabled = originalEnabled;
});
