import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { Link } from "@/i18n/navigation";

export default function SignupPage() {
  const t = useTranslations();
  return (
    <AuthPageShell
      title={t("auth.signupTitle")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="font-medium text-emerald-700 underline">
            {t("auth.login")}
          </Link>
        </>
      }
    >
      {/* The form reads ?next= from the URL, which is only known at request time. */}
      <Suspense fallback={<p>{t("common.loading")}</p>}>
        <SignupForm />
      </Suspense>
      <p className="text-sm text-zinc-600">{t("auth.signupEmailNote")}</p>
    </AuthPageShell>
  );
}
