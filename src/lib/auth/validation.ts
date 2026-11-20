export type AuthErrorCode =
  "invalid_email" | "invalid_password" | "email_taken" | "invalid_credentials";

export type AuthResult<T> = { ok: true; value: T } | { ok: false; error: { code: AuthErrorCode } };

export interface RegistrationInput {
  email: string;
  password: string;
}

const MIN_PASSWORD_CHARS = 8;
/** bcrypt ignores everything after 72 bytes, so longer passwords are rejected, not truncated. */
const MAX_PASSWORD_BYTES = 72;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateRegistration(input: {
  email: unknown;
  password: unknown;
}): AuthResult<RegistrationInput> {
  if (typeof input.email !== "string") return authFailure("invalid_email");
  const email = normalizeEmail(input.email);
  if (!EMAIL_PATTERN.test(email)) return authFailure("invalid_email");

  const { password } = input;
  if (typeof password !== "string") return authFailure("invalid_password");
  if ([...password].length < MIN_PASSWORD_CHARS) return authFailure("invalid_password");
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES)
    return authFailure("invalid_password");

  return { ok: true, value: { email, password } };
}

/** The one way to build a failed AuthResult, so every module returns the same shape. */
export function authFailure(code: AuthErrorCode): { ok: false; error: { code: AuthErrorCode } } {
  return { ok: false, error: { code } };
}
