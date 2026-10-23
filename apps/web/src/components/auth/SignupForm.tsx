"use client";

import { useSearchParams } from "next/navigation";
import { AuthForm } from "./AuthForm";

/** The signup form, with `?next=` read from the URL. */
export function SignupForm() {
  const next = useSearchParams().get("next") ?? undefined;
  return <AuthForm mode="signup" next={next} />;
}
