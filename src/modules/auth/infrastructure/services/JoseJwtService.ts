import { SignJWT, jwtVerify } from "jose";
import {
  JwtService,
  AuthTokenPayload,
  ResetTokenPayload,
  CustomerTokenPayload,
} from "../../domain/services/JwtService.ts";
import { config } from "../../../../config/env.ts";

export class JoseJwtService implements JwtService {
  private readonly secretKey: Uint8Array;
  private readonly expirationTime: string;

  constructor(secret: string = config.jwt.secret, expirationTime: string = "12h") {
    if (!secret || secret.trim() === "") {
      throw new Error("JWT_SECRET no está configurado o es una cadena vacía");
    }
    this.secretKey = new TextEncoder().encode(secret);
    this.expirationTime = expirationTime;
  }

  async generateToken(payload: Omit<AuthTokenPayload, "iat" | "exp">): Promise<string> {
    return await new SignJWT({
      username: payload.username,
      fullName: payload.fullName,
      roles: payload.roles,
      permissions: payload.permissions,
      tokenVersion: payload.tokenVersion ?? 1,
      purpose: payload.purpose ?? "session",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(this.expirationTime)
      .sign(this.secretKey);
  }

  async verifyToken(token: string): Promise<AuthTokenPayload> {
    const { payload } = await jwtVerify(token, this.secretKey);
    return {
      sub: String(payload.sub),
      username: String(payload.username ?? ""),
      fullName: String(payload.fullName ?? ""),
      roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
      permissions: Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [],
      tokenVersion: typeof payload.tokenVersion === "number" ? payload.tokenVersion : undefined,
      purpose: typeof payload.purpose === "string" ? payload.purpose : undefined,
      iat: payload.iat,
      exp: payload.exp,
    };
  }

  async generateResetToken(payload: { userId: number; email: string; codeId: number }): Promise<string> {
    return await new SignJWT({
      email: payload.email,
      codeId: payload.codeId,
      purpose: "pwd_reset",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(payload.userId))
      .setIssuedAt()
      .setExpirationTime("10m") // 10 minutos de vigencia máxima
      .sign(this.secretKey);
  }

  async verifyResetToken(token: string): Promise<ResetTokenPayload> {
    const { payload } = await jwtVerify(token, this.secretKey);
    if (payload.purpose !== "pwd_reset") {
      throw new Error("El token no es un token de recuperación de contraseña válido");
    }
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ""),
      codeId: Number(payload.codeId),
      purpose: "pwd_reset",
      iat: payload.iat,
      exp: payload.exp,
    };
  }

  async generateCustomerToken(payload: {
    customerId: number;
    phone: string;
    email: string | null;
    fullName: string;
    tokenVersion: number;
  }): Promise<string> {
    return await new SignJWT({
      userType: "CUSTOMER",
      customerId: payload.customerId,
      phone: payload.phone,
      email: payload.email,
      fullName: payload.fullName,
      tokenVersion: payload.tokenVersion,
      purpose: "customer_session",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(payload.customerId))
      .setIssuedAt()
      .setExpirationTime(this.expirationTime)
      .sign(this.secretKey);
  }

  async verifyCustomerToken(token: string): Promise<CustomerTokenPayload> {
    const { payload } = await jwtVerify(token, this.secretKey);
    if (payload.userType !== "CUSTOMER" || payload.purpose !== "customer_session") {
      throw new Error("El token no corresponde a una sesión de cliente válida");
    }
    return {
      sub: String(payload.sub),
      userType: "CUSTOMER",
      customerId: Number(payload.customerId ?? payload.sub),
      phone: String(payload.phone ?? ""),
      email: payload.email ? String(payload.email) : null,
      fullName: String(payload.fullName ?? ""),
      tokenVersion: Number(payload.tokenVersion ?? 1),
      purpose: "customer_session",
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
