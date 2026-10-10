import Link from "next/link";
import { SiteNav } from "./SiteNav";

export function Header() {
  return (
    <header className="border-b border-zinc-200">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-emerald-800">
          Quran Explained
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
