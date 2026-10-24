-- Quran text, explanations and the sources behind them.
-- Content is authored as JSON in content/ and loaded by public.seed_content (content/README.md,
-- ADR 0011). Readers (anon and authenticated) can read only published items and can't write.
-- Explanations attach to spans of the text, not to verses (ADR 0012).

create type public.review_status as enum ('draft', 'en_approved', 'ko_drafted', 'ko_approved', 'published');
create type public.revelation_place as enum ('meccan', 'medinan');
create type public.explanation_kind as enum ('phrase_note', 'verse_explanation', 'reading_section');
create type public.source_type as enum ('tafsir', 'asbab_al_nuzul', 'word_dictionary', 'hadith');

-- Quran text, from Tanzil. Verse numbering follows the Hafs mushaf: the Basmala is 1:1 of Al-Fatiha.

create table public.surah (
  number smallint primary key check (number between 1 and 114),
  name_ar text not null,
  name_en text,
  name_ko text,
  revelation_place public.revelation_place not null,
  verse_count smallint not null check (verse_count > 0),
  basmala_ar text
);

comment on column public.surah.basmala_ar is
  'The Basmala shown before verse 1, as Tanzil gives it. Null for Al-Fatiha (where it is verse 1) and At-Tawbah.';

create table public.verse (
  surah smallint not null references public.surah (number) on delete cascade,
  ayah smallint not null check (ayah > 0),
  text_ar text not null,
  primary key (surah, ayah)
);

comment on column public.verse.text_ar is 'Tanzil Uthmani text, verbatim, pause marks included.';

create table public.word (
  surah smallint not null,
  ayah smallint not null,
  position smallint not null check (position > 0),
  text_ar text not null,
  root text,
  primary key (surah, ayah, position),
  foreign key (surah, ayah) references public.verse (surah, ayah) on delete cascade
);

comment on table public.word is 'The words of each verse. Pause marks are not words.';

-- A stretch of the text from (surah, ayah, word) to (surah, ayah, word). A null word means the
-- start (or end) of the verse, so a span can be a phrase, a verse, or several verses.
-- start_key and end_key turn "overlaps this span" into two comparisons PostgREST can filter on.
create table public.span (
  id text primary key,
  start_surah smallint not null,
  start_ayah smallint not null,
  start_word smallint,
  end_surah smallint not null,
  end_ayah smallint not null,
  end_word smallint,
  start_key integer generated always as
    (start_surah * 1000000 + start_ayah * 1000 + coalesce(start_word, 0)) stored,
  end_key integer generated always as
    (end_surah * 1000000 + end_ayah * 1000 + coalesce(end_word, 999)) stored,
  -- A composite foreign key with a null column isn't checked, so whole-verse refs skip the word check.
  foreign key (start_surah, start_ayah) references public.verse (surah, ayah),
  foreign key (start_surah, start_ayah, start_word) references public.word (surah, ayah, position),
  foreign key (end_surah, end_ayah) references public.verse (surah, ayah),
  foreign key (end_surah, end_ayah, end_word) references public.word (surah, ayah, position),
  unique nulls not distinct (start_surah, start_ayah, start_word, end_surah, end_ayah, end_word),
  check (start_key <= end_key)
);

create index span_keys on public.span (start_key, end_key);

-- Sources and the passages that explanations cite.

create table public.source (
  id text primary key,
  title_ar text,
  title_en text,
  author text not null,
  edition text,
  type public.source_type not null,
  check (title_ar is not null or title_en is not null)
);

-- A passage is located by volume and page, or, for sources arranged by verse, by a verse reference.
create table public.passage (
  id text primary key,
  source_id text not null references public.source (id) on delete cascade,
  volume text,
  page text,
  verse_surah smallint,
  verse_ayah smallint,
  text_ar text,
  summary_en text,
  summary_ko text,
  foreign key (verse_surah, verse_ayah) references public.verse (surah, ayah),
  check ((verse_surah is null) = (verse_ayah is null)),
  check (page is not null or verse_ayah is not null)
);

create index passage_source on public.passage (source_id);

-- Explanations. Each has four parts in English and Korean; a part a kind doesn't need stays null.

create table public.explanation (
  id text primary key,
  span_id text not null references public.span (id),
  kind public.explanation_kind not null,
  word_meanings_en text,
  word_meanings_ko text,
  background_en text,
  background_ko text,
  context_en text,
  context_ko text,
  connected_verses_en text,
  connected_verses_ko text,
  status public.review_status not null default 'draft'
);

create index explanation_span on public.explanation (span_id);

create table public.explanation_citation (
  explanation_id text not null references public.explanation (id) on delete cascade,
  passage_id text not null references public.passage (id) on delete cascade,
  sort_order smallint not null,
  primary key (explanation_id, passage_id),
  unique (explanation_id, sort_order)
);

create index explanation_citation_passage on public.explanation_citation (passage_id);

-- Other parts of the text a reader needs in order to understand an explanation, and why.
create table public.context_link (
  explanation_id text not null references public.explanation (id) on delete cascade,
  sort_order smallint not null,
  span_id text not null references public.span (id),
  reason_en text,
  reason_ko text,
  primary key (explanation_id, sort_order)
);

-- The sections of a surah, read in order. Together they cover the surah from start to end
-- (checked by the content validation before seeding).
create table public.reading_section (
  surah smallint not null references public.surah (number) on delete cascade,
  position smallint not null check (position > 0),
  explanation_id text not null unique references public.explanation (id) on delete cascade,
  primary key (surah, position)
);

create table public.surah_brief (
  surah smallint primary key references public.surah (number) on delete cascade,
  brief_en text,
  brief_ko text,
  status public.review_status not null default 'draft'
);

-- What a word means in its verse.
create table public.word_meaning (
  surah smallint not null,
  ayah smallint not null,
  position smallint not null,
  meaning_en text,
  meaning_ko text,
  status public.review_status not null default 'draft',
  primary key (surah, ayah, position),
  foreign key (surah, ayah, position) references public.word (surah, ayah, position) on delete cascade
);

create table public.word_meaning_citation (
  surah smallint not null,
  ayah smallint not null,
  position smallint not null,
  passage_id text not null references public.passage (id) on delete cascade,
  sort_order smallint not null,
  primary key (surah, ayah, position, passage_id),
  foreign key (surah, ayah, position)
    references public.word_meaning (surah, ayah, position) on delete cascade
);

create index word_meaning_citation_passage on public.word_meaning_citation (passage_id);

-- Review history: each step an item went through, by whom and when. Private: no read policies.

create table public.explanation_review (
  explanation_id text not null references public.explanation (id) on delete cascade,
  step smallint not null,
  status public.review_status not null,
  reviewer text not null,
  reviewed_on date not null,
  notes text,
  primary key (explanation_id, step)
);

create table public.word_meaning_review (
  surah smallint not null,
  ayah smallint not null,
  position smallint not null,
  step smallint not null,
  status public.review_status not null,
  reviewer text not null,
  reviewed_on date not null,
  notes text,
  primary key (surah, ayah, position, step),
  foreign key (surah, ayah, position)
    references public.word_meaning (surah, ayah, position) on delete cascade
);

create table public.surah_brief_review (
  surah smallint not null references public.surah_brief (surah) on delete cascade,
  step smallint not null,
  status public.review_status not null,
  reviewer text not null,
  reviewed_on date not null,
  notes text,
  primary key (surah, step)
);

-- Row level security. Readers get the text, the spans and the source list, and only the
-- published parts of everything else. No policy allows a write.

alter table public.surah enable row level security;
alter table public.verse enable row level security;
alter table public.word enable row level security;
alter table public.span enable row level security;
alter table public.source enable row level security;
alter table public.passage enable row level security;
alter table public.explanation enable row level security;
alter table public.explanation_citation enable row level security;
alter table public.context_link enable row level security;
alter table public.reading_section enable row level security;
alter table public.surah_brief enable row level security;
alter table public.word_meaning enable row level security;
alter table public.word_meaning_citation enable row level security;
alter table public.explanation_review enable row level security;
alter table public.word_meaning_review enable row level security;
alter table public.surah_brief_review enable row level security;

create policy "Anyone can read surahs" on public.surah
  for select to anon, authenticated using (true);
create policy "Anyone can read verses" on public.verse
  for select to anon, authenticated using (true);
create policy "Anyone can read words" on public.word
  for select to anon, authenticated using (true);
create policy "Anyone can read spans" on public.span
  for select to anon, authenticated using (true);
create policy "Anyone can read sources" on public.source
  for select to anon, authenticated using (true);

create policy "Anyone can read published explanations" on public.explanation
  for select to anon, authenticated using (status = 'published');
create policy "Anyone can read published surah briefs" on public.surah_brief
  for select to anon, authenticated using (status = 'published');
create policy "Anyone can read published word meanings" on public.word_meaning
  for select to anon, authenticated using (status = 'published');

create policy "Anyone can read citations of published explanations" on public.explanation_citation
  for select to anon, authenticated
  using (exists (
    select 1 from public.explanation e
    where e.id = explanation_citation.explanation_id and e.status = 'published'
  ));
create policy "Anyone can read context links of published explanations" on public.context_link
  for select to anon, authenticated
  using (exists (
    select 1 from public.explanation e
    where e.id = context_link.explanation_id and e.status = 'published'
  ));
create policy "Anyone can read reading sections with a published explanation" on public.reading_section
  for select to anon, authenticated
  using (exists (
    select 1 from public.explanation e
    where e.id = reading_section.explanation_id and e.status = 'published'
  ));
create policy "Anyone can read citations of published word meanings" on public.word_meaning_citation
  for select to anon, authenticated
  using (exists (
    select 1 from public.word_meaning m
    where (m.surah, m.ayah, m.position)
        = (word_meaning_citation.surah, word_meaning_citation.ayah, word_meaning_citation.position)
      and m.status = 'published'
  ));

-- A passage's summary is owner content, so it is public only once a published item cites it.
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
  );

-- RLS already blocks writes; revoking the privileges as well keeps it that way if a write policy
-- is ever added by mistake.
revoke insert, update, delete, truncate on
  public.surah, public.verse, public.word, public.span, public.source, public.passage,
  public.explanation, public.explanation_citation, public.context_link, public.reading_section,
  public.surah_brief, public.word_meaning, public.word_meaning_citation,
  public.explanation_review, public.word_meaning_review, public.surah_brief_review
from anon, authenticated;

revoke select on public.explanation_review, public.word_meaning_review, public.surah_brief_review
from anon, authenticated;

-- Loads content/ into the tables above (apps/web/scripts/seed-content.ts builds the payload).
-- A full sync in one transaction: rows missing from the payload are deleted, the rest are
-- upserted, and the child tables are rebuilt. Running it twice gives the same database, and a
-- failed run changes nothing. Only the service role may call it.
create function public.seed_content(payload jsonb)
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
    'word_meaning_reviews'
  ] loop
    if jsonb_typeof(payload -> key) is distinct from 'array' then
      raise exception 'seed_content: payload.% must be an array', key;
    end if;
  end loop;

  -- 1. Child tables are rebuilt from the payload, so clear them first.
  delete from public.explanation_review where true;
  delete from public.word_meaning_review where true;
  delete from public.surah_brief_review where true;
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

  insert into public.reading_section (surah, position, explanation_id)
  select surah, position, explanation_id
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
    'published_explanations', (select count(*) from public.explanation where status = 'published')
  );
end;
$$;

revoke execute on function public.seed_content(jsonb) from public, anon, authenticated;
grant execute on function public.seed_content(jsonb) to service_role;
