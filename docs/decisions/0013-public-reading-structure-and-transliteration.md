# 0013. Reading structure is public; transliteration is reviewed per language

- Status: Accepted
- Date: 2026-10-24
- Issue: #2

## Context

The verse page (#2, `docs/design/`) shows every reading section of a surah. A section whose explanation isn't published yet still shows its verses, says "Explanation coming soon", and is marked "In review" in the section list. Under [0011](0011-content-in-git-seeded-into-supabase.md), a reader couldn't see a `reading_section` row until its explanation was published, so the page couldn't tell where an unpublished section starts and ends.

The design also shows a pronunciation line under the Arabic: Latin letters on English pages, Hangul on Korean pages. The content model had no place for it. The two are written by different people: the owner can write and check the Latin, and the Hangul is left for Korean Muslim reviewers, because Hangul can only approximate some Arabic sounds (`docs/content-drafts/al-fatiha.md`).

## Decision

- **Reading sections are public structure.** `reading_section` gets its own `span_id`, and anyone can read the table: the surah, the position and the span. The explanation's text, citations and context links stay readable only once published. The content validation keeps the section's span equal to its explanation's span, and the seed writes both.
- **Transliterations are owner content, one per verse and language.**
  - **Storage:** `verse_transliteration` has one row per (surah, ayah, language), with `en` for Latin and `ko` for Hangul. The content file is `content/surahs/NNN/transliterations.json`.
  - **Review:** each language has its own short track, reusing the existing statuses: Latin goes `draft → en_approved → published`, and Hangul goes `draft → ko_approved → published`. `lib/services/review.ts` names these tracks (`REVIEW_TRACKS`), and a database check accepts only the statuses of the row's track.
  - **Who sees it:** readers see published transliterations only, and the review history is private, as for other content.
- **Display:** a page shows the transliteration in its own language and leaves the line out when there is none. It never falls back to the other language.

## Alternatives

- **Derive section boundaries from the published sections:** an unpublished stretch could be shown as one block between published ones. But two unpublished sections in a row would merge, and the section list couldn't show them separately.
- **A database function that returns the structure without exposing the table:** it keeps the rows private, but the rows hold nothing private. The verses and spans are already public.
- **One transliteration item with English and Korean, on the five bilingual steps:** this is how explanations work. But the Latin line couldn't be published until the Hangul was written and approved, and the Hangul isn't drafted from the Latin.
- **Generating transliterations from the Arabic:** this goes against the content rules. Automatic transliteration of the Uthmani text is also unreliable.

## Consequences

- Anyone can see where each section of a surah starts and ends before its explanation is published. Reading sections are the owner's division of the surah, not religious text, so this is acceptable.
- A transliteration can be published in one language before the other.
- The seed function was replaced in a new migration. Every seed sends the two new keys, `verse_transliterations` and `verse_transliteration_reviews`, even when they are empty.
