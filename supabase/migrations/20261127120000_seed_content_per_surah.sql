-- Seeds content/ one surah per request (#69, ADR 0027). With the whole Quran imported, the single
-- seed_content call sends about 6.5 MB and runs past the hosted database's statement timeout. The
-- seed script now calls four functions, each a short transaction of its own:
--
--   1. seed_surah_text      once per surah: the surah, its verses and its words (Tanzil text)
--   2. seed_shared_content  once: sources and passages (after the text, since a passage may point
--                           to a verse)
--   3. seed_surah_content   once per surah: everything that belongs to that surah, replaced whole
--   4. seed_content_finish  once: removes what no content uses any more, returns the row counts
--
-- An explanation or a fixed question belongs to the surah its span starts in (the content
-- validation keeps it in that surah's folder). Every other surah row carries its surah.
--
-- seed_content (20261126120000_verse_mushaf_page.sql) stays, so the seed script on main keeps
-- working until this change is merged. A later migration drops it (#70).

create function public.seed_surah_text(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  key text;
  n smallint;
begin
  if jsonb_typeof(payload -> 'surah') is distinct from 'object' then
    raise exception 'seed_surah_text: payload.surah must be an object';
  end if;
  foreach key in array array['verses', 'words'] loop
    if jsonb_typeof(payload -> key) is distinct from 'array' then
      raise exception 'seed_surah_text: payload.% must be an array', key;
    end if;
  end loop;
  n := (payload -> 'surah' ->> 'number')::smallint;
  if n is null then
    raise exception 'seed_surah_text: payload.surah.number is missing';
  end if;
  if exists (
    select 1 from jsonb_populate_recordset(null::public.verse, payload -> 'verses') p
    where p.surah is distinct from n
  ) or exists (
    select 1 from jsonb_populate_recordset(null::public.word, payload -> 'words') p
    where p.surah is distinct from n
  ) then
    raise exception 'seed_surah_text: every verse and word must be in surah %', n;
  end if;

  insert into public.surah (number, name_ar, name_en, name_ko, revelation_place, verse_count, basmala_ar)
  select number, name_ar, name_en, name_ko, revelation_place, verse_count, basmala_ar
  from jsonb_populate_record(null::public.surah, payload -> 'surah')
  on conflict (number) do update set
    name_ar = excluded.name_ar, name_en = excluded.name_en, name_ko = excluded.name_ko,
    revelation_place = excluded.revelation_place, verse_count = excluded.verse_count,
    basmala_ar = excluded.basmala_ar;

  -- Unchanged verses and words aren't rewritten, so a seed with nothing new writes almost nothing.
  insert into public.verse (surah, ayah, text_ar, page)
  select surah, ayah, text_ar, page
  from jsonb_populate_recordset(null::public.verse, payload -> 'verses')
  on conflict (surah, ayah) do update set text_ar = excluded.text_ar, page = excluded.page
  where (public.verse.text_ar, public.verse.page)
    is distinct from (excluded.text_ar, excluded.page);

  insert into public.word (surah, ayah, position, text_ar, root)
  select surah, ayah, position, text_ar, root
  from jsonb_populate_recordset(null::public.word, payload -> 'words')
  on conflict (surah, ayah, position) do update set
    text_ar = excluded.text_ar, root = excluded.root
  where (public.word.text_ar, public.word.root)
    is distinct from (excluded.text_ar, excluded.root);

  -- Verses and words that left the content are deleted by seed_surah_content, after the spans
  -- that might still point to them.
  return jsonb_build_object(
    'surah', n,
    'verses', jsonb_array_length(payload -> 'verses'),
    'words', jsonb_array_length(payload -> 'words')
  );
end;
$$;

create function public.seed_shared_content(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  key text;
begin
  foreach key in array array['sources', 'passages'] loop
    if jsonb_typeof(payload -> key) is distinct from 'array' then
      raise exception 'seed_shared_content: payload.% must be an array', key;
    end if;
  end loop;

  insert into public.source (id, title_ar, title_en, author, edition, type)
  select id, title_ar, title_en, author, edition, type
  from jsonb_populate_recordset(null::public.source, payload -> 'sources')
  on conflict (id) do update set
    title_ar = excluded.title_ar, title_en = excluded.title_en, author = excluded.author,
    edition = excluded.edition, type = excluded.type;

  insert into public.passage
    (id, source_id, volume, page, verse_surah, verse_ayah, text_ar, summary_en, summary_ko, url)
  select id, source_id, volume, page, verse_surah, verse_ayah, text_ar, summary_en, summary_ko, url
  from jsonb_populate_recordset(null::public.passage, payload -> 'passages')
  on conflict (id) do update set
    source_id = excluded.source_id, volume = excluded.volume, page = excluded.page,
    verse_surah = excluded.verse_surah, verse_ayah = excluded.verse_ayah,
    text_ar = excluded.text_ar, summary_en = excluded.summary_en, summary_ko = excluded.summary_ko,
    url = excluded.url;

  -- Sources and passages that left the content are deleted by seed_content_finish, once no
  -- surah's content cites them: a surah not seeded in this run keeps its citations.
  return jsonb_build_object(
    'sources', jsonb_array_length(payload -> 'sources'),
    'passages', jsonb_array_length(payload -> 'passages')
  );
end;
$$;

-- Deletes the spans nothing points to. A span exists only for the rows that use it, so these are
-- the verse ranges that left the content.
create function public.seed_delete_unused_spans()
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.span s
  where not exists (select 1 from public.explanation e where e.span_id = s.id)
    and not exists (select 1 from public.context_link c where c.span_id = s.id)
    and not exists (select 1 from public.reading_section r where r.span_id = s.id)
    and not exists (select 1 from public.qa_question q where q.span_id = s.id);
$$;

create function public.seed_surah_content(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  key text;
  n smallint;
  explanation_ids text[];
  question_ids text[];
  -- This surah's explanations and questions: those in the database now and those in the payload.
  owned_explanations text[];
  owned_questions text[];
begin
  if jsonb_typeof(payload -> 'surah') is distinct from 'number' then
    raise exception 'seed_surah_content: payload.surah must be a surah number';
  end if;
  -- A missing key would read as "no rows" and delete that part of the surah, so refuse instead.
  foreach key in array array[
    'spans', 'explanations', 'explanation_items', 'explanation_item_citations',
    'explanation_citations', 'context_links', 'reading_sections', 'explanation_reviews',
    'surah_briefs', 'surah_brief_items', 'surah_brief_item_citations', 'surah_brief_reviews',
    'word_meanings', 'word_meaning_citations', 'word_meaning_elsewhere', 'word_meaning_reviews',
    'verse_transliterations', 'verse_transliteration_reviews', 'qa_questions',
    'qa_question_citations', 'qa_question_reviews', 'verses', 'words'
  ] loop
    if jsonb_typeof(payload -> key) is distinct from 'array' then
      raise exception 'seed_surah_content: payload.% must be an array', key;
    end if;
  end loop;
  n := (payload ->> 'surah')::smallint;

  explanation_ids := array(
    select p.id from jsonb_populate_recordset(null::public.explanation, payload -> 'explanations') p);
  question_ids := array(
    select p.id from jsonb_populate_recordset(null::public.qa_question, payload -> 'qa_questions') p);

  -- Everything below touches only surah n, so refuse rows of another surah.
  if exists (select 1 from jsonb_populate_recordset(null::public.reading_section, payload -> 'reading_sections') p where p.surah is distinct from n)
    or exists (select 1 from jsonb_populate_recordset(null::public.surah_brief, payload -> 'surah_briefs') p where p.surah is distinct from n)
    or exists (select 1 from jsonb_populate_recordset(null::public.surah_brief_item, payload -> 'surah_brief_items') p where p.surah is distinct from n)
    or exists (select 1 from jsonb_populate_recordset(null::public.surah_brief_item_citation, payload -> 'surah_brief_item_citations') p where p.surah is distinct from n)
    or exists (select 1 from jsonb_populate_recordset(null::public.surah_brief_review, payload -> 'surah_brief_reviews') p where p.surah is distinct from n)
    or exists (select 1 from jsonb_populate_recordset(null::public.word_meaning, payload -> 'word_meanings') p where p.surah is distinct from n)
    or exists (select 1 from jsonb_populate_recordset(null::public.word_meaning_citation, payload -> 'word_meaning_citations') p where p.surah is distinct from n)
    or exists (select 1 from jsonb_populate_recordset(null::public.word_meaning_elsewhere, payload -> 'word_meaning_elsewhere') p where p.surah is distinct from n)
    or exists (select 1 from jsonb_populate_recordset(null::public.word_meaning_review, payload -> 'word_meaning_reviews') p where p.surah is distinct from n)
    or exists (select 1 from jsonb_populate_recordset(null::public.verse_transliteration, payload -> 'verse_transliterations') p where p.surah is distinct from n)
    or exists (select 1 from jsonb_populate_recordset(null::public.verse_transliteration_review, payload -> 'verse_transliteration_reviews') p where p.surah is distinct from n)
    or exists (select 1 from jsonb_populate_recordset(null::public.explanation_item, payload -> 'explanation_items') p where p.explanation_id <> all(explanation_ids))
    or exists (select 1 from jsonb_populate_recordset(null::public.explanation_item_citation, payload -> 'explanation_item_citations') p where p.explanation_id <> all(explanation_ids))
    or exists (select 1 from jsonb_populate_recordset(null::public.explanation_citation, payload -> 'explanation_citations') p where p.explanation_id <> all(explanation_ids))
    or exists (select 1 from jsonb_populate_recordset(null::public.context_link, payload -> 'context_links') p where p.explanation_id <> all(explanation_ids))
    or exists (select 1 from jsonb_populate_recordset(null::public.explanation_review, payload -> 'explanation_reviews') p where p.explanation_id <> all(explanation_ids))
    or exists (select 1 from jsonb_populate_recordset(null::public.reading_section, payload -> 'reading_sections') p where p.explanation_id <> all(explanation_ids))
    or exists (select 1 from jsonb_populate_recordset(null::public.qa_question_citation, payload -> 'qa_question_citations') p where p.question_id <> all(question_ids))
    or exists (select 1 from jsonb_populate_recordset(null::public.qa_question_review, payload -> 'qa_question_reviews') p where p.question_id <> all(question_ids))
  then
    raise exception 'seed_surah_content: every row must belong to surah % and its own explanations and questions', n;
  end if;

  owned_explanations := explanation_ids || array(
    select e.id from public.explanation e join public.span s on s.id = e.span_id
    where s.start_surah = n);
  owned_questions := question_ids || array(
    select q.id from public.qa_question q join public.span s on s.id = q.span_id
    where s.start_surah = n);

  -- 1. The surah's child rows are rebuilt from the payload, so clear them first.
  delete from public.explanation_review where explanation_id = any(owned_explanations);
  delete from public.explanation_item_citation where explanation_id = any(owned_explanations);
  delete from public.explanation_item where explanation_id = any(owned_explanations);
  delete from public.explanation_citation where explanation_id = any(owned_explanations);
  delete from public.context_link where explanation_id = any(owned_explanations);
  delete from public.reading_section where surah = n or explanation_id = any(owned_explanations);
  delete from public.word_meaning_review where surah = n;
  delete from public.word_meaning_citation where surah = n;
  delete from public.word_meaning_elsewhere where surah = n;
  delete from public.surah_brief_review where surah = n;
  delete from public.surah_brief_item_citation where surah = n;
  delete from public.surah_brief_item where surah = n;
  delete from public.verse_transliteration_review where surah = n;
  delete from public.qa_question_review where question_id = any(owned_questions);
  delete from public.qa_question_citation where question_id = any(owned_questions);

  -- 2. Delete the surah's rows that are no longer in the content.
  delete from public.explanation
  where id = any(owned_explanations) and id <> all(explanation_ids);
  delete from public.qa_question
  where id = any(owned_questions) and id <> all(question_ids);
  delete from public.word_meaning t where t.surah = n and not exists (
    select 1 from jsonb_populate_recordset(null::public.word_meaning, payload -> 'word_meanings') p
    where (p.ayah, p.position) = (t.ayah, t.position));
  delete from public.verse_transliteration t where t.surah = n and not exists (
    select 1
    from jsonb_populate_recordset(null::public.verse_transliteration, payload -> 'verse_transliterations') p
    where (p.ayah, p.language) = (t.ayah, t.language));
  delete from public.surah_brief t where t.surah = n and jsonb_array_length(payload -> 'surah_briefs') = 0;

  -- 3. Upsert, parents before children. A span's id is its canonical text ("1:2:1-1:2:3"), so an
  -- existing id never changes its range. A span may lie in another surah (a context link).
  insert into public.span (id, start_surah, start_ayah, start_word, end_surah, end_ayah, end_word)
  select id, start_surah, start_ayah, start_word, end_surah, end_ayah, end_word
  from jsonb_populate_recordset(null::public.span, payload -> 'spans')
  on conflict (id) do nothing;

  if exists (
    select 1 from jsonb_populate_recordset(null::public.explanation, payload -> 'explanations') p
    join public.span s on s.id = p.span_id where s.start_surah <> n
  ) or exists (
    select 1 from jsonb_populate_recordset(null::public.qa_question, payload -> 'qa_questions') p
    join public.span s on s.id = p.span_id where s.start_surah <> n
  ) then
    raise exception 'seed_surah_content: every explanation and question must start in surah %', n;
  end if;

  insert into public.explanation (id, span_id, kind, status)
  select id, span_id, kind, status
  from jsonb_populate_recordset(null::public.explanation, payload -> 'explanations')
  on conflict (id) do update set
    span_id = excluded.span_id, kind = excluded.kind, status = excluded.status;

  insert into public.qa_question
    (id, span_id, sort_order, question_en, question_ko, answer_en, answer_ko, status)
  select id, span_id, sort_order, question_en, question_ko, answer_en, answer_ko, status
  from jsonb_populate_recordset(null::public.qa_question, payload -> 'qa_questions')
  on conflict (id) do update set
    span_id = excluded.span_id, sort_order = excluded.sort_order,
    question_en = excluded.question_en, question_ko = excluded.question_ko,
    answer_en = excluded.answer_en, answer_ko = excluded.answer_ko, status = excluded.status;

  insert into public.word_meaning (surah, ayah, position, meaning_en, meaning_ko, status)
  select surah, ayah, position, meaning_en, meaning_ko, status
  from jsonb_populate_recordset(null::public.word_meaning, payload -> 'word_meanings')
  on conflict (surah, ayah, position) do update set
    meaning_en = excluded.meaning_en, meaning_ko = excluded.meaning_ko, status = excluded.status;

  insert into public.verse_transliteration (surah, ayah, language, text, status)
  select surah, ayah, language, text, status
  from jsonb_populate_recordset(null::public.verse_transliteration, payload -> 'verse_transliterations')
  on conflict (surah, ayah, language) do update set text = excluded.text, status = excluded.status;

  insert into public.surah_brief (surah, status)
  select surah, status
  from jsonb_populate_recordset(null::public.surah_brief, payload -> 'surah_briefs')
  on conflict (surah) do update set status = excluded.status;

  -- 4. Rebuild the child rows.
  insert into public.explanation_item
    (explanation_id, part, sort_order, text_en, text_ko, verse_surah, verse_ayah)
  select explanation_id, part, sort_order, text_en, text_ko, verse_surah, verse_ayah
  from jsonb_populate_recordset(null::public.explanation_item, payload -> 'explanation_items');

  insert into public.explanation_item_citation
    (explanation_id, part, item_order, sort_order, passage_id, quoting)
  select explanation_id, part, item_order, sort_order, passage_id, quoting
  from jsonb_populate_recordset(
    null::public.explanation_item_citation, payload -> 'explanation_item_citations');

  insert into public.surah_brief_item (surah, sort_order, text_en, text_ko)
  select surah, sort_order, text_en, text_ko
  from jsonb_populate_recordset(null::public.surah_brief_item, payload -> 'surah_brief_items');

  insert into public.surah_brief_item_citation (surah, item_order, sort_order, passage_id, quoting)
  select surah, item_order, sort_order, passage_id, quoting
  from jsonb_populate_recordset(
    null::public.surah_brief_item_citation, payload -> 'surah_brief_item_citations');

  insert into public.word_meaning_elsewhere
    (surah, ayah, position, sort_order, verse_surah, verse_ayah, text_en, text_ko)
  select surah, ayah, position, sort_order, verse_surah, verse_ayah, text_en, text_ko
  from jsonb_populate_recordset(null::public.word_meaning_elsewhere, payload -> 'word_meaning_elsewhere');

  insert into public.explanation_citation (explanation_id, passage_id, sort_order)
  select explanation_id, passage_id, sort_order
  from jsonb_populate_recordset(null::public.explanation_citation, payload -> 'explanation_citations');

  insert into public.context_link (explanation_id, sort_order, span_id, reason_en, reason_ko)
  select explanation_id, sort_order, span_id, reason_en, reason_ko
  from jsonb_populate_recordset(null::public.context_link, payload -> 'context_links');

  insert into public.reading_section (surah, position, explanation_id, span_id)
  select surah, position, explanation_id, span_id
  from jsonb_populate_recordset(null::public.reading_section, payload -> 'reading_sections');

  insert into public.word_meaning_citation (surah, ayah, position, passage_id, sort_order, quoting)
  select surah, ayah, position, passage_id, sort_order, quoting
  from jsonb_populate_recordset(null::public.word_meaning_citation, payload -> 'word_meaning_citations');

  insert into public.explanation_review (explanation_id, step, status, reviewer, reviewed_on, notes)
  select explanation_id, step, status, reviewer, reviewed_on, notes
  from jsonb_populate_recordset(null::public.explanation_review, payload -> 'explanation_reviews');

  insert into public.word_meaning_review
    (surah, ayah, position, step, status, reviewer, reviewed_on, notes)
  select surah, ayah, position, step, status, reviewer, reviewed_on, notes
  from jsonb_populate_recordset(null::public.word_meaning_review, payload -> 'word_meaning_reviews');

  insert into public.surah_brief_review (surah, step, status, reviewer, reviewed_on, notes)
  select surah, step, status, reviewer, reviewed_on, notes
  from jsonb_populate_recordset(null::public.surah_brief_review, payload -> 'surah_brief_reviews');

  insert into public.verse_transliteration_review
    (surah, ayah, language, step, status, reviewer, reviewed_on, notes)
  select surah, ayah, language, step, status, reviewer, reviewed_on, notes
  from jsonb_populate_recordset(
    null::public.verse_transliteration_review, payload -> 'verse_transliteration_reviews');

  insert into public.qa_question_citation (question_id, sort_order, passage_id, quoting)
  select question_id, sort_order, passage_id, quoting
  from jsonb_populate_recordset(null::public.qa_question_citation, payload -> 'qa_question_citations');

  insert into public.qa_question_review (question_id, step, status, reviewer, reviewed_on, notes)
  select question_id, step, status, reviewer, reviewed_on, notes
  from jsonb_populate_recordset(null::public.qa_question_review, payload -> 'qa_question_reviews');

  -- 5. Delete the verse ranges nothing uses any more, then the surah's verses and words that left
  -- the content, now that no span points to them.
  perform public.seed_delete_unused_spans();
  delete from public.word t where t.surah = n and not exists (
    select 1 from jsonb_populate_recordset(null::public.word, payload -> 'words') p
    where (p.ayah, p.position) = (t.ayah, t.position));
  delete from public.verse t where t.surah = n and not exists (
    select 1 from jsonb_populate_recordset(null::public.verse, payload -> 'verses') p
    where p.ayah = t.ayah);

  return jsonb_build_object(
    'surah', n,
    'explanations', cardinality(explanation_ids),
    'word_meanings', jsonb_array_length(payload -> 'word_meanings'),
    'qa_questions', cardinality(question_ids)
  );
end;
$$;

create function public.seed_content_finish(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  key text;
  source_ids text[];
  passage_ids text[];
  -- Every surah in the content on a full seed; null on a seed of some surahs only, which keeps
  -- the surahs it didn't load.
  surah_numbers smallint[];
begin
  foreach key in array array['sources', 'passages'] loop
    if jsonb_typeof(payload -> key) is distinct from 'array' then
      raise exception 'seed_content_finish: payload.% must be an array', key;
    end if;
  end loop;
  if jsonb_typeof(payload -> 'surahs') not in ('array', 'null') or not payload ? 'surahs' then
    raise exception 'seed_content_finish: payload.surahs must be an array, or null on a partial seed';
  end if;
  source_ids := array(select jsonb_array_elements_text(payload -> 'sources'));
  passage_ids := array(select jsonb_array_elements_text(payload -> 'passages'));
  if jsonb_typeof(payload -> 'surahs') = 'array' then
    surah_numbers := array(select jsonb_array_elements_text(payload -> 'surahs')::smallint);
  end if;

  -- 1. On a full seed, the explanations and questions of surahs that left the content.
  if surah_numbers is not null then
    delete from public.explanation e using public.span s
    where s.id = e.span_id and s.start_surah <> all(surah_numbers);
    delete from public.qa_question q using public.span s
    where s.id = q.span_id and s.start_surah <> all(surah_numbers);
  end if;

  -- 2. Verse ranges, passages and sources that nothing uses any more and that left the content.
  perform public.seed_delete_unused_spans();
  delete from public.passage p
  where p.id <> all(passage_ids)
    and not exists (select 1 from public.explanation_citation c where c.passage_id = p.id)
    and not exists (select 1 from public.explanation_item_citation c where c.passage_id = p.id)
    and not exists (select 1 from public.word_meaning_citation c where c.passage_id = p.id)
    and not exists (select 1 from public.surah_brief_item_citation c where c.passage_id = p.id)
    and not exists (select 1 from public.qa_question_citation c where c.passage_id = p.id);
  delete from public.source s
  where s.id <> all(source_ids)
    and not exists (select 1 from public.passage p where p.source_id = s.id);

  -- 3. On a full seed, the surahs that left the content, with their verses, words, meanings,
  -- transliterations, briefs and reading sections (on delete cascade).
  if surah_numbers is not null then
    delete from public.surah where number <> all(surah_numbers);
  end if;

  return jsonb_build_object(
    'surahs', (select count(*) from public.surah),
    'verses', (select count(*) from public.verse),
    'words', (select count(*) from public.word),
    'sources', (select count(*) from public.source),
    'passages', (select count(*) from public.passage),
    'spans', (select count(*) from public.span),
    'explanations', (select count(*) from public.explanation),
    'explanation_items', (select count(*) from public.explanation_item),
    'reading_sections', (select count(*) from public.reading_section),
    'word_meanings', (select count(*) from public.word_meaning),
    'surah_briefs', (select count(*) from public.surah_brief),
    'verse_transliterations', (select count(*) from public.verse_transliteration),
    'published_explanations', (select count(*) from public.explanation where status = 'published'),
    'qa_questions', (select count(*) from public.qa_question),
    'published_qa_questions', (select count(*) from public.qa_question where status = 'published')
  );
end;
$$;

revoke execute on function public.seed_surah_text(jsonb) from public, anon, authenticated;
revoke execute on function public.seed_shared_content(jsonb) from public, anon, authenticated;
revoke execute on function public.seed_delete_unused_spans() from public, anon, authenticated;
revoke execute on function public.seed_surah_content(jsonb) from public, anon, authenticated;
revoke execute on function public.seed_content_finish(jsonb) from public, anon, authenticated;
grant execute on function public.seed_surah_text(jsonb) to service_role;
grant execute on function public.seed_shared_content(jsonb) to service_role;
grant execute on function public.seed_delete_unused_spans() to service_role;
grant execute on function public.seed_surah_content(jsonb) to service_role;
grant execute on function public.seed_content_finish(jsonb) to service_role;
