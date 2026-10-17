import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/locale";

export default async function SignupPage({ params }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <SignupContent />;
}

function SignupContent() {
  const t = useTranslations("auth");
  return (
    <AuthPageShell
      title={t("signupTitle")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-medium text-emerald-700 underline">
            {t("login")}
          </Link>
        </>
      }
    >
      <AuthForm mode="signup" />
    </AuthPageShell>
  );
}
