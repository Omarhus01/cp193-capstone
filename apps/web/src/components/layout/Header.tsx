import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SiteNav } from "./SiteNav";

export function Header() {
  const t = useTranslations("header");
  return (
    <header className="border-b border-zinc-200">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-emerald-800">
          {t("logo")}
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
