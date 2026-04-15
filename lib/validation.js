/**
 * Lightweight validation helpers for API route inputs.
 * Each helper returns the parsed value or throws ValidationError.
 */

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.status = 400;
  }
}

export function asString(value, field, { max = 500, allowEmpty = false } = {}) {
  if (value === null || value === undefined) {
    if (allowEmpty) return null;
    throw new ValidationError(`${field} kötelező`, field);
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} hibás típus`, field);
  }
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) {
    throw new ValidationError(`${field} nem lehet üres`, field);
  }
  if (trimmed.length > max) {
    throw new ValidationError(`${field} túl hosszú (max ${max})`, field);
  }
  return trimmed;
}

export function asPositiveInt(value, field, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw new ValidationError(`${field} érvénytelen szám`, field);
  }
  if (n > max) {
    throw new ValidationError(`${field} túl nagy`, field);
  }
  return n;
}

export function asNumberInRange(value, field, { min, max }) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) {
    throw new ValidationError(`${field} érvénytelen szám`, field);
  }
  if (n < min || n > max) {
    throw new ValidationError(`${field} kívül van az engedélyezett tartományon`, field);
  }
  return n;
}

export function asIsoDate(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError(`${field} érvénytelen dátum`, field);
  }
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`${field} érvénytelen dátum`, field);
  }
  return value;
}

export function asEnum(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw new ValidationError(`${field} érvénytelen érték`, field);
  }
  return value;
}

export function asUuid(value, field) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new ValidationError(`${field} érvénytelen UUID`, field);
  }
  return value;
}

/**
 * Wrap a route handler so any thrown ValidationError becomes
 * a 400 JSON response instead of bubbling up as a 500.
 */
export function withValidationErrors(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ValidationError) {
        return new Response(
          JSON.stringify({ error: err.message, field: err.field }),
          { status: err.status, headers: { 'content-type': 'application/json' } }
        );
      }
      if (err instanceof Response) return err;
      throw err;
    }
  };
}
