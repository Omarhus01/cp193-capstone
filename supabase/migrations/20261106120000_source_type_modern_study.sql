-- A kind of source for modern studies (#53, decision record 0023): modern writing about the
-- Quran that is not a tafsir, a hadith collection or a dictionary, such as a translation, a book
-- or a journal article. An-Nisāʾ 4:34 cites three.
--
-- Adding a value keeps the code on main working: it never sends the new value, and seed_content
-- reads the type through jsonb_populate_recordset, so it needs no change.

alter type public.source_type add value if not exists 'modern_study';
