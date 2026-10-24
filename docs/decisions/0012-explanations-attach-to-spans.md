# 0012. Explanations attach to spans

- Status: Accepted
- Date: 2026-10-24
- Issue: #7

## Context

Readers reach an explanation in four ways (proposal §1.1):

1. They pick part of a verse, such as a phrase whose words mean something other than their dictionary sense.
2. They pick a verse that can't be understood without other verses.
3. They read a surah in order.
4. They ask about a topic, through the Q&A panel (#5, #10).

An explanation can be about a few words, one verse, or several verses together, and Quran.com's tafsir covering 66:1 to 66:5 as one block is the problem the proposal wants to avoid.

## Decision

- **Text and numbering:** the Quran text is Tanzil's Uthmani text, and verse numbering follows the Hafs mushaf, as Tanzil does. The Basmala is 1:1 of Al-Fatiha; in the other surahs (except At-Tawbah) it comes before verse 1 and isn't numbered. Scholars differ on whether the Basmala belongs to Al-Fatiha. That difference belongs in the explanation content, not in the data model.
- **Words:** each verse has numbered words. Pause marks and similar signs (U+06D6–U+06ED) that Tanzil writes as separate tokens are not words: they stay in the verse text, verbatim, and word positions skip them.
- **Spans:** a span runs from (surah, ayah, word) to (surah, ayah, word). A null word means the start or end of that verse, so one shape covers a phrase, a verse, and several verses. The span's id is its canonical text (`"1:2:1-1:2:3"`, `"66:1-66:5"`), so the same stretch is stored once.
- **Overlap:** the `span` table has generated columns `start_key` and `end_key` (`surah*1e6 + ayah*1e3 + word`, a missing word counting as 0 at the start and 999 at the end). "Explanations that touch what the reader selected" is then two comparisons, which PostgREST can filter on, and the same query serves ways 1 and 2.
- **Kinds:** a `phrase_note` stays inside one verse; a `verse_explanation` covers whole verses; a `reading_section` covers whole verses and is listed in its surah's reading order. The sections of a surah must cover it from first verse to last, with no gaps or overlaps (way 3).
- **Context links:** an explanation names the other spans a reader needs, with a reason in English and Korean (way 2).
- **Later additions:** Q&A answers, topics and the glossary will attach to spans and passages through new tables, without changing these ones (way 4).

## Alternatives

- **One explanation per verse:** simple, but it can't hold a note on two words, and an explanation of several verses would have to be repeated or split.
- **Free-text ranges ("2:60-61") on each explanation:** easy to write, but the database couldn't check that they point to real verses and words, or find overlaps.
- **A start and end column on each explanation, with no span table:** fewer joins, but context links, Q&A citations and topics would each repeat the same six columns and checks.
- **Counting pause marks as words:** keeps a one-to-one split of the text, but a learner would tap a sign that has no meaning to look up, and word positions would differ from other word-by-word resources.

## Consequences

- Foreign keys check that each span points to existing verses and words. The content test checks the rest: kinds, the reading order, and that a span doesn't end before it starts.
- Word positions depend on the Tanzil text version. Re-importing a changed text keeps roots only for words whose text didn't change. Spans pointing to words need checking by hand.
- The key formula assumes fewer than 1000 verses per surah and fewer than 999 words per verse, which holds for the Quran.
