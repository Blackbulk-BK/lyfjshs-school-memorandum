-- 005: Storage bucket for the uploaded files (PDF, Excel, Word, images, etc.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memorandums',
  'memorandums',
  true,          -- public links, so viewers and Facebook can open the files
  52428800,      -- 50 MB per file (the free-tier maximum)
  null           -- null = any file type allowed
)
on conflict (id) do nothing;

create policy "Anyone can read memorandum files"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'memorandums');

create policy "Admin can upload memorandum files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'memorandums' and (select public.is_admin()));

create policy "Admin can update memorandum files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'memorandums' and (select public.is_admin()))
  with check (bucket_id = 'memorandums' and (select public.is_admin()));

create policy "Admin can delete memorandum files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'memorandums' and (select public.is_admin()));
