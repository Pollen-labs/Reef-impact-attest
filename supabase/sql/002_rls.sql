-- 002_rls.sql
-- Enable Row Level Security and define policies

begin;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.coral_species enable row level security;
alter table public.attestations enable row level security;

-- Profiles policies
-- Public can read profiles for profile pages
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
  for select using (true);

-- Authenticated users can insert their own profile (user_id must match auth.uid)
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() is not null and user_id = auth.uid());

-- Authenticated users can update their own profile
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() is not null and user_id = auth.uid())
  with check (auth.uid() is not null and user_id = auth.uid());

-- No deletes from client by default (omit delete policy)


-- Coral species policies
-- Public read for selection UI
drop policy if exists coral_species_select_public on public.coral_species;
create policy coral_species_select_public on public.coral_species
  for select using (true);
-- No insert/update/delete from clients by default


-- Attestations policies
-- Public can read for map and profile pages
drop policy if exists attestations_select_public on public.attestations;
create policy attestations_select_public on public.attestations
  for select using (true);

-- Authenticated users can insert rows linked to profiles they own
drop policy if exists attestations_insert_own_profile on public.attestations;
create policy attestations_insert_own_profile on public.attestations
  for insert with check (
    auth.uid() is not null and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

-- Authenticated users can update rows linked to profiles they own
drop policy if exists attestations_update_own_profile on public.attestations;
create policy attestations_update_own_profile on public.attestations
  for update using (
    auth.uid() is not null and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() is not null and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.user_id = auth.uid()
    )
  );

commit;

