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
