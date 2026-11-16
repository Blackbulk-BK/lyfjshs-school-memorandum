# Architecture & Tech Stack

This document describes the high-level architecture, technology stack, system components, data flows, and project organization of the **LYFJSHS School Memorandum** system.

---

## 1. High-Level System Architecture

The application adopts a modern JAMstack + Serverless micro-architecture. Static assets are served via CDN edge servers, while dynamic operations (database queries, authentication, storage access) communicate directly with Supabase via client-side SDKs protected by Row-Level Security (RLS). Serverless Node.js endpoints are employed strictly where privileged operations or server-side HTML transformations are necessary (such as dynamic OpenGraph rendering for social media link previews and SMTP email dispatch).

```
                      +-----------------------------+
                      |       Client Browser        |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                                           |
    [Static HTML/CSS/JS]                           [API Requests]
               v                                           v
+-----------------------------+             +-----------------------------+
|    Vercel Edge / CDN        |             |  Vercel Serverless (Node)   |
|  - public/index.html        |             |  - /api/config.js           |
|  - public/memo.html         |             |  - /api/memo.js (OG Tags)   |
|  - public/login.html        |             |  - /api/send-email.js       |
|  - public/admin.html        |             +--------------+--------------+
+--------------+--------------+                            |
               |                                           |
               | (Direct JS Client + Anon Key)             | (Nodemailer)
               v                                           v
+-----------------------------+             +-----------------------------+
|      Supabase Cloud         |             |      Brevo / Gmail SMTP     |
|  - Auth (Admin User)        |             |  - Transactional Emails     |
|  - PostgreSQL (RLS)         |             |  - 50-Recipient BCC Batches |
|  - Storage ('memorandums')  |             +-----------------------------+
+-----------------------------+
```

---

## 2. Technology Stack & Dependencies

### Frontend Layer
- **HTML5 & Modern CSS3**: Semantic HTML markup paired with custom CSS variables (design tokens), flexbox, grid, and fluid typography. Zero frontend framework overhead (no React, Vue, or Angular) ensures instant loading even on slow 3G mobile connections.
- **Vanilla ES6+ JavaScript**: Native browser APIs (`fetch`, `URLSearchParams`, `history.pushState`/`replaceState`, `FormData`, Web Components/custom SVG rendering).
- **SheetJS (xlsx 0.18.5)**: Client-side Excel parsing and workbook generation for email recipient lists without transferring raw files to a server.
- **Supabase JavaScript Client (v2.x CDN)**: Direct database and storage communication from the browser using the public anonymous API key.

### Backend & Serverless Layer
- **Node.js (>= 20.0.0)**: Modern runtime supporting native ES syntax and built-in Node modules.
- **Nodemailer (^6.9.0)**: Robust email delivery engine supporting SMTP authentication, connection pooling, and multi-part MIME generation with inline CID attachments.
- **@supabase/supabase-js (2.109.0)**: Server-side Supabase client instantiated with request authorization tokens to enforce database RLS policies.
- **Express (^4.19.0)** *(Dev Dependency)*: Local development server emulator mocking Vercel serverless routes and static hosting.
- **dotenv (^16.4.0)** *(Dev Dependency)*: Environment variable loader for local execution.

### Cloud Infrastructure & Third-Party Services
- **Vercel**: Global CDN, serverless function execution, routing engine (`vercel.json`), automatic SSL certificates.
- **Supabase**: Managed PostgreSQL database, built-in Authentication service, and S3-compatible file storage.
- **Brevo SMTP (Primary)**: Standard transactional email relay service optimized for high deliverability.
- **Gmail SMTP (Fallback)**: Alternative delivery provider using Google App Passwords.
- **Microsoft Office Online Apps**: Third-party iframe embedder (`view.officeapps.live.com`) used to preview Word, Excel, and PowerPoint files without converting them on the server.

---

## 3. Data Flow Workflows

### 3.1 Public User Flow (Browse & Search)
1. User visits `/` or `/memo/:id`.
2. Vercel serves the static HTML/CSS/JS shell from edge cache.
3. The page requests `/config.js` to retrieve `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
4. The client executes Supabase JS queries directly against PostgreSQL (`memorandums` table).
5. Supabase RLS policies evaluate `using (true)` for public read access and return results.
6. When opening a file, the browser queries Supabase Storage public CDN URL directly.

### 3.2 Administrator Upload Flow
1. Uploader logs in at `/login` using email and password via `sb.auth.signInWithPassword()`.
2. Supabase issues a JSON Web Token (JWT) containing the user session.
3. The client queries `public.admins` table. RLS ensures only genuine admin user IDs can read this table.
4. On `/admin`, the user selects a file and enters metadata (`memo-no`, `title`, `date`).
5. The file is uploaded to the Supabase Storage bucket `memorandums` under a sanitized, timestamped path: `${Date.now()}-${sanitizedName}`.
6. If the file upload succeeds, the client inserts a row into `public.memorandums`.
7. **Rollback Safeguard**: If the database record insertion fails, the client immediately sends a deletion request to Supabase Storage to prevent orphaned storage blobs.
8. If both succeed, the client automatically makes an authenticated request to `POST /api/send-email` to notify registered recipients.

### 3.3 Email Notification Flow
1. Client sends a `POST` request to `/api/send-email` with header `Authorization: Bearer <JWT>` and payload `{ memoId, includeSavedRecipients: true }`.
2. The endpoint verifies the JWT against Supabase Auth (`getUser(token)`).
3. The endpoint confirms that the authenticated user's ID exists in `public.admins`.
4. It loads the memorandum data and recipient emails from `public.share_recipients`.
5. It divides the recipients into chunks of 50.
6. For each chunk, it sends an email through Brevo/Gmail SMTP:
   - Primary `To:` set to the school's default address.
   - All other recipients in the chunk placed in `BCC:` to preserve recipient privacy.
   - The school logo is read from the local file system and attached as an inline CID (`cid:school-logo`).
7. For each chunk, results (`sent` or `failed`) are logged into `public.share_logs`.

---

## 4. Repository Directory Structure

```
lyfjshs-school-memorandum/
├── .env.example              # Template for required environment variables
├── .env.local                # Local development environment overrides (untracked)
├── .gitignore                # Git ignore patterns
├── local-server.js           # Express runner for local development (npm start)
├── package.json              # Node dependencies and project metadata
├── package-lock.json         # Pinned dependency tree
├── README.md                 # Basic repository readme and quickstart
├── vercel.json               # Vercel deployment configuration, rewrites, timeouts
├── api/                      # Serverless backend functions
│   ├── config.js             # Generates dynamic window.APP_CONFIG
│   ├── memo.js               # Injects OpenGraph meta tags into memo.html
│   └── send-email.js         # Nodemailer SMTP batch email dispatcher
├── lib/                      # Shared Node.js utility modules
│   └── shared.js             # Database helpers, sanitization, site URL resolver
├── public/                   # Static frontend assets
│   ├── index.html            # Main public search & archive page
│   ├── memo.html             # Memorandum detail & preview page
│   ├── login.html            # Administrator authentication page
│   ├── admin.html            # Uploader dashboard & management page
│   ├── logo.png              # Official school logo (PNG)
│   ├── README-logo.txt       # Specifications and notes for the school logo
│   ├── css/
│   │   └── style.css         # Unified stylesheet and CSS custom properties
│   └── js/
│       ├── common.js         # Shared client utilities, Supabase client, auth checks
│       ├── icons.js          # SVG icon helper (SchoolIcons)
│       ├── index.js          # Logic for home page search, filter, and sort
│       ├── memo.js           # Logic for preview, download, social share, email
│       ├── login.js          # Logic for admin login & error reporting
│       └── admin.js          # Logic for upload, memo deletion, Excel recipient import
├── supabase/                 # Supabase configuration & database migrations
│   ├── schema.sql            # Master idempotent SQL setup script
│   └── migrations/           # Incremental migration scripts
│       ├── 001_extensions_and_admins.sql
│       ├── 002_memorandums.sql
│       ├── 003_sharing_tables.sql
│       ├── 004_row_level_security.sql
│       ├── 005_storage_bucket.sql
│       └── 006_make_uploader_admin.sql
└── DOCS/                     # Complete technical documentation suite
    ├── README.md             # Documentation index & quick reference
    ├── ARCHITECTURE.md       # Architecture & Tech Stack (this document)
    ├── FRONTEND.md           # Frontend deep dive & UI specifications
    ├── BACKEND_API.md        # API endpoints & serverless function specifications
    ├── DATABASE_AND_STORAGE.md # Schema, RLS, triggers & storage bucket details
    ├── EMAIL_SYSTEM.md       # Email engine, SMTP, templates & Excel workflows
    └── DEPLOYMENT_AND_OPERATIONS.md # Deployment, configuration & troubleshooting
```
