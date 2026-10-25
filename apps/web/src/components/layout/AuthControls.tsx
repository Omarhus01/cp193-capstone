import { getTranslations } from "next-intl/server";
import { getCurrentUserId } from "@/lib/services/auth/accounts";
import { AccountMenu } from "./AccountMenu";
import { AuthLinks } from "./AuthLinks";
import { LogoutButton } from "./LogoutButton";

type AuthControlsProps = {
  /** "menu": an Account button that opens Log out (top bar). "inline": Log out itself (phone menu). */
  variant: "menu" | "inline";
};

/**
 * Log in / Sign up links, or the account controls when a user is logged in. Render inside
 * <Suspense>.
 */
export async function AuthControls({ variant }: AuthControlsProps) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return <AuthLinks />;
  }
  if (variant === "inline") {
    return <LogoutButton />;
  }
  const t = await getTranslations("header");
  return (
    <AccountMenu label={t("account")}>
      <LogoutButton />
    </AccountMenu>
  );
}
