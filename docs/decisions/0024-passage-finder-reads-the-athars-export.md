# 0024. A passage finder that reads the Athars export outside the repository

- Status: Accepted
- Date: 2026-11-25
- Issue: #59 (passage finder for new verses)

## Context

Explaining a new verse starts with reading what the tafsir books say about it. Until now that meant opening each book on Shamela, finding the verse, and copying the pages by hand.

Athars, Ali's project ([decision record: Athars as the search](0021-athars-search-and-shamela-links.md)), has an export of its books as files. It has 61 books: for each, the pages with their Shamela ids (`<id>.jsonl`) and the table of contents (`<id>.toc.json`). It is 1.3 GB, and the books aren't this project's to publish.

The books don't mark verses the same way. Checking all 61:

- Some headings give the surah and verses ("[surah (4): verse 34]"), some only a number, some a range.
- Some headings quote the verse, often without its number, in plain spelling. Tanzil's text uses the Uthmani spelling, which leaves out many long vowels.
- Some tables of contents list surahs only.
- A few headings are wrong: they name another surah, or print a wrong verse number. One book's file is damaged: 703 of its records also hold the pages after them.

## Decision

- **The export stays outside the repository, and so does the result.** The script reads the folder it is given and writes `found/<surah>-<verse>.md` in it. It refuses a folder inside the repository. The tests use a small made-up export with placeholder Arabic.
- **It copies text and does nothing else.** It removes the HTML and keeps the Arabic as it is. It writes no explanations or translations and never edits `content/`.
- **A section runs from the verse's heading to the next verse or surah heading.** Pages are copied whole. The page of the next heading is included only if the section can still be running on it.
- **Anything not certain is labelled "check"** in the file, with how it was found:
  - no heading for the verse, so the section of the verse before it;
  - a heading that quotes the verse, matched by its words or only by its printed number;
  - a verse number found in the pages of a book that lists surahs only;
  - a heading whose number breaks the order.
- **Order is the test for mislabelled headings and page numbers.** The books follow the order of the Quran. Surah headings are trusted only in that order, and numbers in pages count as verse numbers only if they rise; footnote numbers look the same and drop out. A book that may have the verse under a wrong heading is listed as not found, with a link to look.
- **Quoted headings are matched with Tanzil's text**, an optional argument. Both sides are normalized (no diacritics, tatweel or Quran marks; one form of alef, ya and ta marbuta). That alone matches 33 of the 81 headings of Ya-Sin, because of the Uthmani spelling, so the comparison also leaves out alef, waw, ya, hamza and spaces: 80 of 81. This is used only to compare. The text in the file is never normalized.
- **The logic is pure** (`apps/web/src/lib/services/passages/`). Only the scripts read and write files (`apps/web/scripts/`).

## Alternatives

- **Ask the Athars search.** It finds passages by the meaning of a question and returns the closest ones. Preparing a verse needs every book's whole section on it.
- **Copy the books into the repository or the database.** It would publish books that aren't ours, and the site doesn't need them: readers open the cited page on Shamela. The chat still has no copy of the books.
- **Use only the tables of contents.** Simpler, but it leaves out Ibn Kathir and the other books that list surahs only.

## Consequences

- One command gathers the pages of 14 to 20 books for a verse in about ten seconds.
- The file is a reading aid. Labelled results have to be checked on Shamela before they are cited, and a person still writes and reviews every explanation.
- Editions in the export can differ from those already cited. Those of Ibn Kathir, al-Baghawi and Adwa al-Bayan do. Citing a page of the export's edition needs its own source record.
- Books that aren't in the export (al-Qurtubi, Ibn Ashur, al-Raghib) still have to be looked up by hand.
- A short surah with one heading and no verse numbers in its pages is listed as not found, with a link to its start.
