# Backend & API Reference

This document provides a comprehensive technical reference for all server-side endpoints, serverless functions, shared helper modules, routing specifications, and local runtime emulators.

---

## 1. API Endpoints

### 1.1 `GET /api/config` (`api/config.js`)

#### Purpose
Generates dynamic JavaScript served at `/config.js` to securely provide public Supabase credentials to client-side scripts.

#### Route Mapping
- Defined in `vercel.json`:
  ```json
  { "source": "/config.js", "destination": "/api/config" }
  ```
- Defined in `local-server.js`:
  ```javascript
  app.get('/config.js', configHandler);
  ```

#### Response Details
- **Content-Type**: `application/javascript; charset=utf-8`
- **Cache-Control**: `no-store`
- **Output Payload**:
  ```javascript
  window.APP_CONFIG = {
    "SUPABASE_URL": "https://xyzcompany.supabase.co",
    "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5..."
  };
  ```

---

### 1.2 `GET /api/memo` (`api/memo.js`)

#### Purpose
Renders `/memo/:id` on the server by reading `public/memo.html` and injecting dynamic OpenGraph (`<meta property="og:...">`) metadata. This ensures Facebook, Twitter, Discord, and messaging apps display rich preview cards containing the memorandum title and number when a link is shared.

#### Route Mapping
- Defined in `vercel.json`:
  ```json
  { "source": "/memo/:id", "destination": "/api/memo?id=:id" }
  ```
- Defined in `local-server.js`:
  ```javascript
  app.get('/memo/:id', (req, res) => {
    req.query = { id: req.params.id };
    memoHandler(req, res);
  });
  ```

#### Execution Logic
1. Extracts `id` from query parameter (`req.query.id`).
2. Reads the base template file from `public/memo.html`.
3. Instantiates an unauthenticated Supabase client via `getSupabase()`.
4. Queries `public.memorandums` for `memo_no` and `title` where `id = :id`.
5. Replaces the placeholder `<!--META-->` inside `public/memo.html` with:
   ```html
   <base href="/">
   <title>${esc(title)}</title>
   <meta property="og:title" content="${esc(title)}">
   <meta property="og:description" content="Luis Y. Ferrer Jr. Senior High School — School Memorandum">
   <meta property="og:type" content="article">
   <meta property="og:url" content="${esc(siteUrl(req) + '/memo/' + id)}">
   ```
6. Sends the combined HTML with `Content-Type: text/html; charset=utf-8`.

---

### 1.3 `POST /api/send-email` (`api/send-email.js`)

#### Purpose
Dispatches email notifications to saved staff and teachers when a memorandum is uploaded or shared. Only accessible by verified administrators.

#### Authentication & Authorization
- **Header Required**: `Authorization: Bearer <supabase_access_token>`
- **Validation**:
  1. Calls `userDb.auth.getUser(token)` to verify the JWT signature and expiration.
  2. Queries `public.admins` using the user's ID. If no admin record exists, returns `403 Forbidden`.

#### Request Payload
```json
{
  "memoId": "d1357fbb-5a49-4171-a477-9ca8e3328e12",
  "includeSavedRecipients": true,
  "recipients": ["optional.additional.recipient@gmail.com"]
}
```

#### Processing Steps
1. **Recipient Aggregation**:
   - Gathers explicit emails from `recipients` array (if provided).
   - If `includeSavedRecipients: true`, queries `public.share_recipients` for all saved recipient emails.
   - Cleans, trims, lowercases, and validates emails against `EMAIL_RE`.
   - Deduplicates the list and removes the sender's own default address from BCC.
2. **Rate & Quota Validation**:
   - Enforces `MAX_RECIPIENTS` limit (default: 290, tailored for Brevo's 300 free daily credits).
3. **Template Compilation**:
   - Retrieves memorandum details (`memo_no`, `title`, `memo_date`, `file_path`).
   - Generates direct page URL and Supabase storage download link.
   - Reads the school logo (`public/logo.png`) from disk.
   - Builds responsive HTML email with inline CID attachment (`cid:school-logo`) and plain-text fallback.
4. **Chunked Dispatch**:
   - Splits recipients into chunks of 50 (`BATCH_SIZE = 50`).
   - For each chunk:
     - First chunk sets `to: MEMO_DEFAULT_RECIPIENT` and `bcc: [batch]`.
     - Subsequent chunks set `to: MAIL_FROM` and `bcc: [batch]`.
     - Delivers via Nodemailer SMTP.
5. **Audit Logging**:
   - For every recipient in a batch, records status in `public.share_logs`:
     - Successful sends logged as `status: 'sent'`.
     - Errors logged as `status: 'failed'` along with truncated error text (`error_message`).
6. **Response**:
   - Returns JSON summary:
     ```json
     {
       "sent": 142,
       "failed": 0,
       "total": 142
     }
     ```

---

## 2. Shared Helpers (`lib/shared.js`)

The `lib/shared.js` module provides core shared utilities for backend handlers:

### `EMAIL_RE`
Standard RFC-compliant email validation regular expression:
```javascript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

### `getConfig()`
Reads and normalizes environment variables across hosting environments (supporting both standard and Next.js-style variable naming conventions):
```javascript
function getConfig() {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY:
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
```

### `getSupabase(token)`
Instantiates and returns a `@supabase/supabase-js` client. If a bearer token is passed, attaches it as the default `Authorization` header so all database operations are subject to PostgreSQL RLS rules for that user.

### `esc(str)`
Escapes HTML special characters (`&`, `<`, `>`, `"`, `'`) to prevent XSS injection in server-rendered templates.

### `siteUrl(req)`
Determines the canonical base URL of the website:
1. Inspects `x-forwarded-proto` and `x-forwarded-host` headers (supplied by Vercel edge proxies).
2. Falls back to `req.headers.host` or `localhost:3000`.
3. Respects `SITE_URL` environment variable if defined and not mismatched with local dev environments.

---

## 3. Local Development Server (`local-server.js`)

When running `npm start` or `npm run dev`, `local-server.js` emulates the Vercel serverless environment using Express:

- Loads `.env` via `dotenv`.
- Validates that `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are present.
- Displays helpful startup warnings if SMTP credentials are missing.
- Registers routes matching production Vercel behavior:
  - `GET /config.js` -> `api/config.js`
  - `GET /memo/:id` -> `api/memo.js`
  - `POST /api/send-email` -> `api/send-email.js`
  - `GET /login` -> `public/login.html`
  - `GET /admin` -> `public/admin.html`
  - Static file middleware pointing to `public/`.
- Starts listening on `process.env.PORT || 3000`.

---

## 4. Vercel Configuration (`vercel.json`)

```json
{
  "framework": null,
  "outputDirectory": "public",
  "cleanUrls": true,
  "rewrites": [
    { "source": "/config.js", "destination": "/api/config" },
    { "source": "/memo/:id", "destination": "/api/memo?id=:id" }
  ],
  "functions": {
    "api/memo.js": { "includeFiles": "public/memo.html" },
    "api/send-email.js": { "maxDuration": 60 }
  }
}
```

### Critical Directives
- **`outputDirectory: "public"`**: Designates static asset root directory.
- **`cleanUrls: true`**: Automatically serves `/login.html` as `/login` and `/admin.html` as `/admin`.
- **`functions["api/memo.js"].includeFiles`**: Bundles `public/memo.html` into the serverless function bundle so `fs.readFileSync` succeeds on Vercel lambda containers.
- **`functions["api/send-email.js"].maxDuration: 60`**: Extends execution timeout to 60 seconds (up from default 10s) to accommodate multi-batch SMTP handshakes.
