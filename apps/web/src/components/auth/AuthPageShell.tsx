import type { ReactNode } from "react";

type AuthPageShellProps = {
  title: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthPageShell({ title, children, footer }: AuthPageShellProps) {
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
      <p className="text-sm text-zinc-600">{footer}</p>
    </section>
  );
}
