# 0025. Every verse shows; verses without an explanation are grouped by mushaf page

- Status: Accepted
- Date: 2026-11-26
- Issue: #63

## Context

Until now the site held Al-Fatiha and one verse of An-Nisa (4:34). Readers could open only those. We want readers to be able to open any surah and read its Arabic, even before its explanations are written, so the whole Quran is imported from Tanzil: 114 surahs and 6,236 verses.

Most of those verses have no explanation yet, and no reading sections. Two rules stood in the way:

- Reading sections had to cover every verse a surah holds. A full An-Nisa with only 4:34 explained broke that rule.
- A surah without reading sections showed one block per verse, each with its own "Explanation coming soon" box. Al-Baqara would have had 286 boxes and 286 entries in the section list.

## Decision

- **Every verse shows.** The surah page shows every verse the surah holds, explained or not.
- **Reading sections cover only the stretches that are explained.** They still go in order, don't overlap, and cover only imported verses. Verses before, between or after them belong to no section.
- **Verses with no section are grouped by mushaf page.** Tanzil's metadata marks where each of the 604 pages of the printed Madani mushaf starts. The metadata import keeps those page starts in `content/quran-metadata.json`, the seed gives every verse its page (a new `page` column on `verse`), and the page groups the verses into blocks such as "Page 3 · 2:6–16" ("3쪽 · 2:6–16" in Korean).
  - A block ends where the page ends, where a reading section starts, and before a verse the surah doesn't hold. So a page cut by an explained section becomes two blocks: An-Nisa shows 4:34 explained between the verses around it.
  - Each block ends with a one-line "Explanation coming soon". It doesn't say "in review", because nothing in it is being reviewed, and the section list doesn't mark it.
  - Nothing is invented: the breaks are Tanzil's, and no explanation, section or translation is written for these verses.
- **The home page lists every surah in the database**, numbered, with its Arabic name, instead of only the surahs with a published explanation.
- **Names.** A new surah's English name is Tanzil's transliteration (`tname`, such as "Al-Baqara"), with no meaning in brackets. The meaning of a name belongs in the surah's content. An-Nisa's names became "An-Nisāʾ" and "알니사" to match. Korean names come from the owner. Until a surah has one, Korean pages title it "수라 2" with the English name beside it, in the place where the English name follows a Korean name today, and the "수라 2" chip under the title isn't repeated.

## Measurements

A production build against a local Supabase seeded with the whole Quran, logged in, in Chromium (2026-11-26):

| Page              | Blocks | Verses | HTML     | HTML compressed | First byte | Loaded |
| ----------------- | -----: | -----: | -------- | --------------- | ---------: | -----: |
| Al-Fatiha (en)    |      4 |      7 | 0.25 MB  | 42 KB           |       8 ms | 107 ms |
| Al-Baqara (en)    |     48 |    286 | 1.04 MB  | 105 KB          |       7 ms | 215 ms |
| Al-Baqara (ko)    |     48 |    286 | 1.04 MB  | 107 KB          |       8 ms | 204 ms |
| An-Nisa (en)      |     31 |    176 | 0.85 MB  | 114 KB          |      11 ms | 148 ms |
| Home, 114 surahs  |      – |      – | 0.15 MB  | 20 KB           |       7 ms |  76 ms |

- **The seed** sends 6.5 MB in one call and took 5.3 s the first time and 2.4 s when nothing had changed. Verses and words whose text hasn't changed are no longer rewritten.
- **The longest surah loads whole.** Supabase caps a response at 1,000 rows, but the cap applies to the top-level rows (286 verses), not to the words inside them. A database test checks that every word of Al-Baqara comes back.
- **Caching** is unchanged: each surah's published content is one `"use cache"` entry with a lifetime of minutes. On Vercel these entries rarely outlive a request, so the database round trip is the real cost; the numbers above say it is small.
- **No size fix was needed.** Al-Baqara's page is about 1 MB of HTML, mostly Arabic text, and about 105 KB compressed, the size of one photo. Sending each verse as plain text instead of one entry per word would shrink it, but at the cost of a second way to draw a verse, so it waits until a real reader on a slow connection says it is slow.

## Alternatives

- **One block per stretch of unexplained verses:** Al-Baqara would be one block of 286 verses, and the section list couldn't help readers find a place in it.
- **Fixed blocks of 10 verses:** even, but the breaks fall in the middle of passages and follow no tradition.
- **One block per verse (the old behaviour):** hundreds of coming-soon boxes and a very long section list.
- **Store the page breaks in `text.json`:** that file is Tanzil's text, kept verbatim. The page breaks are Tanzil's metadata, so they live with the rest of it in `quran-metadata.json`.
- **Write reading sections for every surah:** where a section starts and ends is an editorial decision for the owner, not something to generate.

## Consequences

- Any surah can be opened and read in Arabic now. When an explanation is published, its reading section takes its verses out of the page blocks around it, with no other change.
- This replaces two parts of earlier decisions: reading sections no longer have to cover every verse ([0013](0013-public-reading-structure-and-transliteration.md), [0022](0022-partial-surahs.md)), and a surah without sections no longer shows one block per verse (0022).
- A partial surah still works as before (0022): a block also ends before a verse the folder doesn't hold.
- The page column must be seeded: until it is, verses have no page and are grouped by the other breaks only.
