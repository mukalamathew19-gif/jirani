-- Jirani pilot: richer profiles, quote requests, reviews, and safety reports.
-- Additive migration. Existing accounts and worker listings remain intact.

alter table public.worker_profiles
  add column if not exists bio text not null default '' check (char_length(bio) <= 500),
  add column if not exists price_hint text not null default '' check (char_length(price_hint) <= 100),
  add column if not exists availability text not null default 'available'
    check (availability in ('available', 'busy', 'paused'));

grant insert (bio, price_hint, availability) on public.worker_profiles to authenticated;
grant update (bio, price_hint, availability) on public.worker_profiles to authenticated;

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  worker_id uuid not null references public.worker_profiles (user_id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_phone text not null default '' check (char_length(customer_phone) <= 24),
  service text not null check (char_length(service) between 2 and 80),
  description text not null check (char_length(description) between 8 and 1200),
  locality text not null check (char_length(locality) between 2 and 100),
  preferred_date date,
  budget_hint text not null default '' check (char_length(budget_hint) <= 100),
  status text not null default 'new'
    check (status in ('new', 'accepted', 'declined', 'completed', 'cancelled')),
  worker_note text not null default '' check (char_length(worker_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_id <> worker_id)
);

create index if not exists service_requests_worker_recent_idx
  on public.service_requests (worker_id, created_at desc);
create index if not exists service_requests_customer_recent_idx
  on public.service_requests (customer_id, created_at desc);

alter table public.service_requests enable row level security;
revoke all on public.service_requests from anon, authenticated;
grant select on public.service_requests to authenticated;
grant insert (customer_id, worker_id, customer_name, customer_phone, service,
              description, locality, preferred_date, budget_hint)
  on public.service_requests to authenticated;
grant update (status, worker_note) on public.service_requests to authenticated;

drop policy if exists "Participants can view service requests" on public.service_requests;
create policy "Participants can view service requests"
  on public.service_requests for select to authenticated
  using ((select auth.uid()) = customer_id or (select auth.uid()) = worker_id);

drop policy if exists "Customers can request listed workers" on public.service_requests;
create policy "Customers can request listed workers"
  on public.service_requests for insert to authenticated
  with check (
    (select auth.uid()) = customer_id
    and exists (
      select 1 from public.worker_profiles p
      where p.user_id = worker_id and p.is_listed and p.contact_consent
        and p.availability <> 'paused'
    )
  );

drop policy if exists "Workers can update their incoming requests" on public.service_requests;
create policy "Workers can update their incoming requests"
  on public.service_requests for update to authenticated
  using ((select auth.uid()) = worker_id and status in ('new', 'accepted'))
  with check ((select auth.uid()) = worker_id and status in ('accepted', 'declined', 'completed'));

drop policy if exists "Customers can cancel or complete their requests" on public.service_requests;
create policy "Customers can cancel or complete their requests"
  on public.service_requests for update to authenticated
  using ((select auth.uid()) = customer_id and status in ('new', 'accepted'))
  with check ((select auth.uid()) = customer_id and status in ('cancelled', 'completed'));

create table if not exists public.worker_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests (id) on delete cascade,
  worker_id uuid not null references public.worker_profiles (user_id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 600),
  created_at timestamptz not null default now()
);

create index if not exists worker_reviews_worker_recent_idx
  on public.worker_reviews (worker_id, created_at desc);
alter table public.worker_reviews enable row level security;
revoke all on public.worker_reviews from anon, authenticated;
grant select on public.worker_reviews to anon, authenticated;
grant insert (request_id, worker_id, customer_id, rating, comment)
  on public.worker_reviews to authenticated;

drop policy if exists "Anyone can read worker reviews" on public.worker_reviews;
create policy "Anyone can read worker reviews"
  on public.worker_reviews for select to anon, authenticated
  using (exists (
    select 1 from public.worker_profiles p
    where p.user_id = worker_id and p.is_listed and p.contact_consent
  ));

drop policy if exists "Review participants can view their reviews" on public.worker_reviews;
create policy "Review participants can view their reviews"
  on public.worker_reviews for select to authenticated
  using ((select auth.uid()) = customer_id or (select auth.uid()) = worker_id);

drop policy if exists "Customers can review completed work once" on public.worker_reviews;
create policy "Customers can review completed work once"
  on public.worker_reviews for insert to authenticated
  with check (
    (select auth.uid()) = customer_id
    and exists (
      select 1 from public.service_requests r
      where r.id = request_id and r.customer_id = (select auth.uid())
        and r.worker_id = worker_reviews.worker_id and r.status = 'completed'
    )
  );

create table if not exists public.worker_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  worker_id uuid not null references public.worker_profiles (user_id) on delete cascade,
  reason text not null check (reason in ('incorrect_details', 'unsafe', 'spam', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists worker_reports_status_recent_idx
  on public.worker_reports (status, created_at desc);
alter table public.worker_reports enable row level security;
revoke all on public.worker_reports from anon, authenticated;
grant insert (reporter_id, worker_id, reason, details) on public.worker_reports to authenticated;
grant select on public.worker_reports to authenticated;

drop policy if exists "Users can submit reports" on public.worker_reports;
create policy "Users can submit reports"
  on public.worker_reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id and reporter_id <> worker_id);

drop policy if exists "Reporters can view their submitted reports" on public.worker_reports;
create policy "Reporters can view their submitted reports"
  on public.worker_reports for select to authenticated
  using ((select auth.uid()) = reporter_id);

create or replace function public.touch_service_request_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.touch_service_request_updated_at() from public, anon, authenticated;
drop trigger if exists touch_service_request_updated_at on public.service_requests;
create trigger touch_service_request_updated_at
  before update on public.service_requests
  for each row execute function public.touch_service_request_updated_at();
