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
