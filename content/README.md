# content

The Quran text, explanations, word meanings and sources the platform shows. Files here are reviewed through pull requests and loaded into Supabase by the seed script. The site reads only from Supabase ([ADR 0011](../docs/decisions/0011-content-in-git-seeded-into-supabase.md)).

The project owner provides and validates all religious content. Never add explanations, translations, word meanings, summaries or roots by hand or by generation, not even as placeholders. The Quran text comes only from Tanzil, through the import script.

## Layout

```
content/
  schema/                  JSON Schema of each file (generated, see "Changing the schema")
  surahs/001/
    text.json              Quran text from Tanzil. Generated; never edit it.
    words.json             the words of each verse. Generated; the owner fills in `root`.
    surah.json             names (en, ko) and the surah brief. Owner.
    explanations.json      explanations: phrase notes, verse explanations, reading sections. Owner.
    reading.json           the order of the reading sections. Owner.
    word-meanings.json     what words mean in their verse. Owner. Optional.
    transliterations.json  how each verse is pronounced, in Latin letters and Hangul. Owner. Optional.
  sources/<source id>.json a source and the passages cited from it. Owner.
```

Every file starts with `"$schema"`, so VS Code autocompletes fields and flags mistakes while you edit.

## Quran text

`text.json` holds the [Tanzil](https://tanzil.net) Uthmani text (version 1.1), verbatim, with pause marks, sajdah and rub-el-hizb signs, and tatweel below superscript alefs (every download option on). Tanzil's terms:

- The text may not be changed. Nobody edits `text.json`; to update it, run the importer again.
- Tanzil's notice is kept in every file derived from the text (the `attribution` field of `text.json` and `words.json`).
- Every page that shows verses must name Tanzil Project as the source and link to tanzil.net.

**Verse numbering follows the Hafs mushaf, as Tanzil does.** The Basmala is verse 1:1 of Al-Fatiha. For the other surahs except At-Tawbah, the Basmala comes before verse 1 and isn't numbered: it is in `surah.basmala` of `text.json`. Scholars differ on whether the Basmala belongs to Al-Fatiha. That difference goes in the explanation content, not in the numbering.

**Pause marks are not words.** Tanzil writes pause marks (ۖ ۗ ۘ ۙ ۚ ۛ ۜ) and signs such as ۞ and ۩ as their own space-separated tokens. They stay in the verse text exactly as Tanzil has them, but `words.json` leaves them out, so word positions count only real words. Joined with single spaces, a verse's words must equal its text without those tokens. The validation test checks this.

To import surahs, download the text as XML and the metadata from Tanzil into a folder outside the repository:

- Text: [tanzil.net/download](https://tanzil.net/download/): Uthmani, with all options left on, format XML (`quran-uthmani.xml`)
- Metadata: [tanzil.net/res/text/metadata/quran-data.xml](https://tanzil.net/res/text/metadata/quran-data.xml)

```bash
npm run content:import-tanzil -- <path>/quran-uthmani.xml <path>/quran-data.xml 2 3
```

The importer writes `text.json` and `words.json`, keeps any roots already filled in for words whose text is unchanged, and creates `surah.json` with empty names if it doesn't exist.

## Spans

Explanations attach to spans of the text, not to verses ([ADR 0012](../docs/decisions/0012-explanations-attach-to-spans.md)). A span runs from one ref to another, inclusive:

| Span                                   | Covers                      |
| -------------------------------------- | --------------------------- |
| `{ "from": "2:60", "to": "2:60" }`     | verse 2:60                  |
| `{ "from": "2:60", "to": "2:61" }`     | verses 2:60 and 2:61        |
| `{ "from": "2:26:5", "to": "2:26:6" }` | words 5 and 6 of verse 2:26 |

A ref without a word position means the whole verse at that end.

- A `phrase_note` runs from word to word inside one verse.
- A `verse_explanation` covers one or more whole verses.
- A `reading_section` covers whole verses. The sections listed in `reading.json` must cover the surah from its first verse to its last, in order, with no gaps or overlaps.
- `contextLinks` name other spans a reader needs to understand an explanation, with the reason in English and Korean.

An explanation goes in the folder of the surah where its span starts.

Where reading sections start and end is public: the surah page lists every section, and shows "Explanation coming soon" for one whose explanation isn't published yet ([ADR 0013](../docs/decisions/0013-public-reading-structure-and-transliteration.md)). The explanation itself stays hidden until it is published.

## Explanations

```json
{
  "id": "002-note-1",
  "kind": "phrase_note",
  "span": { "from": "2:26:5", "to": "2:26:6" },
  "parts": {
    "wordMeanings": { "en": "…", "ko": "…" },
    "background": { "en": null, "ko": null },
    "context": { "en": "…", "ko": "…" },
    "connectedVerses": { "en": null, "ko": null }
  },
  "citations": ["tabari-1-200"],
  "contextLinks": [
    { "span": { "from": "2:60", "to": "2:60" }, "reason": { "en": "…", "ko": "…" } }
  ],
  "status": "draft",
  "review": []
}
```

The four parts follow the proposal: word meanings, historical background, context, and connected verses. A part that doesn't apply stays `null`. Ids are lowercase words joined by hyphens and are never reused. Citations are passage ids from `content/sources/`.

## Transliterations

`transliterations.json` holds how each verse is pronounced: `en` in Latin letters, shown on English pages, and `ko` in Hangul, shown on Korean pages. Each is written and reviewed on its own, so the Latin line can be published before the Hangul exists ([ADR 0013](../docs/decisions/0013-public-reading-structure-and-transliteration.md)).

```json
{
  "transliterations": [
    {
      "verse": "1:1",
      "language": "en",
      "text": "…",
      "status": "published",
      "review": [
        { "status": "en_approved", "reviewer": "Reviewer name", "date": "2026-10-24" },
        { "status": "published", "reviewer": "Owner", "date": "2026-10-25" }
      ]
    }
  ]
}
```

- `en` goes `draft → en_approved → published`, approved by the Arabic reviewer.
- `ko` goes `draft → ko_approved → published`, approved by a Korean Muslim reviewer.
- A page shows only its own language. A verse without a published transliteration in that language has no pronunciation line.

## Review

Explanations, word meanings and surah briefs go through these steps, one at a time (transliterations have a shorter track, above):

```
draft → en_approved → ko_drafted → ko_approved → published
```

1. **draft:** the owner writes the English.
2. **en_approved:** an Arabic reviewer checks the English against the Arabic and the sources.
3. **ko_drafted:** the Korean is written from the approved English.
4. **ko_approved:** a Korean reviewer approves the Korean. Islamic terms follow the Arabic word (ADR 0008).
5. **published:** the owner publishes it. Only now do readers see it.

To move an item, add a step to its `review` list and set `status` to match, in the same pull request:

```json
"status": "en_approved",
"review": [{ "status": "en_approved", "reviewer": "Reviewer name", "date": "2026-10-24", "notes": "Optional" }]
```

To send an item back (for example, when its English changes after approval), add a step with the earlier status and `notes` saying why. The item then goes through the later steps again.

The validation test fails when:

- a step is skipped, or `status` doesn't match where the history ends
- the dates of the steps go backwards
- the English is approved with no English text, or from `ko_drafted` on, an English part has no Korean
- a published item has no citation
- any text uses 하나님, or "God" as a name (CLAUDE.md, Content rules)

The history is seeded into private tables; readers never see reviewer names or notes.

## Checking and seeding

```bash
npm test               # validates every file here (src/lib/services/content/content.test.ts)
npm run content:seed   # loads content/ into Supabase
```

The seed refuses to run if validation finds any problem. It is a full sync in one transaction: rows that left `content/` are deleted, the rest are inserted or updated, and running it twice gives the same database. If it fails, nothing changes.

It needs the project's service role key (Supabase dashboard: **Project Settings → API**). The key bypasses row level security, so pass it in the shell, never in a file. The URL comes from `NEXT_PUBLIC_SUPABASE_URL` in the shell, or else from `apps/web/.env.local`.

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"; npm run content:seed
```

Seed after every merged content change, and after `npx supabase db push` when a migration changes the content tables. The site caches published content for a few minutes during Sprint 1 ([ADR 0014](../docs/decisions/0014-page-layout-preferences-and-caching.md)), so a seed can take that long to show.

### Testing against a local database

With Docker running, a local Supabase lets you try migrations and the seed without touching the hosted project:

```bash
npx supabase start          # first run downloads the images
npx supabase db reset       # applies supabase/migrations/ to the local database
npx supabase status -o env  # local URL and keys
```

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from that output in the shell. Then:

- `npm run content:seed` seeds the local database.
- `SUPABASE_DB_TEST=1 npm test` also runs `src/lib/data/content.db.test.ts`.
- `E2E_LOCAL_SUPABASE=1 npm run test:e2e` also runs `e2e/surah-page.spec.ts` against the surah page.

Both tests replace the content with fixtures (placeholder text, no religious content) and put `content/` back afterwards. They run only when the URL is local. `npx supabase stop` shuts it down.

## Changing the schema

The schemas are Zod schemas in `apps/web/src/lib/services/content/schema.ts`. After changing them, run `npm run content:schema` to rewrite `content/schema/`. A test fails if the two differ. A change to the shape of the data usually needs a new migration and a change to `payload.ts` too.
