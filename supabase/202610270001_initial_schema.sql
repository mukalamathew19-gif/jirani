-- Jirani's first hosted backend schema.
-- Public profile fields are visible only after the worker opts in to listing.

create table if not exists public.worker_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 100),
  service text not null check (char_length(service) between 2 and 80),
  locality text not null check (char_length(locality) between 2 and 100),
  contact_phone text not null check (char_length(contact_phone) between 8 and 24),
  years_experience smallint not null default 0 check (years_experience between 0 and 70),
  skills text[] not null default '{}',
  contact_consent boolean not null default false,
  is_listed boolean not null default false,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_profiles_locality_service_listed_idx
  on public.worker_profiles (lower(locality), lower(service))
  where is_listed and contact_consent;

alter table public.worker_profiles enable row level security;

revoke all on table public.worker_profiles from anon, authenticated;
grant select on table public.worker_profiles to anon, authenticated;
grant insert (user_id, display_name, service, locality, contact_phone,
              years_experience, skills, contact_consent, is_listed)
  on public.worker_profiles to authenticated;
grant update (display_name, service, locality, contact_phone,
              years_experience, skills, contact_consent, is_listed)
  on public.worker_profiles to authenticated;
grant delete on table public.worker_profiles to authenticated;

drop policy if exists "Anyone can find listed workers" on public.worker_profiles;
create policy "Anyone can find listed workers"
  on public.worker_profiles for select
  to anon, authenticated
  using (is_listed and contact_consent);

drop policy if exists "Workers can view their own profile" on public.worker_profiles;
create policy "Workers can view their own profile"
  on public.worker_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Workers can create their own consented profile" on public.worker_profiles;
create policy "Workers can create their own consented profile"
  on public.worker_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id and contact_consent);

drop policy if exists "Workers can update their own profile" on public.worker_profiles;
create policy "Workers can update their own profile"
  on public.worker_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Workers can delete their own profile" on public.worker_profiles;
create policy "Workers can delete their own profile"
  on public.worker_profiles for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.worker_profiles (user_id) on delete cascade,
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_note text not null default '' check (char_length(reviewer_note) <= 1000)
);

create unique index if not exists one_pending_verification_per_worker_idx
  on public.verification_requests (worker_id)
  where status = 'pending';

alter table public.verification_requests enable row level security;

revoke all on table public.verification_requests from anon, authenticated;
grant select on table public.verification_requests to authenticated;
grant insert (worker_id, note) on public.verification_requests to authenticated;

drop policy if exists "Workers can read their own verification requests" on public.verification_requests;
create policy "Workers can read their own verification requests"
  on public.verification_requests for select
  to authenticated
  using ((select auth.uid()) = worker_id);

drop policy if exists "Workers can request verification for their own profile" on public.verification_requests;
create policy "Workers can request verification for their own profile"
  on public.verification_requests for insert
  to authenticated
  with check (
    (select auth.uid()) = worker_id
    and exists (
      select 1
      from public.worker_profiles p
      where p.user_id = (select auth.uid())
        and p.verification_status in ('unverified', 'rejected')
    )
  );

create or replace function public.sync_worker_verification_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.worker_profiles
  set verification_status = case new.status
        when 'approved' then 'verified'
        else new.status
      end,
      updated_at = now()
  where user_id = new.worker_id;
  return new;
end;
$$;

revoke all on function public.sync_worker_verification_status() from public, anon, authenticated;

drop trigger if exists sync_worker_verification_status on public.verification_requests;
create trigger sync_worker_verification_status
  after insert or update of status on public.verification_requests
  for each row execute function public.sync_worker_verification_status();

create or replace function public.touch_worker_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_worker_profile_updated_at() from public, anon, authenticated;

drop trigger if exists touch_worker_profile_updated_at on public.worker_profiles;
create trigger touch_worker_profile_updated_at
  before update on public.worker_profiles
  for each row execute function public.touch_worker_profile_updated_at();
