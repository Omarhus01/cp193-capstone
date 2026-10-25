import type { ReactNode } from "react";

type PageLayoutProps = {
  /** The left column, which each page fills with its own navigation. Shown above the page on phones. */
  sidebar?: ReactNode;
  children: ReactNode;
  /** The right column, on wide screens only. A page that needs it on phones shows it inline. */
  aside?: ReactNode;
};

const COLUMNS = {
  both: "lg:grid-cols-[11rem_minmax(0,1fr)_18rem]",
  sidebar: "lg:grid-cols-[11rem_minmax(0,1fr)]",
  aside: "lg:grid-cols-[minmax(0,1fr)_18rem]",
  none: "",
};

/** The columns under the top bar (ADR 0014). Pages without a sidebar or aside don't need it. */
export function PageLayout({ sidebar, children, aside }: PageLayoutProps) {
  const columns = sidebar && aside ? "both" : sidebar ? "sidebar" : aside ? "aside" : "none";
  return (
    <div className={`flex flex-col gap-6 lg:grid lg:items-start ${COLUMNS[columns]}`}>
      {sidebar ? <div className="lg:sticky lg:top-6">{sidebar}</div> : null}
      <div className="min-w-0">{children}</div>
      {aside ? <aside className="hidden lg:sticky lg:top-6 lg:block">{aside}</aside> : null}
    </div>
  );
}
