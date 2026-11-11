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
