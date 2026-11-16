# Deployment & Operations Guide

This guide covers everything required to set up, configure, deploy, maintain, and troubleshoot the **LYFJSHS School Memorandum** system in both local development and production cloud environments.

---

## 1. Environment Variables Specification

The system requires specific environment variables to connect to Supabase and the email relay.

| Variable Name | Required? | Example Value | Description |
|---|---|---|---|
| `SUPABASE_URL` | **Yes** | `https://xyz.supabase.co` | Your Supabase project API base URL. |
| `SUPABASE_PUBLISHABLE_KEY` | **Yes** | `eyJhbGciOiJIUzI1NiIsInR5...` | Public anonymous API key (`anon` key). |
| `SMTP_HOST` | Required for Brevo | `smtp-relay.brevo.com` | SMTP relay hostname. |
| `SMTP_PORT` | Optional (default 587) | `587` or `465` | SMTP port (`587` for STARTTLS, `465` for SSL). |
| `SMTP_USER` | Required for Brevo | `7a12b4001@smtp-brevo.com` | Brevo SMTP account login identifier. |
| `SMTP_PASS` | Required for Brevo | `xsmtpsib-8923...` | Brevo generated SMTP master key. |
| `MAIL_FROM` | **Yes** | `lyfjshsmemorandum@gmail.com` | Sender email address (must be verified in Brevo). |
| `MEMO_DEFAULT_RECIPIENT` | Optional | `lyfjshsmemorandum@gmail.com` | Primary recipient in the `To:` field of broadcasts. |
| `MAX_RECIPIENTS` | Optional (default 290) | `290` | Maximum email recipients per blast. |
| `SITE_URL` | Optional | `https://school-memo.vercel.app` | Canonical public site URL. |
| `GMAIL_USER` | Gmail fallback only | `school@gmail.com` | Gmail address if using Google SMTP. |
| `GMAIL_APP_PASSWORD` | Gmail fallback only | `abcd efgh ijkl mnop` | 16-character Google App Password. |
| `PORT` | Optional (default 3000) | `3000` | Port for the local Express runner. |

---

## 2. Setting Up Supabase from Scratch

Follow these steps to initialize a fresh Supabase cloud project:

### Step 1: Create a Project
1. Log into [Supabase](https://supabase.com) and create a new project.
2. Select your closest region (e.g. `Singapore - ap-southeast-1`).
3. Note your project URL and anonymous API key from **Project Settings > API**.

### Step 2: Configure Authentication
1. Navigate to **Authentication > Users** and click **Add user > Create user**.
2. Email: `lyfjshsmemorandum@gmail.com` (or your school uploader email).
3. Set a strong password and check **Auto Confirm User**.
4. Go to **Authentication > Providers > Email**.
5. **CRITICAL**: Turn **OFF** the toggle for **"Allow new users to sign up"**. This prevents unauthorized public user registrations.

### Step 3: Run Database Schema
1. Navigate to **SQL Editor > New query**.
2. Open [`supabase/schema.sql`](../supabase/schema.sql) in this repository.
3. Paste the contents into the SQL Editor and click **Run**.
4. The script will:
   - Enable `pg_trgm` extension.
   - Create tables: `admins`, `memorandums`, `share_recipients`, `share_logs`.
   - Configure Row Level Security (RLS) policies.
   - Create the 50MB `memorandums` storage bucket.
   - Insert the `lyfjshsmemorandum@gmail.com` user into `public.admins`.

---

## 3. Setting Up Brevo (SMTP Email)

1. Sign up for a free account at [Brevo](https://www.brevo.com).
2. Go to **Senders, Domains & IPs > Senders**.
3. Click **Add a Sender** and add your school email (e.g. `lyfjshsmemorandum@gmail.com`).
4. Check your Gmail inbox and click the verification link sent by Brevo.
5. Go to **SMTP & API > SMTP**.
6. Copy the **SMTP Server** (`smtp-relay.brevo.com`), **Port** (`587`), and **Login**.
7. Click **Generate a new SMTP key**, name it (e.g. `School Memo Website`), and copy the key value (this is your `SMTP_PASS`).

---

## 4. Local Development Setup

### Prerequisites
- Node.js version 20.x or newer (`node -v`).
- Git.

### Step-by-Step
```powershell
# 1. Clone the repository
git clone https://github.com/Blackbulk-BK/lyfjshs-school-memorandum.git
cd lyfjshs-school-memorandum

# 2. Install dependencies
npm install

# 3. Create local configuration file
copy .env.example .env

# 4. Fill in .env with your Supabase and Brevo credentials
notepad .env

# 5. Start the local server
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

To run with automatic file reload during development:
```powershell
npm run dev
```

---

## 5. Deploying to Vercel

### Step 1: Connect GitHub Repository
1. Push your repository changes to GitHub.
2. Log into [Vercel](https://vercel.com) and click **Add New > Project**.
3. Select your `lyfjshs-school-memorandum` repository and click **Import**.

### Step 2: Configure Build Settings
- **Framework Preset**: Select **Other**.
- **Root Directory**: `./` (leave default).
- **Build Command**: Leave empty (handled by Vercel static serving).
- **Output Directory**: Leave empty (configured in `vercel.json` as `public`).

### Step 3: Add Environment Variables
Under the **Environment Variables** section, add every key and value from your `.env`:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `MEMO_DEFAULT_RECIPIENT`

*(You do not need to add `PORT` or `SITE_URL` unless using a custom domain).*

### Step 4: Deploy
Click **Deploy**. Vercel will build the edge deployment and assign an active domain (e.g., `https://your-project.vercel.app`).

---

## 6. Maintenance & Operational Procedures

### Adding or Changing Uploader Accounts
To authorize a new staff member to upload memorandums:
1. Create the user in **Supabase Dashboard > Authentication > Users**.
2. Run this SQL query in the **SQL Editor**:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users
   where email = 'new-uploader@gmail.com'
   on conflict do nothing;
   ```
3. To revoke uploader access:
   ```sql
   delete from public.admins
   where user_id in (select id from auth.users where email = 'old-uploader@gmail.com');
   ```

### Managing Storage Quotas
Supabase's free tier provides 1 GB of storage.
- File size limit per upload is configured to 50 MB in `supabase/schema.sql`.
- When an administrator deletes a memorandum from `/admin`, both the database row and the storage object are removed automatically.
- To check storage utilization: Go to **Supabase Dashboard > Storage > Usage**.

---

## 7. Troubleshooting Guide

| Symptom / Error | Root Cause | Solution |
|---|---|---|
| **"Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY"** on startup | `.env` file is missing or variables are empty. | Ensure `.env` exists in project root with valid keys. |
| **"You are signed in, but uploader access is not enabled"** on `/login` | User exists in `auth.users`, but has no row in `public.admins`. | In Supabase SQL Editor, run `insert into public.admins (user_id) values ('<user_id>');`. |
| **"Upload failed: Access Denied"** on `/admin` | Missing RLS storage permission or session expired. | Ensure `005_storage_bucket.sql` has been executed and uploader is signed in. |
| **"SMTP authentication failed (535)"** when uploading | Invalid `SMTP_PASS` or wrong login. | In Brevo, generate a fresh SMTP key. Ensure you use the SMTP key, not your account login password. |
| **"The SMTP server rejected the sender (550 / 553)"** | `MAIL_FROM` address is not verified in Brevo. | Go to Brevo > Senders and complete email verification for that sender address. |
| **Office document preview shows error inside iframe** | Public CDN link is inaccessible or localhost domain. | Microsoft Office Online embed viewer requires a publicly accessible HTTPS URL. Previews for Office docs will only work when hosted on an active domain (e.g. Vercel), not on `localhost`. |
| **Facebook share card shows default text instead of title** | Vercel `/memo/:id` rewrite not functioning or page cached by Facebook. | Paste your public memorandum URL into the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) to refresh the Open Graph cache. |
