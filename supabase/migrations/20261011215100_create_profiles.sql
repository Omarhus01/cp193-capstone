-- One profiles row per user, created by a trigger when the user signs up.
-- Later sprints add progress, goals and exercise preferences in their own tables.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  language_pref text not null default 'en' check (language_pref in ('en', 'ko')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'App data for each auth user. Rows are created by the on_auth_user_created trigger.';
comment on column public.profiles.language_pref is 'UI language the user chose: en or ko.';

-- Row level security: users can read and update only their own row.
-- There is no insert or delete policy: the trigger inserts rows, and deleting the auth user cascades.
alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Creates the profile on signup. The app passes language_pref in the signup metadata;
-- anything other than 'en' or 'ko' falls back to 'en'.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, language_pref)
  values (
    new.id,
    case
      when new.raw_user_meta_data ->> 'language_pref' in ('en', 'ko')
        then new.raw_user_meta_data ->> 'language_pref'
      else 'en'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
