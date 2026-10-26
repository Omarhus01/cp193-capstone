-- Removes the tester preview (#35; it was added by 20261028120000_tester_preview.sql, ADR 0016,
-- since deleted). Al-Fatiha is published for user testing, so every reader sees the same content:
-- published items only, as the policies in 20261024120000_create_content.sql allow.
--
-- Code still on main calls is_tester(); it treats the error as "not a tester", so the site keeps
-- working between this migration and the deploy that removes the call.

-- The policies first: they call the functions below.
drop policy "Testers can read explanations in review" on public.explanation;
drop policy "Testers can read items of explanations in review" on public.explanation_item;
drop policy "Testers can read item citations of explanations in review" on public.explanation_item_citation;
drop policy "Testers can read citations of explanations in review" on public.explanation_citation;
drop policy "Testers can read context links of explanations in review" on public.context_link;
drop policy "Testers can read briefs in review" on public.surah_brief;
drop policy "Testers can read paragraphs of briefs in review" on public.surah_brief_item;
drop policy "Testers can read paragraph citations of briefs in review" on public.surah_brief_item_citation;
drop policy "Testers can read word meanings in review" on public.word_meaning;
drop policy "Testers can read citations of word meanings in review" on public.word_meaning_citation;
drop policy "Testers can read elsewhere notes of word meanings in review" on public.word_meaning_elsewhere;
drop policy "Testers can read every transliteration" on public.verse_transliteration;
drop policy "Testers can read passages cited by content in review" on public.passage;

drop function public.is_tester();
drop function public.is_preview_status(public.review_status);

drop table public.tester;
