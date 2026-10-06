export function isPositiveInt(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function isStringWithin(value: unknown, maxLen: number): boolean {
  return typeof value === 'string' && value.length <= maxLen;
}

export function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && isFinite(value);
}

export function isNumberInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && isFinite(value) && value >= min && value <= max;
}

export function isValidEnum<T>(value: unknown, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}

export function isISODateString(value: unknown): boolean {
  return typeof value === 'string' && !isNaN(Date.parse(value));
}
