# Luis Y. Ferrer Jr. Senior High School — School Memorandum

Website where one uploader posts school memorandums (PDF, Excel, Word, any file) and everyone can view, search, and share them.

**Stack:** Next.js 14 (TypeScript) · Supabase (Postgres + Auth + Storage) · Nodemailer (Gmail) · hosted on Vercel

## Setup

1. Create a free project at https://supabase.com
2. Authentication > Users > Add user (the uploader). Then turn OFF "Allow new users to sign up".
3. Edit the email in `supabase/migrations/006_make_uploader_admin.sql`, then paste `supabase/schema.sql` in the SQL Editor and Run.
4. Copy `.env.example` to `.env.local` and fill it in.
5. Put the school logo at `public/logo.png`.
6. `npm install` then `npm run dev` and open http://localhost:3000

## Pages

| Route | Who | What |
|---|---|---|
| `/` | everyone | List + search |
| `/memo/[id]` | everyone | File preview, download, Facebook share (uploader also sees email share) |
| `/login` | uploader | Log in |
| `/admin` | uploader | Upload / delete |

## Deploy

Push to GitHub, import the repo in Vercel, and add the same variables from `.env.example` in Vercel > Settings > Environment Variables (set `NEXT_PUBLIC_SITE_URL` to the real website address).
