-- Tester preview (#23, ADR 0016). Accounts on the tester list can read content that is in review:
-- explanations, briefs and word meanings from en_approved on, and draft transliterations. Everyone
-- else reads exactly what they read before. The policies below are added next to the existing
-- ones; Postgres ORs permissive policies, so they only ever widen access for testers.

-- Who is a tester. Only the service role (and the SQL editor) can read or change the list: there
-- are no policies, and every privilege is revoked from anon and authenticated, so no client call
-- can add a tester. README, "Tester accounts", has the SQL to add or remove one.
create table public.tester (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_on timestamptz not null default now(),
  note text
);

alter table public.tester enable row level security;
revoke all on public.tester from anon, authenticated;

-- Whether the caller is a tester. Security definer, so it can read the list the caller can't; it
-- takes no arguments, so it only ever answers for the caller (false for anon).
create function public.is_tester()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tester where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_tester() from public;
grant execute on function public.is_tester() to anon, authenticated;

-- The review steps testers see: the English is approved, and the item isn't published yet.
-- Plain drafts stay hidden, because no reviewer has approved their English.
create function public.is_preview_status(status public.review_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select status in ('en_approved', 'ko_drafted', 'ko_approved');
$$;

-- Explanations and their parts.
create policy "Testers can read explanations in review" on public.explanation
  for select to authenticated
  using ((select public.is_tester()) and public.is_preview_status(status));
create policy "Testers can read items of explanations in review" on public.explanation_item
  for select to authenticated
  using ((select public.is_tester()) and exists (
    select 1 from public.explanation e
    where e.id = explanation_item.explanation_id and public.is_preview_status(e.status)
  ));
create policy "Testers can read item citations of explanations in review" on public.explanation_item_citation
  for select to authenticated
  using ((select public.is_tester()) and exists (
    select 1 from public.explanation e
    where e.id = explanation_item_citation.explanation_id and public.is_preview_status(e.status)
  ));
create policy "Testers can read citations of explanations in review" on public.explanation_citation
  for select to authenticated
  using ((select public.is_tester()) and exists (
    select 1 from public.explanation e
    where e.id = explanation_citation.explanation_id and public.is_preview_status(e.status)
  ));
create policy "Testers can read context links of explanations in review" on public.context_link
  for select to authenticated
  using ((select public.is_tester()) and exists (
    select 1 from public.explanation e
    where e.id = context_link.explanation_id and public.is_preview_status(e.status)
  ));

-- Surah briefs.
create policy "Testers can read briefs in review" on public.surah_brief
  for select to authenticated
  using ((select public.is_tester()) and public.is_preview_status(status));
create policy "Testers can read paragraphs of briefs in review" on public.surah_brief_item
  for select to authenticated
  using ((select public.is_tester()) and exists (
    select 1 from public.surah_brief b
    where b.surah = surah_brief_item.surah and public.is_preview_status(b.status)
  ));
create policy "Testers can read paragraph citations of briefs in review" on public.surah_brief_item_citation
  for select to authenticated
  using ((select public.is_tester()) and exists (
    select 1 from public.surah_brief b
    where b.surah = surah_brief_item_citation.surah and public.is_preview_status(b.status)
  ));

-- Word meanings.
create policy "Testers can read word meanings in review" on public.word_meaning
  for select to authenticated
  using ((select public.is_tester()) and public.is_preview_status(status));
create policy "Testers can read citations of word meanings in review" on public.word_meaning_citation
  for select to authenticated
  using ((select public.is_tester()) and exists (
    select 1 from public.word_meaning m
    where (m.surah, m.ayah, m.position)
        = (word_meaning_citation.surah, word_meaning_citation.ayah, word_meaning_citation.position)
      and public.is_preview_status(m.status)
  ));
create policy "Testers can read elsewhere notes of word meanings in review" on public.word_meaning_elsewhere
  for select to authenticated
  using ((select public.is_tester()) and exists (
    select 1 from public.word_meaning m
    where (m.surah, m.ayah, m.position)
        = (word_meaning_elsewhere.surah, word_meaning_elsewhere.ayah, word_meaning_elsewhere.position)
      and public.is_preview_status(m.status)
  ));

-- Transliterations: testers see every step, drafts included (they are draft-only for now).
create policy "Testers can read every transliteration" on public.verse_transliteration
  for select to authenticated
  using ((select public.is_tester()));

-- Passages cited by content in review.
create policy "Testers can read passages cited by content in review" on public.passage
  for select to authenticated
  using (
    (select public.is_tester())
    and (
      exists (
        select 1
        from public.explanation_citation c
        join public.explanation e on e.id = c.explanation_id
        where c.passage_id = passage.id and public.is_preview_status(e.status)
      )
      or exists (
        select 1
        from public.word_meaning_citation c
        join public.word_meaning m
          on (m.surah, m.ayah, m.position) = (c.surah, c.ayah, c.position)
        where c.passage_id = passage.id and public.is_preview_status(m.status)
      )
      or exists (
        select 1
        from public.surah_brief_item_citation c
        join public.surah_brief b on b.surah = c.surah
        where c.passage_id = passage.id and public.is_preview_status(b.status)
      )
    )
  );

-- The review history (reviewer names and notes) gets no tester policy: it stays private.
