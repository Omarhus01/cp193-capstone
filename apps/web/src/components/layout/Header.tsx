import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { SearchIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { AuthControls } from "./AuthControls";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileMenu } from "./MobileMenu";
import { SearchBar } from "./SearchBar";
import { SiteNav } from "./SiteNav";

/**
 * The top bar on every page. On phones the navigation, language and account controls move into
 * the menu button's panel.
 */
export function Header() {
  const t = useTranslations("header");
  return (
    <header className="relative border-b border-line bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 lg:px-6">
        <Link href="/" className="shrink-0 text-lg font-semibold text-brand">
          {t("logo")}
        </Link>

        <div className="hidden min-w-0 flex-1 items-center gap-6 md:flex">
          <SiteNav />
          <SearchBar />
          <div className="ml-auto flex items-center gap-4">
            {/* Both read request data (URL, session cookie), so they stream in after the shell. */}
            <Suspense fallback={<span className="inline-block w-36" />}>
              <LanguageSwitcher />
            </Suspense>
            <Suspense fallback={null}>
              <AuthControls variant="menu" />
            </Suspense>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1 md:hidden">
          {/* Search arrives in sprint 2, like the disabled search bar on wider screens. */}
          <button
            type="button"
            disabled
            aria-label={t("searchComingSoon")}
            title={t("searchComingSoon")}
            className="cursor-not-allowed rounded-md p-2 text-ink"
          >
            <SearchIcon className="size-6" />
          </button>
          <MobileMenu openLabel={t("menu")} closeLabel={t("closeMenu")}>
            <SiteNav />
            <Suspense fallback={null}>
              <LanguageSwitcher />
            </Suspense>
            <Suspense fallback={null}>
              <AuthControls variant="inline" />
            </Suspense>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
