import { useTranslations } from "next-intl";

/**
 * Visible but disabled until semantic search lands in sprint 2.
 * The tooltip is CSS-only: disabled inputs get no mouse events, so the wrapper handles hover.
 */
export function SearchBar() {
  const t = useTranslations("header");
  return (
    <div className="group relative w-full sm:w-72">
      <label htmlFor="site-search" className="sr-only">
        {t("searchLabel")}
      </label>
      <input
        id="site-search"
        type="search"
        disabled
        placeholder={t("searchPlaceholder")}
        aria-describedby="site-search-tooltip"
        className="w-full cursor-not-allowed rounded-md border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-500"
      />
      <span
        id="site-search-tooltip"
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 rounded bg-zinc-900 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        {t("searchComingSoon")}
      </span>
    </div>
  );
}
