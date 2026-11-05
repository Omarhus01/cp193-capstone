-- Fixed questions and answers (#5, ADR 0018): two per reading section, written and reviewed by
-- the owner like explanations, and seeded from content/surahs/NNN/qa.json. A question attaches to
-- a span of whole verses; the page lists it under the reading section where the span starts.
-- Readers see a question, its answer and its citations only once it is published.
--
-- seed_content is the version from 20261030120000_passage_url.sql, with the Q&A tables added.

create table public.qa_question (
  id text primary key,
  span_id text not null references public.span (id),
  sort_order smallint not null check (sort_order >= 0),
  question_en text,
  question_ko text,
  answer_en text,
  answer_ko text,
  status public.review_status not null default 'draft'
);

create index qa_question_span on public.qa_question (span_id);

-- `quoting` names who the cited passage quotes or narrates from, as for explanation items.
create table public.qa_question_citation (
  question_id text not null references public.qa_question (id) on delete cascade,
  sort_order smallint not null check (sort_order >= 0),
  passage_id text not null references public.passage (id) on delete cascade,
  quoting text,
  primary key (question_id, sort_order)
);

create index qa_question_citation_passage on public.qa_question_citation (passage_id);

-- Review history, private like the other *_review tables: no read policy.
create table public.qa_question_review (
  question_id text not null references public.qa_question (id) on delete cascade,
  step smallint not null,
  status public.review_status not null,
  reviewer text not null,
  reviewed_on date not null,
  notes text,
  primary key (question_id, step)
);

alter table public.qa_question enable row level security;
alter table public.qa_question_citation enable row level security;
alter table public.qa_question_review enable row level security;

create policy "Anyone can read published questions" on public.qa_question
  for select to anon, authenticated
  using (status = 'published');
create policy "Anyone can read citations of published questions" on public.qa_question_citation
  for select to anon, authenticated
  using (exists (
    select 1 from public.qa_question q
    where q.id = qa_question_citation.question_id and q.status = 'published'
  ));

-- A passage is public once a published explanation, word meaning, brief or question cites it.
drop policy "Anyone can read passages cited by published content" on public.passage;
create policy "Anyone can read passages cited by published content" on public.passage
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.explanation_citation c
      join public.explanation e on e.id = c.explanation_id
      where c.passage_id = passage.id and e.status = 'published'
    )
    or exists (
      select 1
      from public.word_meaning_citation c
      join public.word_meaning m
        on (m.surah, m.ayah, m.position) = (c.surah, c.ayah, c.position)
      where c.passage_id = passage.id and m.status = 'published'
    )
    or exists (
      select 1
      from public.surah_brief_item_citation c
      join public.surah_brief b on b.surah = c.surah
      where c.passage_id = passage.id and b.status = 'published'
    )
    or exists (
      select 1
      from public.qa_question_citation c
      join public.qa_question q on q.id = c.question_id
      where c.passage_id = passage.id and q.status = 'published'
    )
  );

revoke insert, update, delete, truncate on
  public.qa_question, public.qa_question_citation, public.qa_question_review
from anon, authenticated;

revoke select on public.qa_question_review from anon, authenticated;

create or replace function public.seed_content(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  key text;
  -- A seed from code without fixed Q&A (main before #5) sends no qa_* keys. Those are read as
  -- empty lists, so that seed keeps working and leaves no questions; every other key is required.
  qa_questions jsonb := coalesce(payload -> 'qa_questions', '[]'::jsonb);
  qa_question_citations jsonb := coalesce(payload -> 'qa_question_citations', '[]'::jsonb);
  qa_question_reviews jsonb := coalesce(payload -> 'qa_question_reviews', '[]'::jsonb);
begin
  -- A missing key would read as "no rows" and delete that whole table, so refuse instead.
  foreach key in array array[
    'surahs', 'verses', 'words', 'sources', 'passages', 'spans', 'explanations',
    'explanation_citations', 'context_links', 'reading_sections', 'explanation_reviews',
    'surah_briefs', 'surah_brief_reviews', 'word_meanings', 'word_meaning_citations',
    'word_meaning_reviews', 'verse_transliterations', 'verse_transliteration_reviews',
    'explanation_items', 'explanation_item_citations', 'surah_brief_items',
    'surah_brief_item_citations', 'word_meaning_elsewhere'
  ] loop
    if jsonb_typeof(payload -> key) is distinct from 'array' then
      raise exception 'seed_content: payload.% must be an array', key;
    end if;
  end loop;
  if jsonb_typeof(qa_questions) <> 'array' or jsonb_typeof(qa_question_citations) <> 'array'
    or jsonb_typeof(qa_question_reviews) <> 'array' then
    raise exception 'seed_content: payload.qa_* must be arrays';
  end if;

  -- 1. Child tables are rebuilt from the payload, so clear them first.
  delete from public.explanation_review where true;
  delete from public.word_meaning_review where true;
  delete from public.surah_brief_review where true;
  delete from public.verse_transliteration_review where true;
  delete from public.explanation_item_citation where true;
  delete from public.explanation_item where true;
  delete from public.surah_brief_item_citation where true;
  delete from public.surah_brief_item where true;
  delete from public.word_meaning_elsewhere where true;
  delete from public.explanation_citation where true;
  delete from public.word_meaning_citation where true;
  delete from public.context_link where true;
  delete from public.reading_section where true;
  delete from public.qa_question_review where true;
  delete from public.qa_question_citation where true;

  -- 2. Delete rows that are no longer in the content, dependents before what they point to.
  -- Spans and the text they point to are deleted last (step 5): an explanation that stays may
  -- still point to its old span until step 3 updates it.
  delete from public.explanation t where not exists (
    select 1 from jsonb_populate_recordset(null::public.explanation, payload -> 'explanations') p
    where p.id = t.id);
  delete from public.qa_question t where not exists (
    select 1 from jsonb_populate_recordset(null::public.qa_question, qa_questions) p
    where p.id = t.id);
  delete from public.word_meaning t where not exists (
    select 1 from jsonb_populate_recordset(null::public.word_meaning, payload -> 'word_meanings') p
    where (p.surah, p.ayah, p.position) = (t.surah, t.ayah, t.position));
  delete from public.verse_transliteration t where not exists (
    select 1
    from jsonb_populate_recordset(null::public.verse_transliteration, payload -> 'verse_transliterations') p
    where (p.surah, p.ayah, p.language) = (t.surah, t.ayah, t.language));
  delete from public.surah_brief t where not exists (
    select 1 from jsonb_populate_recordset(null::public.surah_brief, payload -> 'surah_briefs') p
    where p.surah = t.surah);
  delete from public.passage t where not exists (
    select 1 from jsonb_populate_recordset(null::public.passage, payload -> 'passages') p
    where p.id = t.id);
  delete from public.source t where not exists (
    select 1 from jsonb_populate_recordset(null::public.source, payload -> 'sources') p
    where p.id = t.id);

  -- 3. Upsert, parents before children.
  insert into public.surah (number, name_ar, name_en, name_ko, revelation_place, verse_count, basmala_ar)
  select number, name_ar, name_en, name_ko, revelation_place, verse_count, basmala_ar
  from jsonb_populate_recordset(null::public.surah, payload -> 'surahs')
  on conflict (number) do update set
    name_ar = excluded.name_ar, name_en = excluded.name_en, name_ko = excluded.name_ko,
    revelation_place = excluded.revelation_place, verse_count = excluded.verse_count,
    basmala_ar = excluded.basmala_ar;

  insert into public.verse (surah, ayah, text_ar)
  select surah, ayah, text_ar
  from jsonb_populate_recordset(null::public.verse, payload -> 'verses')
  on conflict (surah, ayah) do update set text_ar = excluded.text_ar;

  insert into public.word (surah, ayah, position, text_ar, root)
  select surah, ayah, position, text_ar, root
  from jsonb_populate_recordset(null::public.word, payload -> 'words')
  on conflict (surah, ayah, position) do update set
    text_ar = excluded.text_ar, root = excluded.root;

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

  -- A span's id is its canonical text ("1:2:1-1:2:3"), so an existing id never changes its range.
  insert into public.span (id, start_surah, start_ayah, start_word, end_surah, end_ayah, end_word)
  select id, start_surah, start_ayah, start_word, end_surah, end_ayah, end_word
  from jsonb_populate_recordset(null::public.span, payload -> 'spans')
  on conflict (id) do nothing;

  insert into public.explanation (id, span_id, kind, status)
  select id, span_id, kind, status
  from jsonb_populate_recordset(null::public.explanation, payload -> 'explanations')
  on conflict (id) do update set
    span_id = excluded.span_id, kind = excluded.kind, status = excluded.status;

  insert into public.qa_question
    (id, span_id, sort_order, question_en, question_ko, answer_en, answer_ko, status)
  select id, span_id, sort_order, question_en, question_ko, answer_en, answer_ko, status
  from jsonb_populate_recordset(null::public.qa_question, qa_questions)
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

  -- 4. Rebuild the child tables.
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
  from jsonb_populate_recordset(null::public.qa_question_citation, qa_question_citations);

  insert into public.qa_question_review (question_id, step, status, reviewer, reviewed_on, notes)
  select question_id, step, status, reviewer, reviewed_on, notes
  from jsonb_populate_recordset(null::public.qa_question_review, qa_question_reviews);

  -- 5. Delete spans and text no longer in the content, now that nothing points to them.
  delete from public.span t where not exists (
    select 1 from jsonb_populate_recordset(null::public.span, payload -> 'spans') p
    where p.id = t.id);
  delete from public.word t where not exists (
    select 1 from jsonb_populate_recordset(null::public.word, payload -> 'words') p
    where (p.surah, p.ayah, p.position) = (t.surah, t.ayah, t.position));
  delete from public.verse t where not exists (
    select 1 from jsonb_populate_recordset(null::public.verse, payload -> 'verses') p
    where (p.surah, p.ayah) = (t.surah, t.ayah));
  delete from public.surah t where not exists (
    select 1 from jsonb_populate_recordset(null::public.surah, payload -> 'surahs') p
    where p.number = t.number);

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

revoke execute on function public.seed_content(jsonb) from public, anon, authenticated;
grant execute on function public.seed_content(jsonb) to service_role;
