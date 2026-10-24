import { useTranslations } from "next-intl";
import type { AuthErrorKey } from "@/lib/services/auth/validation";

export function FormError({ errorKey }: { errorKey: AuthErrorKey | null }) {
  const t = useTranslations("auth.errors");
  if (!errorKey) {
    return null;
  }
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
      {t(errorKey)}
    </p>
  );
}
