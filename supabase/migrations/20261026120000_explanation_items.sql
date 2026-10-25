-- Explanations become lists of items, each with its own citations, so readers see which source
-- supports which point, and who the source quotes (ADR 0015, #27). The surah brief becomes a list
-- of paragraphs in the same way, and a word meaning gets "elsewhere" notes.
--
-- Related verses and elsewhere notes refer to a verse by surah and ayah without a foreign key, so
-- they can name verses of surahs that aren't imported yet. The content validation checks them
-- against Tanzil's verse counts (content/quran-metadata.json).

create type public.explanation_part as enum ('word_meanings', 'background', 'context', 'connected_verses');

-- One point of an explanation, in English and Korean. Related verses (part connected_verses) name
-- the verse they point to; other parts don't.
create table public.explanation_item (
  explanation_id text not null references public.explanation (id) on delete cascade,
  part public.explanation_part not null,
  sort_order smallint not null check (sort_order >= 0),
  text_en text,
  text_ko text,
  verse_surah smallint check (verse_surah between 1 and 114),
  verse_ayah smallint check (verse_ayah > 0),
  primary key (explanation_id, part, sort_order),
  check ((verse_surah is null) = (verse_ayah is null)),
  check ((part = 'connected_verses') = (verse_surah is not null))
);

-- `quoting` names who the cited passage quotes or narrates from ("Muslim", "al-Ṭabarī").
create table public.explanation_item_citation (
  explanation_id text not null,
  part public.explanation_part not null,
  item_order smallint not null,
  sort_order smallint not null check (sort_order >= 0),
  passage_id text not null references public.passage (id) on delete cascade,
  quoting text,
  primary key (explanation_id, part, item_order, sort_order),
  foreign key (explanation_id, part, item_order)
    references public.explanation_item (explanation_id, part, sort_order) on delete cascade
);

create index explanation_item_citation_passage on public.explanation_item_citation (passage_id);

-- The surah brief, one paragraph per item.
create table public.surah_brief_item (
  surah smallint not null references public.surah_brief (surah) on delete cascade,
  sort_order smallint not null check (sort_order >= 0),
  text_en text,
  text_ko text,
  primary key (surah, sort_order)
);

create table public.surah_brief_item_citation (
  surah smallint not null,
  item_order smallint not null,
  sort_order smallint not null check (sort_order >= 0),
  passage_id text not null references public.passage (id) on delete cascade,
  quoting text,
  primary key (surah, item_order, sort_order),
  foreign key (surah, item_order)
    references public.surah_brief_item (surah, sort_order) on delete cascade
);

create index surah_brief_item_citation_passage on public.surah_brief_item_citation (passage_id);

-- What the word means elsewhere, usually in another verse. A note about Arabic usage has no verse.
create table public.word_meaning_elsewhere (
  surah smallint not null,
  ayah smallint not null,
  position smallint not null,
  sort_order smallint not null check (sort_order >= 0),
  verse_surah smallint check (verse_surah between 1 and 114),
  verse_ayah smallint check (verse_ayah > 0),
  text_en text,
  text_ko text,
  primary key (surah, ayah, position, sort_order),
  foreign key (surah, ayah, position)
    references public.word_meaning (surah, ayah, position) on delete cascade,
  check ((verse_surah is null) = (verse_ayah is null))
);

alter table public.word_meaning_citation add column quoting text;

-- Move existing text into items. Only empty placeholders exist so far. A related-verses text has
-- no verse to point to, so it can't become an item and must be moved by hand first.
do $$
begin
  if exists (
    select 1 from public.explanation
    where connected_verses_en is not null or connected_verses_ko is not null
  ) then
    raise exception 'explanation.connected_verses_* has text; move it into content files as related verses first';
  end if;
end;
$$;

insert into public.explanation_item (explanation_id, part, sort_order, text_en, text_ko)
select e.id, parts.part, 0, parts.text_en, parts.text_ko
from public.explanation e,
  lateral (values
    ('word_meanings'::public.explanation_part, e.word_meanings_en, e.word_meanings_ko),
    ('background'::public.explanation_part, e.background_en, e.background_ko),
    ('context'::public.explanation_part, e.context_en, e.context_ko)
  ) as parts (part, text_en, text_ko)
where parts.text_en is not null or parts.text_ko is not null;

insert into public.surah_brief_item (surah, sort_order, text_en, text_ko)
select surah, 0, brief_en, brief_ko
from public.surah_brief
where brief_en is not null or brief_ko is not null;

alter table public.explanation
  drop column word_meanings_en, drop column word_meanings_ko,
  drop column background_en, drop column background_ko,
  drop column context_en, drop column context_ko,
  drop column connected_verses_en, drop column connected_verses_ko;

alter table public.surah_brief drop column brief_en, drop column brief_ko;

-- Row level security: readers see items, their citations and elsewhere notes only once what they
-- belong to is published.

alter table public.explanation_item enable row level security;
alter table public.explanation_item_citation enable row level security;
alter table public.surah_brief_item enable row level security;
alter table public.surah_brief_item_citation enable row level security;
alter table public.word_meaning_elsewhere enable row level security;

create policy "Anyone can read items of published explanations" on public.explanation_item
  for select to anon, authenticated
  using (exists (
    select 1 from public.explanation e
    where e.id = explanation_item.explanation_id and e.status = 'published'
  ));
create policy "Anyone can read item citations of published explanations" on public.explanation_item_citation
  for select to anon, authenticated
  using (exists (
    select 1 from public.explanation e
    where e.id = explanation_item_citation.explanation_id and e.status = 'published'
  ));
create policy "Anyone can read paragraphs of published briefs" on public.surah_brief_item
  for select to anon, authenticated
  using (exists (
    select 1 from public.surah_brief b
    where b.surah = surah_brief_item.surah and b.status = 'published'
  ));
create policy "Anyone can read paragraph citations of published briefs" on public.surah_brief_item_citation
  for select to anon, authenticated
  using (exists (
    select 1 from public.surah_brief b
    where b.surah = surah_brief_item_citation.surah and b.status = 'published'
  ));
create policy "Anyone can read elsewhere notes of published word meanings" on public.word_meaning_elsewhere
  for select to anon, authenticated
  using (exists (
    select 1 from public.word_meaning m
    where (m.surah, m.ayah, m.position)
        = (word_meaning_elsewhere.surah, word_meaning_elsewhere.ayah, word_meaning_elsewhere.position)
      and m.status = 'published'
  ));

-- A passage is public once a published explanation, word meaning or brief cites it. An
-- explanation's item citations are always in its explanation_citation list (the seed derives it).
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
  );

revoke insert, update, delete, truncate on
  public.explanation_item, public.explanation_item_citation, public.surah_brief_item,
  public.surah_brief_item_citation, public.word_meaning_elsewhere
from anon, authenticated;

-- The seed loads the new tables. Same contract as before: a full sync in one transaction,
-- callable only by the service role.
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
    'word_meaning_reviews', 'verse_transliterations', 'verse_transliteration_reviews',
    'explanation_items', 'explanation_item_citations', 'surah_brief_items',
    'surah_brief_item_citations', 'word_meaning_elsewhere'
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
  delete from public.explanation_item_citation where true;
  delete from public.explanation_item where true;
  delete from public.surah_brief_item_citation where true;
  delete from public.surah_brief_item where true;
  delete from public.word_meaning_elsewhere where true;
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

  insert into public.explanation (id, span_id, kind, status)
  select id, span_id, kind, status
  from jsonb_populate_recordset(null::public.explanation, payload -> 'explanations')
  on conflict (id) do update set
    span_id = excluded.span_id, kind = excluded.kind, status = excluded.status;

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
    'published_explanations', (select count(*) from public.explanation where status = 'published')
  );
end;
$$;

revoke execute on function public.seed_content(jsonb) from public, anon, authenticated;
grant execute on function public.seed_content(jsonb) to service_role;
