drop policy if exists "Anyone can list game music" on storage.objects;
create policy "Anyone can list game music"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'game-music');

drop policy if exists "Owner can upload game music" on storage.objects;
create policy "Owner can upload game music"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'game-music'
  and (select auth.jwt() ->> 'email') = 'jrecktenwald_msasd@magnoliascience.org'
);

insert into storage.buckets (id, name, public)
values ('game-token', 'game-token', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can view token image" on storage.objects;
create policy "Anyone can view token image"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'game-token' and name = 'pirate-token');

drop policy if exists "Owner can upload token image" on storage.objects;
create policy "Owner can upload token image"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'game-token'
  and name = 'pirate-token'
  and (select auth.jwt() ->> 'email') = 'jrecktenwald_msasd@magnoliascience.org'
);

drop policy if exists "Owner can replace token image" on storage.objects;
create policy "Owner can replace token image"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'game-token'
  and name = 'pirate-token'
  and (select auth.jwt() ->> 'email') = 'jrecktenwald_msasd@magnoliascience.org'
)
with check (
  bucket_id = 'game-token'
  and name = 'pirate-token'
  and (select auth.jwt() ->> 'email') = 'jrecktenwald_msasd@magnoliascience.org'
);