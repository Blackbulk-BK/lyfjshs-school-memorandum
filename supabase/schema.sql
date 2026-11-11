-- ALL-IN-ONE: paste this whole file into Supabase > SQL Editor > Run.
-- (Same content as the numbered files in /migrations, in order.)
-- Remember to edit the email in the last section before running.

-- 001: Extensions + admin (the single uploader)

-- Fast, typo-friendly search for memo number and title
create extension if not exists pg_trgm with schema extensions;

-- Only users listed here can upload / edit / delete / share
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Helper used by every policy below
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

alter table public.admins enable row level security;

-- An admin can see their own admin row (nobody else can read the table)
create policy "Admin can read own row"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());
-- 002: Memorandums table

create table if not exists public.memorandums (
  id          uuid primary key default gen_random_uuid(),
  memo_no     text not null unique,            -- e.g. "SM NO. 001 s. 2026"
  title       text not null,
  memo_date   date not null,
  file_path   text not null,                   -- path inside the storage bucket
  file_name   text not null,                   -- original file name
  file_type   text,                            -- MIME type, e.g. application/pdf
  file_size   bigint,                          -- bytes
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Newest first on the public list
create index if not exists memorandums_date_idx
  on public.memorandums (memo_date desc, created_at desc);

-- Search by memo number or title
create index if not exists memorandums_title_trgm_idx
  on public.memorandums using gin (title extensions.gin_trgm_ops);
create index if not exists memorandums_memo_no_trgm_idx
  on public.memorandums using gin (memo_no extensions.gin_trgm_ops);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memorandums_set_updated_at on public.memorandums;
create trigger memorandums_set_updated_at
  before update on public.memorandums
  for each row execute function public.set_updated_at();
-- 003: Email sharing (saved recipients + log of what was sent)

-- People the uploader can add to share memorandums with
create table if not exists public.share_recipients (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text not null unique,
  created_at timestamptz not null default now()
);

-- Record of every email share
create table if not exists public.share_logs (
  id              uuid primary key default gen_random_uuid(),
  memorandum_id   uuid not null references public.memorandums (id) on delete cascade,
  recipient_email text not null,
  status          text not null default 'sent' check (status in ('sent', 'failed')),
  error_message   text,
  sent_by         uuid references auth.users (id) on delete set null default auth.uid(),
  sent_at         timestamptz not null default now()
);

create index if not exists share_logs_memo_idx
  on public.share_logs (memorandum_id, sent_at desc);
-- 004: Row Level Security
-- Public (anyone) can READ memorandums. Only the admin can change anything.

alter table public.memorandums     enable row level security;
alter table public.share_recipients enable row level security;
alter table public.share_logs       enable row level security;

-- memorandums
create policy "Anyone can view memorandums"
  on public.memorandums for select
  to anon, authenticated
  using (true);

create policy "Admin can insert memorandums"
  on public.memorandums for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admin can update memorandums"
  on public.memorandums for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admin can delete memorandums"
  on public.memorandums for delete
  to authenticated
  using ((select public.is_admin()));

-- share_recipients (admin only)
create policy "Admin manages recipients"
  on public.share_recipients for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- share_logs (admin only)
create policy "Admin manages share logs"
  on public.share_logs for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
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
-- 006: Run this LAST, after you create the uploader's account.
--
-- Steps:
--   1. Supabase Dashboard > Authentication > Users > "Add user"
--      (enter the uploader's email + password, tick "Auto Confirm User")
--   2. Authentication > Sign In / Providers > turn OFF "Allow new users to sign up"
--      so nobody else can create an account
--   3. Replace the email below with the uploader's email and run it

insert into public.admins (user_id)
select id from auth.users
where email = 'UPLOADER_EMAIL_HERE@gmail.com'
on conflict do nothing;
