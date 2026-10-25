import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SiteNav() {
  const t = useTranslations("header");
  return (
    <nav aria-label={t("navLabel")}>
      <ul className="flex gap-5 text-sm text-ink-muted">
        <li>
          <Link href="/" className="hover:text-brand">
            {t("home")}
          </Link>
        </li>
        <li>
          {/* The surah index comes with #6; until then this opens Al-Fatiha. */}
          <Link href="/surah/1" className="hover:text-brand">
            {t("surah")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
