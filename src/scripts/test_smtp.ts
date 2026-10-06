import { config } from "../config/env.ts";
import { NodemailerMailService } from "../modules/auth/infrastructure/services/NodemailerMailService.ts";

async function main() {
  console.log("==========================================");
  console.log("🔍 DIAGNÓSTICO DE CONEXIÓN SMTP (LOCAL)");
  console.log("==========================================\n");

  console.log("Configuración detectada:");
  console.log(`- SMTP_ENABLED:   ${config.mail.enabled ? "true" : "false"}`);
  console.log(`- SMTP_HOST:      ${config.mail.smtpHost ? config.mail.smtpHost : "(no configurado)"}`);
  console.log(`- SMTP_PORT:      ${config.mail.smtpPort}`);
  console.log(`- SMTP_SECURE:    ${config.mail.smtpSecure}`);
  console.log(`- SMTP_FROM:      ${config.mail.fromEmail}`);
  console.log(`- SMTP_USER:      ${config.mail.smtpUser ? "(definido)" : "(no configurado)"}`);
  console.log(`- SMTP_PASS:      ${config.mail.smtpPass ? "(definida)" : "(no configurada)"}\n`);

  const mailService = new NodemailerMailService();

  console.log("Probando conexión y handshake con servidor SMTP...");
  const result = await mailService.verifyConnection();

  if (result.success) {
    console.log("✅ RESULTADO: " + result.message);
  } else {
    console.log("⚠️ RESULTADO: " + result.message);
  }

  // Si se pasa parámetro --send-to <email>, realizar prueba de despacho controlado
  const args = Deno.args;
  const sendToIndex = args.indexOf("--send-to");
  if (sendToIndex !== -1 && args[sendToIndex + 1]) {
    const targetEmail = args[sendToIndex + 1];
    console.log(`\nEnviando correo de prueba controlado a: ${targetEmail}...`);
    try {
      const sendResult = await mailService.sendVerificationCode({
        to: targetEmail,
        code: "123456",
        type: "EMAIL_VERIFICATION",
        recipientName: "Usuario de Prueba",
      });
      console.log(`✅ Correo de prueba aceptado y despachado a: ${targetEmail}`);
      if (sendResult) {
        if (sendResult.messageId) console.log(`- Message-ID: ${sendResult.messageId}`);
        if (sendResult.response) console.log(`- Respuesta del servidor: ${sendResult.response}`);
      }
    } catch (err: any) {
      console.error(`❌ Error en el envío: ${err.message}`);
    }
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Error inesperado en diagnóstico:", err.message);
  });
}
