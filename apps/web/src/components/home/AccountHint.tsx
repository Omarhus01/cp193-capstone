import { getTranslations } from "next-intl/server";
import { getCurrentUserId } from "@/lib/services/auth/accounts";

/** Tells logged-out users that the surah pages need an account. Render inside <Suspense>. */
export async function AccountHint() {
  const userId = await getCurrentUserId();
  if (userId) {
    return null;
  }
  const t = await getTranslations("home");
  return <p className="text-sm text-zinc-500">{t("accountHint")}</p>;
}
