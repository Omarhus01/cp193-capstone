import { useTranslations } from "next-intl";

/**
 * On every page. Tanzil's license requires naming the Tanzil Project, with a link to tanzil.net,
 * wherever its Quran text is shown (content/README.md).
 */
export function SiteFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="mx-auto w-full max-w-7xl px-4 pt-4 pb-10 text-xs text-ink-muted lg:px-6">
      <p>
        {t.rich("quranText", {
          link: (chunks) => (
            <a href="https://tanzil.net" className="text-brand underline underline-offset-2">
              {chunks}
            </a>
          ),
        })}
      </p>
    </footer>
  );
}
