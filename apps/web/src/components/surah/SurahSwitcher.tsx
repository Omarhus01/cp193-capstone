"use client";

import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { ChevronDownIcon } from "@/components/icons";
import { ArabicText } from "@/components/text/ArabicText";
import { useDismiss } from "@/components/use-dismiss";
import { Link } from "@/i18n/navigation";
import type { SurahLink } from "@/lib/services/surah-list";
import { filterSurahs } from "@/lib/services/surah-search";

type SurahSwitcherProps = { surahs: SurahLink[]; current: number };

/**
 * The surah header's "All surahs" button. It opens a search box over the list of surahs, which
 * finds one by number or by Arabic, English or Korean name. Escape, a press outside, or opening a
 * surah closes it. The panel is placed against the nearest positioned element around it (the
 * header's top row), so it is never wider than the header, and so never wider than a phone.
 */
export function SurahSwitcher({ surahs, current }: SurahSwitcherProps) {
  const t = useTranslations("surah.switcher");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const panelId = useId();
  const searchId = useId();
  const matches = useMemo(() => filterSurahs(surahs, query), [surahs, query]);

  const close = useCallback((reason: "escape" | "outside" | "link" | "toggle") => {
    setOpen(false);
    setQuery("");
    if (reason === "escape") {
      button.current?.focus();
    }
  }, []);
  useDismiss(open, close, container);

  // On open: focus the search box, and scroll the list (not the page) to the current surah.
  useEffect(() => {
    if (!open) {
      return;
    }
    search.current?.focus();
    const currentItem = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (list.current && currentItem) {
      list.current.scrollTop = currentItem.offsetTop - list.current.clientHeight / 2;
    }
  }, [open]);

  function links() {
    return [...(list.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];
  }

  // Down arrow from the search box goes to the first surah; up and down move through the list,
  // and up from the first goes back to the search box.
  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      links()[0]?.focus();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const all = links();
    const index = all.indexOf(document.activeElement as HTMLAnchorElement);
    const next = index + (event.key === "ArrowDown" ? 1 : -1);
    if (next < 0) {
      search.current?.focus();
    } else {
      all[Math.min(next, all.length - 1)]?.focus();
    }
  }

  function onPanelClick(event: MouseEvent) {
    if ((event.target as HTMLElement).closest("a")) {
      close("link");
    }
  }

  return (
    <div ref={container}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close("toggle") : setOpen(true))}
        className="flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-ink hover:bg-page focus-visible:outline-2 focus-visible:outline-brand"
      >
        {t("open")}
        <ChevronDownIcon className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          id={panelId}
          onClick={onPanelClick}
          className="absolute inset-x-0 top-full z-30 mt-2 rounded-xl border border-line bg-white p-3 shadow-lg sm:right-auto sm:w-96"
        >
          <label htmlFor={searchId} className="mb-1 block text-xs font-semibold text-ink-muted">
            {t("searchLabel")}
          </label>
          <input
            ref={search}
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            className="w-full min-w-0 rounded-md border border-line bg-page px-3 py-2 text-base"
          />
          <p aria-live="polite" className="mt-2 px-1 text-xs text-ink-muted">
            {t("matches", { count: matches.length })}
          </p>
          <ul
            ref={list}
            onKeyDown={onListKeyDown}
            className="relative mt-1 max-h-80 overflow-y-auto overscroll-contain"
          >
            {matches.map((surah) => {
              const isCurrent = surah.number === current;
              return (
                <li key={surah.number}>
                  <Link
                    href={`/surah/${surah.number}`}
                    aria-current={isCurrent ? "page" : undefined}
                    className={`flex min-w-0 items-baseline justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-page focus-visible:outline-2 focus-visible:outline-brand ${
                      isCurrent ? "bg-brand-soft font-semibold" : ""
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-ink-muted tabular-nums">{surah.number}.</span>{" "}
                      {surah.name}
                    </span>
                    <ArabicText as="span" size="sm" className="shrink-0 text-ink-muted">
                      {surah.nameAr}
                    </ArabicText>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
