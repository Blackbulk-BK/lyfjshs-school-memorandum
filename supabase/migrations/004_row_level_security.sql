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