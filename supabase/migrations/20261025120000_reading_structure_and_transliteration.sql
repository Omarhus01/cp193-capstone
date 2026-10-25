-- The verse page (#2) needs two changes to the content model (ADR 0013):
--
-- 1. Reading sections become public structure. The page shows every section of a surah, with
--    "explanation coming soon" for one whose explanation isn't published, so readers must see
--    where each section starts and ends. reading_section gets its own span; the explanation's
--    text stays published-only. The content validation keeps the two spans equal.
-- 2. Verse transliterations, per verse and language: Latin ('en') for English pages, Hangul ('ko')
--    for Korean pages. Each is written and reviewed on its own, so each has a short track:
--    en: draft -> en_approved -> published; ko: draft -> ko_approved -> published.

-- 1. Reading sections.

alter table public.reading_section add column span_id text references public.span (id);

update public.reading_section r
set span_id = e.span_id
from public.explanation e
where e.id = r.explanation_id;

alter table public.reading_section alter column span_id set not null;

drop policy "Anyone can read reading sections with a published explanation" on public.reading_section;

create policy "Anyone can read reading sections" on public.reading_section
  for select to anon, authenticated using (true);

-- 2. Transliterations.

create table public.verse_transliteration (
  surah smallint not null,
  ayah smallint not null,
  language text not null check (language in ('en', 'ko')),
  text text,
  status public.review_status not null default 'draft',
  primary key (surah, ayah, language),
  foreign key (surah, ayah) references public.verse (surah, ayah) on delete cascade,
  check (
    (language = 'en' and status in ('draft', 'en_approved', 'published'))
    or (language = 'ko' and status in ('draft', 'ko_approved', 'published'))
  )
);

comment on table public.verse_transliteration is
  'How a verse is pronounced, in Latin letters (en) or Hangul (ko). Owner content, reviewed per language.';

create table public.verse_transliteration_review (
  surah smallint not null,
  ayah smallint not null,
  language text not null,
  step smallint not null,
  status public.review_status not null,
  reviewer text not null,
  reviewed_on date not null,
  notes text,
  primary key (surah, ayah, language, step),
  foreign key (surah, ayah, language)
    references public.verse_transliteration (surah, ayah, language) on delete cascade
);

alter table public.verse_transliteration enable row level security;
alter table public.verse_transliteration_review enable row level security;

create policy "Anyone can read published transliterations" on public.verse_transliteration
  for select to anon, authenticated using (status = 'published');

revoke insert, update, delete, truncate on
  public.verse_transliteration, public.verse_transliteration_review
from anon, authenticated;

revoke select on public.verse_transliteration_review from anon, authenticated;

-- The seed also loads transliterations and the span of each reading section. Same contract as
-- before: a full sync in one transaction, callable only by the service role.
create or replace function public.seed_content(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  key text;
begin
  -- A missing key would read as "no rows" and delete that whole table, so refuse instead.
  foreach key in array array[
    'surahs', 'verses', 'words', 'sources', 'passages', 'spans', 'explanations',
    'explanation_citations', 'context_links', 'reading_sections', 'explanation_reviews',
    'surah_briefs', 'surah_brief_reviews', 'word_meanings', 'word_meaning_citations',
    'word_meaning_reviews', 'verse_transliterations', 'verse_transliteration_reviews'
  ] loop
    if jsonb_typeof(payload -> key) is distinct from 'array' then
      raise exception 'seed_content: payload.% must be an array', key;
    end if;
  end loop;

  -- 1. Child tables are rebuilt from the payload, so clear them first.
  delete from public.explanation_review where true;
  delete from public.word_meaning_review where true;
  delete from public.surah_brief_review where true;
  delete from public.verse_transliteration_review where true;
  delete from public.explanation_citation where true;
  delete from public.word_meaning_citation where true;
  delete from public.context_link where true;
  delete from public.reading_section where true;

  -- 2. Delete rows that are no longer in the content, dependents before what they point to.
  delete from public.explanation t where not exists (
    select 1 from jsonb_populate_recordset(null::public.explanation, payload -> 'explanations') p
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
  delete from public.span t where not exists (
    select 1 from jsonb_populate_recordset(null::public.span, payload -> 'spans') p
    where p.id = t.id);
  delete from public.passage t where not exists (
    select 1 from jsonb_populate_recordset(null::public.passage, payload -> 'passages') p
    where p.id = t.id);
  delete from public.source t where not exists (
    select 1 from jsonb_populate_recordset(null::public.source, payload -> 'sources') p
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
    (id, source_id, volume, page, verse_surah, verse_ayah, text_ar, summary_en, summary_ko)
  select id, source_id, volume, page, verse_surah, verse_ayah, text_ar, summary_en, summary_ko
  from jsonb_populate_recordset(null::public.passage, payload -> 'passages')
  on conflict (id) do update set
    source_id = excluded.source_id, volume = excluded.volume, page = excluded.page,
    verse_surah = excluded.verse_surah, verse_ayah = excluded.verse_ayah,
    text_ar = excluded.text_ar, summary_en = excluded.summary_en, summary_ko = excluded.summary_ko;

  -- A span's id is its canonical text ("1:2:1-1:2:3"), so an existing id never changes its range.
  insert into public.span (id, start_surah, start_ayah, start_word, end_surah, end_ayah, end_word)
  select id, start_surah, start_ayah, start_word, end_surah, end_ayah, end_word
  from jsonb_populate_recordset(null::public.span, payload -> 'spans')
  on conflict (id) do nothing;

  insert into public.explanation (
    id, span_id, kind, word_meanings_en, word_meanings_ko, background_en, background_ko,
    context_en, context_ko, connected_verses_en, connected_verses_ko, status)
  select
    id, span_id, kind, word_meanings_en, word_meanings_ko, background_en, background_ko,
    context_en, context_ko, connected_verses_en, connected_verses_ko, status
  from jsonb_populate_recordset(null::public.explanation, payload -> 'explanations')
  on conflict (id) do update set
    span_id = excluded.span_id, kind = excluded.kind,
    word_meanings_en = excluded.word_meanings_en, word_meanings_ko = excluded.word_meanings_ko,
    background_en = excluded.background_en, background_ko = excluded.background_ko,
    context_en = excluded.context_en, context_ko = excluded.context_ko,
    connected_verses_en = excluded.connected_verses_en,
    connected_verses_ko = excluded.connected_verses_ko,
    status = excluded.status;

  insert into public.word_meaning (surah, ayah, position, meaning_en, meaning_ko, status)
  select surah, ayah, position, meaning_en, meaning_ko, status
  from jsonb_populate_recordset(null::public.word_meaning, payload -> 'word_meanings')
  on conflict (surah, ayah, position) do update set
    meaning_en = excluded.meaning_en, meaning_ko = excluded.meaning_ko, status = excluded.status;

  insert into public.verse_transliteration (surah, ayah, language, text, status)
  select surah, ayah, language, text, status
  from jsonb_populate_recordset(null::public.verse_transliteration, payload -> 'verse_transliterations')
  on conflict (surah, ayah, language) do update set text = excluded.text, status = excluded.status;

  insert into public.surah_brief (surah, brief_en, brief_ko, status)
  select surah, brief_en, brief_ko, status
  from jsonb_populate_recordset(null::public.surah_brief, payload -> 'surah_briefs')
  on conflict (surah) do update set
    brief_en = excluded.brief_en, brief_ko = excluded.brief_ko, status = excluded.status;

  -- 4. Rebuild the child tables.
  insert into public.explanation_citation (explanation_id, passage_id, sort_order)
  select explanation_id, passage_id, sort_order
  from jsonb_populate_recordset(null::public.explanation_citation, payload -> 'explanation_citations');

  insert into public.context_link (explanation_id, sort_order, span_id, reason_en, reason_ko)
  select explanation_id, sort_order, span_id, reason_en, reason_ko
  from jsonb_populate_recordset(null::public.context_link, payload -> 'context_links');

  insert into public.reading_section (surah, position, explanation_id, span_id)
  select surah, position, explanation_id, span_id
  from jsonb_populate_recordset(null::public.reading_section, payload -> 'reading_sections');

  insert into public.word_meaning_citation (surah, ayah, position, passage_id, sort_order)
  select surah, ayah, position, passage_id, sort_order
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

  return jsonb_build_object(
    'surahs', (select count(*) from public.surah),
    'verses', (select count(*) from public.verse),
    'words', (select count(*) from public.word),
    'sources', (select count(*) from public.source),
    'passages', (select count(*) from public.passage),
    'spans', (select count(*) from public.span),
    'explanations', (select count(*) from public.explanation),
    'reading_sections', (select count(*) from public.reading_section),
    'word_meanings', (select count(*) from public.word_meaning),
    'surah_briefs', (select count(*) from public.surah_brief),
    'verse_transliterations', (select count(*) from public.verse_transliteration),
    'published_explanations', (select count(*) from public.explanation where status = 'published')
  );
end;
$$;

revoke execute on function public.seed_content(jsonb) from public, anon, authenticated;
grant execute on function public.seed_content(jsonb) to service_role;
