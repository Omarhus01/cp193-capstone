import Link from "next/link";

export function SiteNav() {
  return (
    <nav aria-label="Main navigation">
      <ul className="flex gap-4 text-sm font-medium text-zinc-700">
        <li>
          <Link href="/" className="hover:text-emerald-800">
            Home
          </Link>
        </li>
        <li>
          <Link href="/surah/1" className="hover:text-emerald-800">
            Surah
          </Link>
        </li>
      </ul>
    </nav>
  );
}
