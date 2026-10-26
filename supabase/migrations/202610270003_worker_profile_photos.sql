-- Store worker photos in a private bucket. Public directory photos are served
-- through short-lived signed URLs only when the worker explicitly lists a
-- consented profile. Object paths are always rooted at the owning auth user id.

alter table public.worker_profiles
  add column if not exists profile_photo_path text
  check (profile_photo_path is null or char_length(profile_photo_path) <= 255);

grant insert (profile_photo_path) on public.worker_profiles to authenticated;
grant update (profile_photo_path) on public.worker_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jirani-worker-photos', 'jirani-worker-photos', false, 1048576, array['image/jpeg']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = 1048576,
    allowed_mime_types = array['image/jpeg']::text[];

drop policy if exists "Listed workers photos are readable" on storage.objects;
create policy "Listed workers photos are readable"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'jirani-worker-photos'
  and exists (
    select 1 from public.worker_profiles p
    where p.user_id::text = (storage.foldername(name))[1]
      and p.is_listed = true
      and p.contact_consent = true
  )
);

drop policy if exists "Workers can read own profile photos" on storage.objects;
create policy "Workers can read own profile photos"
on storage.objects for select to authenticated
using (bucket_id = 'jirani-worker-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Workers can upload own profile photos" on storage.objects;
create policy "Workers can upload own profile photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'jirani-worker-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Workers can replace own profile photos" on storage.objects;
create policy "Workers can replace own profile photos"
on storage.objects for update to authenticated
using (bucket_id = 'jirani-worker-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'jirani-worker-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Workers can delete own profile photos" on storage.objects;
create policy "Workers can delete own profile photos"
on storage.objects for delete to authenticated
using (bucket_id = 'jirani-worker-photos' and (storage.foldername(name))[1] = auth.uid()::text);
