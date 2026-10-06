import { Router } from "oak";
import { authDependencies } from "../dependencies.ts";
import { authMiddleware } from "../../../../shared/infrastructure/middleware/auth.middleware.ts";

const authRouter = new Router({ prefix: "/api/v1/auth" });

const { authController } = authDependencies;

// Autenticación de usuario (Login - Público)
authRouter.post("/login", (ctx) => authController.login(ctx));

// Perfil del usuario (Requiere token)
authRouter.get("/me", authMiddleware, (ctx) => authController.getMe(ctx));

// Cierre semántico de sesión (Logout - Público)
authRouter.post("/logout", (ctx) => authController.logout(ctx));

// ─── Recuperación de Contraseña ──────────────────────────────────────────────
// 1. Solicitar código de recuperación por correo (Público)
authRouter.post("/forgot-password", (ctx) => authController.forgotPassword(ctx));

// 2. Validar código de 6 dígitos y obtener resetToken exclusivo (Público)
authRouter.post("/verify-reset-code", (ctx) => authController.verifyResetCode(ctx));

// 3. Restablecer contraseña con el resetToken (Público, validado por token de reseteo)
authRouter.post("/reset-password", (ctx) => authController.resetPassword(ctx));

// ─── Cambio de Contraseña (Autenticado) ───────────────────────────────────────
authRouter.post("/change-password", authMiddleware, (ctx) => authController.changePassword(ctx));

// ─── Vinculación y Verificación de Correo (Autenticado) ───────────────────────
// Solicitar vincular o cambiar correo (envía código al nuevo email)
authRouter.post("/email-setup/request", authMiddleware, (ctx) => authController.requestEmailSetup(ctx));

// Confirmar código de 6 dígitos y asociar correo a la cuenta
authRouter.post("/email-setup/confirm", authMiddleware, (ctx) => authController.confirmEmailSetup(ctx));

export { authRouter };
