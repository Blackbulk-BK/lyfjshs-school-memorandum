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