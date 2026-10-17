export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Keys under `auth.errors` in the messages files. */
export type AuthErrorKey =
  | "invalidEmail"
  | "passwordTooShort"
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "signupFailed"
  | "confirmFailed";

export type Credentials = { email: string; password: string };

export function readCredentials(formData: FormData): Credentials {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export function validateCredentials({ email, password }: Credentials): AuthErrorKey | null {
  if (!EMAIL_PATTERN.test(email)) {
    return "invalidEmail";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return "passwordTooShort";
  }
  return null;
}
