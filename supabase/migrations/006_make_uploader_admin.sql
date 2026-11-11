-- 006: Run this LAST, after you create the uploader's account.
--
-- Steps:
--   1. Supabase Dashboard > Authentication > Users > "Add user"
--      Create lyfjshsmemorandum@gmail.com with the password supplied by the owner
--      and tick "Auto Confirm User".
--   2. Authentication > Sign In / Providers > turn OFF "Allow new users to sign up"
--      so nobody else can create an account
--   3. Run this migration after the user has been created.

insert into public.admins (user_id)
select id from auth.users
where email = 'lyfjshsmemorandum@gmail.com'
on conflict do nothing;
