create policy "Anyone can list game music"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'game-music');

create policy "Owner can upload game music"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'game-music'
  and (select auth.jwt() ->> 'email') = 'your-owner-email@example.com'
);