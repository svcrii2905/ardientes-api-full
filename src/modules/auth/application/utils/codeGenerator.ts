/**
 * Genera un código criptográfico de 6 dígitos numéricos (100000 - 999999)
 */
export function generateSixDigitCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Escala a rango 100000 - 999999
  const code = 100000 + (array[0] % 900000);
  return code.toString();
}

/**
 * Genera el hash SHA-256 en formato hexadecimal de un código en texto plano
 */
export async function hashVerificationCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compara un código ingresado contra un hash SHA-256 almacenado
 */
export async function verifyCodeHash(inputCode: string, storedHash: string): Promise<boolean> {
  const computedHash = await hashVerificationCode(inputCode);
  return computedHash.toLowerCase() === storedHash.toLowerCase();
}
