import { VerificationCodeType } from "../AuthVerificationCode.ts";

export interface SendVerificationCodeDTO {
  to: string;
  code: string;
  type: VerificationCodeType;
  recipientName?: string;
}

export interface MailService {
  /**
   * Envía un código de 6 dígitos para recuperación o verificación de correo
   */
  sendVerificationCode(dto: SendVerificationCodeDTO): Promise<{ messageId?: string; response?: string } | void>;

  /**
   * Verifica la conectividad y credenciales con el servidor SMTP (sin enviar correos)
   */
  verifyConnection?(): Promise<{ success: boolean; message: string }>;
}
