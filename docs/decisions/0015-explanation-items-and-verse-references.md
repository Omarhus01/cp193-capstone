# 0015. Explanations are items with their own citations; related verses are references

- Status: Accepted
- Date: 2026-10-25
- Issue: #27

## Context

The owner's Al-Fatiha draft (`docs/content-drafts/al-fatiha.md`, #22) writes each part of an explanation as bullets. Each bullet ends with the sources behind it, sometimes several: "Ibn ʿUthaymīn; al-Qurṭubī, quoting Qatādah", or "Muslim, via Ibn Kathīr, vol. 1, pp. 101–111". Readers need to see which scholar said what, and a hadith's attribution to Muslim or al-Bukhārī must not be lost.

The model from [0011](0011-content-in-git-seeded-into-supabase.md) stored each part as one text and the citations once per explanation, so every claim would have pointed to every source.

The draft's related verses and the word meanings' "Elsewhere" notes point to verses outside Al-Fatiha (27:30, 109:6, 26:165, …). Context links ([0012](0012-explanations-attach-to-spans.md)) must point to imported text, so they would have meant importing a dozen surahs first.

The draft also uses bold and italic for the terms it explains.

## Decision

- **Items:**
  - Each part of an explanation (word meanings, background, context, related verses) is a list of items. Each item has English and Korean text and its own citations.
  - The surah brief is a list of paragraphs, built the same way.
  - In the database: `explanation_item` and `surah_brief_item`, each with its own citation table.
  - `explanation_citation` remains, as the explanation's distinct passages in the order they're first cited. The seed derives it, and the rule that makes a passage public uses it.
- **Who a source quotes:** a citation may carry `quoting`, the person the passage quotes or narrates from, as the draft names them.
  - The page labels such a source "Muslim, via Ibn Kathīr, Tafsīr al-Qurʾān al-ʿAẓīm, vol. 1, pp. 101–111".
  - The chip reads "Source N", numbered by the first time the passage is cited in that explanation. The full label is its accessible name and tooltip.
- **Verse references:**
  - Related verses and Elsewhere notes refer to a verse by surah and ayah, with no foreign key to `verse`.
  - Validation checks them against Tanzil's verse counts for all 114 surahs (`content/quran-metadata.json`, written by `npm run content:import-tanzil-metadata`), not against `content/`.
  - The page shows a reference as text, and as a link once that verse is in the database. Nobody has to re-enter it when the surah is imported.
- **Elsewhere notes replace the root lookup:** a word meaning carries the owner's Elsewhere notes, each a verse (or none, for a note on Arabic usage) with text in both languages. The popover shows these notes. It no longer lists other words with the same root, which put الرحيم's meaning under الرحمن as if it were the same word.
- **Formatting:** content text may use `**bold**`, `*italic*` and blank-line paragraphs, and nothing else. The page turns them into elements, never into HTML.
- **Review rules carry over:**
  - from `ko_drafted` on, every English item, note and reason needs its Korean
  - a published explanation or brief needs a citation on every item
  - a published word meaning needs at least one citation

## Alternatives

- **Keep the tags in the text** ("**[Ibn Kathīr]**"): no model change, but readers would see raw tags, the Korean has no tags, and the links wouldn't work.
- **Citations per explanation, tags removed:** simple, but readers can't tell which claim each source supports.
- **Footnote markers inside the text** ("…the Owner.[2]"): exact placement within a bullet, but the owner would maintain marker numbers by hand in two languages. A bullet is the unit the draft already uses.
- **Import every referenced surah so context links can be used:** about 900 verses of text, and their pages would show only "coming soon".
- **Full Markdown:** lists, headings and links in content text could break the page layout and would need an HTML sanitizer. The draft needs only inline emphasis.

## Consequences

- Where a tag sits inside a bullet is lost: a bullet with two tags cites both sources for the whole bullet.
- The migration drops the old part columns. Existing text moves into single items, and text in a related-verses part blocks the migration, because it has no verse to point to.
- Context links remain for spans inside imported text. Related verses are the usual way to point outside the explanation.
- `content/quran-metadata.json` is generated from Tanzil and must not be edited by hand. Its license notice is kept.
