const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 32 caracteres seguros (sin 0, 1, I, L, O)

/**
 * Genera un código de activación criptográficamente seguro de 8 caracteres alfanuméricos.
 * Formato: XXXX-XXXX (ej: C7K9-W2M4)
 */
export function generateActivationCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * Normaliza un código de activación retirando guiones, espacios y convirtiendo a mayúsculas.
 */
export function normalizeActivationCode(code: string): string {
  return (code ?? "").replace(/[\s\-]/g, "").toUpperCase();
}

/**
 * Genera el hash SHA-256 en hexadecimal del código normalizado.
 */
export async function hashActivationCode(code: string): Promise<string> {
  const normalized = normalizeActivationCode(code);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verifica si un código ingresado coincide con el hash almacenado.
 */
export async function verifyActivationCode(inputCode: string, storedHash: string): Promise<boolean> {
  const computed = await hashActivationCode(inputCode);
  return computed.toLowerCase() === storedHash.toLowerCase();
}
