-- ALL-IN-ONE: paste this whole file into Supabase > SQL Editor > Run.
-- Remember to edit the email in the last section before running.

-- ============================================================
-- 001: Extensions + admin (the single uploader)
-- ============================================================

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

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

create policy "Admin can read own row"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 002: Memorandums table
-- ============================================================

create table if not exists public.memorandums (
  id          uuid primary key default gen_random_uuid(),
  memo_no     text not null unique,
  title       text not null,
  memo_date   date not null,
  file_path   text not null,
  file_name   text not null,
  file_type   text,
  file_size   bigint,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists memorandums_date_idx
  on public.memorandums (memo_date desc, created_at desc);

create index if not exists memorandums_title_trgm_idx
  on public.memorandums using gin (title extensions.gin_trgm_ops);
create index if not exists memorandums_memo_no_trgm_idx
  on public.memorandums using gin (memo_no extensions.gin_trgm_ops);

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

-- ============================================================
-- 003: Email sharing tables
-- ============================================================

create table if not exists public.share_recipients (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text not null unique,
  created_at timestamptz not null default now()
);

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

-- ============================================================
-- 004: Row Level Security
-- ============================================================

alter table public.memorandums      enable row level security;
alter table public.share_recipients enable row level security;
alter table public.share_logs       enable row level security;

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

create policy "Admin manages recipients"
  on public.share_recipients for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admin manages share logs"
  on public.share_logs for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ============================================================
-- 005: Storage bucket (any file type, 50 MB max)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memorandums', 'memorandums', true, 52428800, null)
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

-- ============================================================
-- 006: Make the uploader the admin (EDIT THE EMAIL BELOW)
-- 1. Authentication > Users > Add user (tick "Auto Confirm User")
-- 2. Authentication > Sign In / Providers > turn OFF "Allow new users to sign up"
-- ============================================================

insert into public.admins (user_id)
select id from auth.users
where email = 'UPLOADER_EMAIL_HERE@gmail.com'
on conflict do nothing;