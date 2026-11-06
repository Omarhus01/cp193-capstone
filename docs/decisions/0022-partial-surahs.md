# 0022. A surah can publish only some of its verses

- Status: Accepted
- Date: 2026-11-06
- Issue: #46

## Context

Until now, a surah's folder in `content/` had to hold every verse of the surah. The content checks required `text.json` to have all of them, numbered 1, 2, 3…, and required the reading sections to run from the first verse to the last.

We want to explain single verses that readers ask about, starting with An-Nisa 4:34. An-Nisa has 176 verses. Under the old rules, adding 4:34 meant importing all 176 verses and showing 175 of them with no explanation, or explaining the whole surah first.

## Decision

- **A surah folder may hold only the verses we include.**
  - `text.json` and `words.json` list those verses: in ascending order, each once, each between 1 and the surah's verse count.
  - `verseCount` stays the surah's full count from Tanzil (176 for An-Nisa), so it still matches `quran-metadata.json`.
  - A complete surah, such as Al-Fatiha, is the case where every verse is included. Its rules are the same as before.
- **The Arabic is always imported, never typed.** The Tanzil importer takes verses as well as whole surahs:
  - `4:34` imports one verse.
  - `4:34-36` imports verses 34 to 36.
  - `4` imports the whole surah.

  The arguments decide exactly which verses the folder holds. Verses it held before that aren't listed are dropped, and the importer prints them.
- **Reading sections cover only the included verses.** They go in order, don't overlap, and every included verse is in one section. A missing verse isn't a gap, but a section can't run over a verse that isn't included.
- **Every span of whole verses covers only included verses.** This applies to explanations, fixed questions and context links. Before, only the two ends of a span were checked. Now the verses between the ends must be included too.
- **The surah page shows only the included verses.** When it shows fewer than the whole surah, a line under the surah's details says so: "Showing 1 of 176 verses" in English, "전체 176절 중 1절 표시" in Korean. A surah without reading sections numbers its verse blocks 1, 2, 3, not by verse number.
- **No database change.** The database already keeps the surah's full verse count apart from its verse rows, and the seed writes only the verses in the files. Readers still see published content only.

## Alternatives

- **A list of included verses in `surah.json`:** it would say the same thing as `text.json`, and the two could disagree.
- **Import the whole surah and hide the verses without explanations:** the folder would hold verses the page never shows. "Explanation coming soon" would also stand under 175 verses that nobody plans to explain yet.
- **Allow gaps only at the start or end (a range such as 4:30–40):** simpler to check, but single verses from different places in a surah, such as 4:34 and 4:59, are the point of this change.

## Consequences

- A single verse can be published as soon as its explanation is reviewed, without waiting for the rest of its surah.
- Verse references to a verse that isn't included stay plain text, as references to surahs that aren't imported already do. They become links once that verse is imported.
- To add a verse to a partial surah, run the importer again with every verse the folder should hold (`4:34 4:59`), not only the new one.
