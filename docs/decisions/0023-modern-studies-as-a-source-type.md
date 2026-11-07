# 0023. Modern studies as a kind of source

- Status: Accepted
- Date: 2026-11-06
- Issue: #53

## Context

Every source in `content/sources/` has a type, and until now there were four: `tafsir`, `asbab_al_nuzul` (reasons for revelation), `word_dictionary` and `hadith`. The same list is an enum in the database (`public.source_type`).

Draft 9 of An-Nisa 4:34 adds a question on whether ḍaraba in that verse means "strike" or "go away from them". Its answer cites three modern works: Laleh Bakhtiar's English translation of the Quran (2007), ʿAbd al-Ḥamīd Abū Sulaymān's book on the question (2010), and Habeebullah Zakariyah's journal article criticizing that book (2018). None of them is a tafsir, a book of reasons for revelation, a dictionary or a hadith collection.

The rest of the source rules already fit them. A link can be any `https://` address, not only Shamela, and the quoted Arabic text can be `null`, as it is for the other modern works, which are summarized rather than quoted.

## Decision

- **A fifth type, `modern_study`:** modern writing about the Quran that is not a tafsir, a hadith collection or a dictionary, such as a translation, a book or a journal article.
- **A modern tafsir stays `tafsir`.** Ibn ʿĀshūr, al-Jazāʾirī and al-Shinqīṭī are modern, but they are tafsir books.
- **The value is added by a new migration** (`alter type … add value`). Adding a value keeps the code already on `main` working, so the usual order holds: push the database change, load the content, then merge.
- **The page doesn't show the type.** A source chip names the author, the title, the edition and the pages, the same way for every type.

## Alternatives

- **Record them as `tafsir`:** no schema change, but the data would say something false about three sources, and anything that later filters or labels sources by type (the question-answering service, for example) would treat a translation as a tafsir.
- **One type each (`translation`, `book`, `article`):** more precise, but nothing reads the difference today, and three values are harder to keep apart than one. A type can be split later by a migration if something needs it.

## Consequences

- The four existing types keep their meaning. Only new modern works that are not tafsir use `modern_study`.
- The database has to be updated before content with the new type is loaded; otherwise the seed fails on the unknown value.
