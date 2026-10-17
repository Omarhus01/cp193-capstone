import { getLocale, getTranslations } from "next-intl/server";
import { logOut } from "@/app/[locale]/auth-actions";
import { Link } from "@/i18n/navigation";
import { getCurrentUserId } from "@/lib/supabase/server";

const linkClass = "text-sm font-medium text-zinc-700 hover:text-emerald-800";

/** Log in / Sign up links, or a Log out button when a user is logged in. */
export async function AuthControls() {
  const [t, locale, userId] = await Promise.all([
    getTranslations("auth"),
    getLocale(),
    getCurrentUserId(),
  ]);

  if (userId) {
    return (
      <form action={logOut}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className={linkClass}>
          {t("logout")}
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/login" className={linkClass}>
        {t("login")}
      </Link>
      <Link
        href="/signup"
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
      >
        {t("signup")}
      </Link>
    </div>
  );
}
