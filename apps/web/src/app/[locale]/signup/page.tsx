import { useTranslations } from "next-intl";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Link } from "@/i18n/navigation";

export default function SignupPage() {
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
