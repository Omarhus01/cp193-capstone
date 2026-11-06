import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { FeedbackButton } from "@/components/surah/FeedbackButton";
import { QaPanel } from "@/components/surah/QaPanel";
import { ReadingControls } from "@/components/surah/ReadingControls";
import { ReadingSectionCard } from "@/components/surah/ReadingSectionCard";
import { ReadingSectionNav } from "@/components/surah/ReadingSectionNav";
import { ReviewNote } from "@/components/surah/ReviewNote";
import { SurahHeader } from "@/components/surah/SurahHeader";
import { SurahReader } from "@/components/surah/SurahReader";
import type { Locale } from "@/i18n/locale";
import { requireUserId } from "@/lib/services/auth/require-user";
import { feedbackFormUrl } from "@/lib/services/feedback";
import { questionsForSection } from "@/lib/services/qa";
import { parsePreferences } from "@/lib/services/reading/preferences";
import { loadSurahPage } from "@/lib/services/reading/surah-page";
import { parseSurahNumber } from "@/lib/services/surah";

type SurahPageProps = PageProps<"/[locale]/surah/[n]">;

/** A surah's verses in reading sections, with their explanations. Logged-in users only. */
export default function SurahPage({ params }: SurahPageProps) {
  // The surah number, the session and the reader's preferences are only known at request time.
  return (
    <Suspense>
      <SurahContent params={params} />
    </Suspense>
  );
}

async function SurahContent({ params }: Pick<SurahPageProps, "params">) {
  const { locale: localeParam, n } = await params;
  const locale = localeParam as Locale;

  const surahNumber = parseSurahNumber(n);
  if (!surahNumber) {
    notFound();
  }
  await requireUserId(locale, `/${locale}/surah/${n}`);

  const [view, cookieStore, t] = await Promise.all([
    loadSurahPage(surahNumber),
    cookies(),
    getTranslations("surah"),
  ]);
  if (!view) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t("title", { number: surahNumber })}</h1>
        <p className="text-ink-muted">{t("unavailable")}</p>
      </section>
    );
  }

  const { sections } = view;
  const feedbackUrl = feedbackFormUrl();
  return (
    <SurahReader
      locale={locale}
      initialPreferences={parsePreferences((name) => cookieStore.get(name)?.value)}
      firstSection={sections[0]?.position ?? 1}
    >
      <ReviewNote />
      <PageLayout
        sidebar={
          <ReadingSectionNav
            sections={sections.map(({ position, anchor, label, previewAr, published }) => ({
              position,
              anchor,
              label,
              previewAr,
              published,
            }))}
          />
        }
        aside={
          <div className="flex flex-col gap-4">
            <QaPanel
              variant="panel"
              sectionLabels={Object.fromEntries(sections.map((s) => [s.position, s.label]))}
              questions={view.questions}
            />
            <FeedbackButton url={feedbackUrl} />
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          <SurahHeader
            surah={view.surah}
            shownVerseCount={view.shownVerseCount}
            brief={view.brief}
            locale={locale}
          />
          <ReadingControls hasWordMeanings={Object.keys(view.words).length > 0} />
          {sections.map((section) => (
            <ReadingSectionCard
              key={section.position}
              section={section}
              questions={questionsForSection(view.questions, section.position)}
              locale={locale}
            />
          ))}
          {/* On phones the right column is hidden, so the feedback form comes at the end. */}
          <div className="lg:hidden">
            <FeedbackButton url={feedbackUrl} />
          </div>
        </div>
      </PageLayout>
    </SurahReader>
  );
}
