"use client";

import { useSearchParams } from "next/navigation";
import { AuthForm } from "./AuthForm";

/** The login form, with `?next=` and `?error=` read from the URL. */
export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;
  const initialError = searchParams.get("error") === "confirmFailed" ? "confirmFailed" : null;
  return <AuthForm mode="login" next={next} initialError={initialError} />;
}
