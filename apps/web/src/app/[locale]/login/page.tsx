import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/locale";

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <LoginContent />;
}

function LoginContent() {
  const t = useTranslations();
  return (
    <AuthPageShell
      title={t("auth.loginTitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="font-medium text-emerald-700 underline">
            {t("auth.signup")}
          </Link>
        </>
      }
    >
      {/* The form reads ?next= from the URL, which is only known at request time. */}
      <Suspense fallback={<p>{t("common.loading")}</p>}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
