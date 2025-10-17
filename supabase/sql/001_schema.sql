-- 001_schema.sql
-- Core schema for Coral Action Attestation MVP

begin;

-- Ensure UUID generation is available
create extension if not exists pgcrypto;

-- Enum for regeneration action type
do $$ begin
  if not exists (select 1 from pg_type where typname = 'regen_type') then
    create type public.regen_type as enum ('transplantation', 'nursery', 'other');
  end if;
end $$;

-- Profiles: basic org/user profile
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  wallet_address text not null,
  org_name text not null,
  website text,
  description text,
  handle text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_format_chk check (wallet_address ~ '^0x[0-9a-fA-F]{40}$')
);

-- Enforce unique wallet and handle (case-insensitive for handle)
create unique index if not exists profiles_wallet_address_unique
  on public.profiles (lower(wallet_address));
create unique index if not exists profiles_handle_unique
  on public.profiles (lower(handle));

-- Auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();


-- Reference table for coral species
create table if not exists public.coral_species (
  id uuid primary key default gen_random_uuid(),
  common_name text not null,
  latin_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists coral_species_common_idx on public.coral_species (lower(common_name));
create index if not exists coral_species_latin_idx on public.coral_species (lower(latin_name));


-- Attestations captured by the app; uid is set after relayer returns
create table if not exists public.attestations (
  id uuid primary key default gen_random_uuid(),
  uid text, -- EAS attestation UID, set post-relay
  profile_id uuid not null references public.profiles(id) on delete cascade,
  regen_type public.regen_type not null,
  action_date date not null,
  location_lat numeric(9,6) not null, -- ~0.11m precision at equator
  location_lng numeric(9,6) not null,
  depth numeric(10,2), -- meters
  surface_area numeric(12,2), -- m^2
  species text[] default '{}',
  summary text,
  contributor_name text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure UID unique when present
create unique index if not exists attestations_uid_unique
  on public.attestations (uid) where uid is not null;

-- Useful indexes
create index if not exists attestations_profile_idx on public.attestations (profile_id);
create index if not exists attestations_created_at_idx on public.attestations (created_at desc);
create index if not exists attestations_location_idx on public.attestations (location_lat, location_lng);

-- Auto-update updated_at
drop trigger if exists attestations_touch_updated_at on public.attestations;
create trigger attestations_touch_updated_at
before update on public.attestations
for each row execute function public.touch_updated_at();

commit;
