import nodemailer from "nodemailer";
import { config } from "../../../../config/env.ts";
import {
  MailService,
  SendVerificationCodeDTO,
} from "../../domain/services/MailService.ts";

export class NodemailerMailService implements MailService {
  private transporter: any = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(): void {
    if (config.mail.enabled && config.mail.smtpHost) {
      this.transporter = nodemailer.createTransport({
        host: config.mail.smtpHost,
        port: config.mail.smtpPort,
        secure: config.mail.smtpSecure,
        auth: {
          user: config.mail.smtpUser,
          pass: config.mail.smtpPass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
    } else {
      this.transporter = null;
    }
  }

  /**
   * Verifica la conexión y apretón de manos (handshake) con el servidor SMTP sin enviar correos
   */
  async verifyConnection(): Promise<{ success: boolean; message: string }> {
    // Re-evaluar por si se cargaron nuevas variables de entorno
    this.initTransporter();

    if (!config.mail.enabled) {
      return {
        success: false,
        message: "SMTP está deshabilitado (SMTP_ENABLED no es true). El sistema funciona en modo mock.",
      };
    }

    if (!config.mail.smtpHost || !config.mail.smtpUser) {
      return {
        success: false,
        message: "Faltan variables SMTP requeridas en la configuración.",
      };
    }

    if (!this.transporter) {
      return {
        success: false,
        message: "No se pudo inicializar el transportador SMTP de Nodemailer.",
      };
    }

    try {
      await this.transporter.verify();
      return {
        success: true,
        message: "Conexión y autenticación SMTP exitosa.",
      };
    } catch (err: any) {
      // Sanitizar mensaje de error para no revelar contraseñas o tokens en consola
      let sanitizedError = err.message || "Error desconocido";
      if (config.mail.smtpPass) {
        sanitizedError = sanitizedError.replaceAll(config.mail.smtpPass, "********");
      }
      if (config.mail.smtpUser) {
        sanitizedError = sanitizedError.replaceAll(config.mail.smtpUser, "***");
      }

      return {
        success: false,
        message: `Fallo al verificar servidor SMTP: ${sanitizedError}`,
      };
    }
  }

  async sendVerificationCode(
    dto: SendVerificationCodeDTO
  ): Promise<{ messageId?: string; response?: string } | void> {
    const isReset = dto.type === "PASSWORD_RESET";
    const subject = isReset
      ? "Código de Recuperación de Contraseña — Ardientes POS"
      : "Código de Verificación de Correo — Ardientes POS";

    const actionText = isReset
      ? "Has solicitado restablecer tu contraseña en el sistema Ardientes POS."
      : "Has solicitado vincular o verificar este correo electrónico en tu cuenta de Ardientes POS.";

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #121214; color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #27272A;">
        <div style="background: linear-gradient(135deg, #FF5500, #FF9900); padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; color: #FFFFFF; letter-spacing: 1px;">🔥 ARDIENTES POS</h1>
          <p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Comidas Rápidas</p>
        </div>
        <div style="padding: 28px 24px; text-align: center;">
          <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #F4F4F5;">${isReset ? "Recuperación de Contraseña" : "Verificación de Correo"}</h2>
          <p style="margin: 0 0 24px 0; font-size: 15px; color: #A1A1AA; line-height: 1.5;">
            ${dto.recipientName ? `Hola <strong>${dto.recipientName}</strong>, ` : ""}${actionText}
          </p>
          <div style="background: #18181B; border: 2px dashed #FF5500; border-radius: 8px; padding: 18px; margin: 0 auto 24px auto; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #FF6600; font-family: monospace;">${dto.code}</span>
          </div>
          <p style="margin: 0 0 16px 0; font-size: 13px; color: #71717A;">
            Este código expirará en <strong>15 minutos</strong> y es de un solo uso.
          </p>
          <p style="margin: 0; font-size: 12px; color: #52525B;">
            Si no realizaste esta solicitud, puedes ignorar este mensaje de forma segura.
          </p>
        </div>
        <div style="background: #09090B; padding: 14px; text-align: center; border-top: 1px solid #27272A;">
          <p style="margin: 0; font-size: 11px; color: #52525B;">Sistema de Seguridad Ardientes POS © ${new Date().getFullYear()}</p>
        </div>
      </div>
    `;

    // Si el transporte SMTP está configurado y habilitado en .env
    if (this.transporter && config.mail.enabled) {
      try {
        const info = await this.transporter.sendMail({
          from: `"${config.mail.fromName}" <${config.mail.fromEmail}>`,
          to: dto.to,
          subject,
          html: htmlContent,
          text: `${subject}\n\n${actionText}\n\nTu código de verificación es: ${dto.code}\n\nEste código es válido por 15 minutos.`,
        });
        return { messageId: info.messageId, response: info.response };
      } catch (err: any) {
        let sanitizedErr = err.message || "Error al enviar correo";
        if (config.mail.smtpPass) {
          sanitizedErr = sanitizedErr.replaceAll(config.mail.smtpPass, "********");
        }
        console.error(`[MAIL SERVICE ERROR] Error al enviar a ${dto.to}:`, sanitizedErr);
        throw new Error("No fue posible enviar el correo de verificación. Inténtalo más tarde.");
      }
    }

    // Modo local / Mock cuando SMTP no está activo
    const nodeEnv = Deno.env.get("NODE_ENV")?.toLowerCase() ?? "development";
    if (nodeEnv === "production") {
      console.log(`[MAIL SERVICE] Código solicitado para: ${dto.to} (código omitido por política de producción)`);
    } else {
      console.log(`[MAIL SERVICE (LOCAL/MOCK)] Destinatario: ${dto.to} | Asunto: "${subject}" | Código: [${dto.code}]`);
    }
    return { messageId: "mock-local-id", response: "250 Mock OK" };
  }
}
