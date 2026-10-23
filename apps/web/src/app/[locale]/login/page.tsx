import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { Link } from "@/i18n/navigation";

export default function LoginPage() {
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
