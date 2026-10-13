import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SiteNav() {
  const t = useTranslations("header");
  return (
    <nav aria-label={t("navLabel")}>
      <ul className="flex gap-4 text-sm font-medium text-zinc-700">
        <li>
          <Link href="/" className="hover:text-emerald-800">
            {t("home")}
          </Link>
        </li>
        <li>
          <Link href="/surah/1" className="hover:text-emerald-800">
            {t("surah")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
