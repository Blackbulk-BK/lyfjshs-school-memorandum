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
drop policy if exists "Admin can read own row" on public.admins;
create policy "Admin can read own row"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());
