import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { fontVariables } from "@/app/fonts";
import { Header } from "@/components/layout/Header";
import { routing } from "@/i18n/routing";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("title"),
    description: t("description"),
    // Renders <meta name="google" content="notranslate">. See translate="no" below.
    other: { google: "notranslate" },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    // Page translators rewrite the text React manages, which breaks hydration, and machine
    // translation can turn 알라 into "God". The site provides its own EN/KO versions instead.
    <html lang={locale} translate="no" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white text-zinc-900">
        <NextIntlClientProvider>
          <Header />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
