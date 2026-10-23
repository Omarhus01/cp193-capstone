import { getCurrentUserId } from "@/lib/supabase/server";
import { AuthLinks } from "./AuthLinks";
import { LogoutButton } from "./LogoutButton";

/** Log in / Sign up links, or a Log out button when a user is logged in. Render inside <Suspense>. */
export async function AuthControls() {
  const userId = await getCurrentUserId();
  return userId ? <LogoutButton /> : <AuthLinks />;
}
