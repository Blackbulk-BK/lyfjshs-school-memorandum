# Luis Y. Ferrer Jr. Senior High School — School Memorandum

Website where one uploader posts school memorandums (PDF, Excel, Word, any file) and everyone can view, search, and share them.

**Stack:** HTML + CSS + JavaScript (browser) · Node.js functions (server) · Supabase (database, login, file storage) · Brevo (email) · Vercel (hosting)

## Files

| File | Language | What it does |
|---|---|---|
| `public/index.html` | HTML | Home: list + search |
| `public/memo.html` | HTML | One memorandum: preview, download, share |
| `public/login.html` | HTML | Uploader login |
| `public/admin.html` | HTML | Upload / delete / email recipients (Excel import) |
| `public/css/style.css` | CSS | Design |
| `public/js/*.js` | JavaScript (browser) | Behavior of each page |
| `api/config.js` | JavaScript (Node.js) | Gives the browser the Supabase settings |
| `api/memo.js` | JavaScript (Node.js) | Memo page + title for Facebook sharing |
| `api/send-email.js` | JavaScript (Node.js) | Sends the emails through Brevo |
| `lib/shared.js` | JavaScript (Node.js) | Shared helpers |
| `local-server.js` | JavaScript (Node.js) | Runs everything on your PC (`npm start`) |
| `vercel.json` | JSON | Tells Vercel how to run the site |
| `supabase/*.sql` | SQL | Database, security, file storage |

## 1. Supabase (once)

1. Authentication > Users > Add user. Create `lyfjshsmemorandum@gmail.com` with the password supplied by the owner, and tick *Auto Confirm User*.
2. Authentication > Sign In / Providers > turn OFF *Allow new users to sign up*.
3. SQL Editor > New query > paste `supabase/schema.sql` > Run. It is safe to run again and adds the account as the uploader admin.

## 2. Brevo (email)

1. Sign up at https://www.brevo.com
2. Senders, Domains & IPs > Senders > add and verify your school Gmail.
3. SMTP & API > SMTP > copy the login and generate an SMTP key.
4. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (the SMTP key), and `MAIL_FROM` in `.env` or Vercel Environment Variables. `SMTP_PASS` is required; use port 587 or 465.

## 3. Run on your computer

1. Install Node.js (LTS) from https://nodejs.org
2. Copy `.env.example` to `.env` and fill it in.
3. Put the school logo at `public/logo.png`
4. `npm install` then `npm start` > open http://localhost:3000

## 4. Put it online with Vercel

1. Push the project to GitHub (`.env` is NOT uploaded).
2. https://vercel.com > Add New > Project > import the repo.
3. Framework Preset: **Other**. Leave the build settings as they are (vercel.json handles them).
4. Open **Environment Variables** and add every line from your `.env` (name and value), except you can skip `SITE_URL`.
5. Deploy. Your site is at `https://your-project.vercel.app`.
6. Facebook sharing works on this online address (not on localhost).

## Adding many email recipients at once

Log in > Uploader page > Email recipients > Download the Excel template > fill in Name and Email > Upload it.
