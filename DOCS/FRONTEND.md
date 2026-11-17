# Frontend Documentation

This document provides an in-depth reference for the client-side architecture, individual pages, JavaScript modules, UI components, styling system, file preview engine, and accessibility features.

---

## 1. Page Catalog & Architecture

The frontend is implemented with semantic HTML5, modern vanilla JavaScript, and pure CSS. There is no build pipeline required (no Webpack, Vite, or Babel); scripts and styles are executed directly by modern browsers.

### 1.1 Home / Archive Page (`public/index.html`, `public/js/index.js`)

#### Purpose
Provides the public search directory where any visitor can search, filter, sort, and browse memorandums published by the school.

#### Features & User Experience
- **Search Bar**: Real-time debounce search supporting partial and full matches across memorandum title and memorandum number. Special regex characters (`%`, `,`, `(`, `)`, `*`, `\`) are stripped automatically to prevent SQL injection or search syntax errors.
- **Year Filter ("Choose Year")**: Integrated into the **Date issued** column menu, allowing visitors to choose a specific year to filter by (dynamically populated from published memorandums) or view "All years". An active year badge and filtered state indicator appear on the column header when a filter is applied.
- **Multi-Column Sorting**:
  - Sort by **Date Issued** (Newest first / Oldest first), alongside the **Choose Year** filter in the same menu.
  - Sort by **Memorandum Number** (Ascending / Descending numerical order).
  - Sort by **Title** (Alphabetical A–Z / Z–A).
- **Accessibility & ARIA**:
  - The sort headers include `aria-sort="ascending|descending|none"`.
  - Dropdown sort options update `aria-pressed="true|false"`.
  - Dropdown trigger buttons toggle `aria-expanded="true|false"`.
- **URL Synchronization**: Any filter, search query, or sort order is continuously synchronized to browser query parameters (`?q=...&year=...&sort=...`) using `history.replaceState()`. Visitors can bookmark or share direct search links.

#### Lifecycle & Execution Flow
1. Parses URL query string on DOM load.
2. Initializes search input, year selector, and sort toggles to match URL state.
3. Renders a loading state indicator (`<span class="loading-mark"></span> Loading memorandums`).
4. Executes query using `sb.from('memorandums').select('*')`.
   - If a query exists: adds `.or('title.ilike.%q%,memo_no.ilike.%q%')`.
   - If a year exists: adds `.gte('memo_date', '${year}-01-01').lte('memo_date', '${year}-12-31')`.
5. Sorts the resulting records in memory or by query order:
   - Numerical sort parses the numeric portion from memo number patterns (e.g. `SM NO. 123 s. 2026` -> `123`).
6. Injects rendered `<tr>` rows into the table body (`#memo-rows`). Displays clear empty states if no matching records exist.

---

### 1.2 Memorandum Detail & Preview (`public/memo.html`, `public/js/memo.js`)

#### Purpose
Displays an individual memorandum's full details, renders an embedded document preview, and enables file downloads and social sharing.

#### URL Structure & Routing
- Handled via Vercel rewrite: `/memo/:id` points to `/api/memo?id=:id`, which injects OpenGraph tags into `public/memo.html` and serves the page.
- In client JS, the ID is extracted from `location.pathname.split('/').filter(Boolean).pop()`.

#### Component Breakdown
1. **Metadata Header**:
   - Memorandum number (`#memo-no`).
   - Title (`#memo-title`).
   - Formatted issue date (`#memo-date`) formatted as `MM/DD/YYYY`.
2. **Action Bar**:
   - **Download Button (`#download-btn`)**: Direct hyperlink to the Supabase Storage public CDN URL with the `download` attribute set to original file name.
   - **Facebook Share (`#fb-btn`)**: Opens a centered popup window pointing to `https://www.facebook.com/sharer/sharer.php?u=...`.
   - **Copy Link (`#copy-btn`)**: Copies `location.href` to clipboard via `navigator.clipboard.writeText()` and gives visual confirmation ("Link copied") for 2 seconds.
   - **Email Share Bar (`#email-share-panel`)**: Visible only when signed in as an administrator. Allows re-sending notification emails for this specific memorandum to saved recipients.
3. **Document Preview Engine (`#preview`)**:
   Automatically detects file extension and MIME type:
   - **PDF (`application/pdf` or `.pdf`)**: Rendered in an interactive `<iframe>`.
   - **Images (`image/*` or `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`)**: Rendered in a responsive `<img>` element with `preview-image` styling.
   - **Microsoft Office (`.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`)**: Embedded via Microsoft Office Online embed viewer:
     `https://view.officeapps.live.com/op/embed.aspx?src=<encoded_public_url>`
   - **Other File Types**: Displays a friendly fallback message prompting the user to download the file directly.

---

### 1.3 Administrator Login (`public/login.html`, `public/js/login.js`)

#### Purpose
Authenticates school uploader staff against Supabase Auth.

#### Logic & Access Validation
1. Calls `getAdminStatus()` immediately upon load:
   - If already authenticated as an admin, redirects immediately to `/admin`.
   - If logged in but not present in `admins` table, presents an informative banner:
     *"You are signed in, but uploader access is not enabled for this account yet. In Supabase SQL Editor, run supabase/migrations/006_make_uploader_admin.sql, then sign in again."*
2. Form submission calls `sb.auth.signInWithPassword({ email, password })`.
3. Validates that the logged-in user exists in `public.admins`.
4. On success, transitions user to `/admin`.

---

### 1.4 Administrator Management Dashboard (`public/admin.html`, `public/js/admin.js`)

#### Purpose
Restricted workspace for school staff to publish new memorandums, manage uploaded files, delete archives, and maintain email recipient lists.

#### Main Sections & Controls
1. **Uploader Form (`#upload-form`)**:
   - **File input (`#file`)**: Accepts any file type (PDF, docx, xlsx, etc.).
   - **Memorandum number (`#memo-no`)**: Auto-formatted on save using regex:
     - Inputting `123` or `SM NO. 123` formats to `SM NO. 123 s. <current_year>`.
   - **Title (`#title`)**: Full memorandum subject.
   - **Issue Date (`#date`)**: Defaults to current date.
   - **Upload Button (`#upload-btn`)**: Shows progress spinner / label (`Uploading…`).
   - **Auto-Email Trigger**: On successful upload, immediately triggers `POST /api/send-email` to dispatch notices to all registered recipients.
2. **Published Memorandums Table (`#admin-rows`)**:
   - Lists all uploaded memorandums ordered by date descending.
   - Provides individual "Delete" buttons for each record.
3. **Delete Confirmation Dialog (`#delete-dialog`)**:
   - Uses native HTML `<dialog>` element with backdrop.
   - Shows the specific memorandum number and title before deletion.
   - On confirmation: first removes the file from Supabase Storage (`sb.storage.from('memorandums').remove([file_path])`), then deletes the record from `public.memorandums`.
4. **Email Recipient Manager (`#recipient-rows`)**:
   - **Download Template (`#template-btn`)**: Uses SheetJS (`XLSX`) to generate and download `recipients-template.xlsx` directly in the browser with pre-populated header columns (`Name`, `Email`).
   - **Import Excel File (`#import-file`)**: Reads uploaded `.xlsx` files client-side, extracts valid email addresses and names, deduplicates entries, and batch-upserts them to `public.share_recipients` in chunks of 500 rows.
   - **Delete Individual Recipient (`[data-rid]`)**: Deletes recipient row by ID.
   - **Remove All (`#remove-all-btn`)**: Prompts confirmation before clearing all recipients.
5. **Sign Out (`#logout-btn`)**: Calls `sb.auth.signOut()` and redirects to `/login`.

---

## 2. Shared JavaScript Libraries

### 2.1 `public/js/common.js`
Loaded on every page. Provides foundational helpers:
- **`sb`**: Global Supabase client instance created using `window.APP_CONFIG.SUPABASE_URL` and `window.APP_CONFIG.SUPABASE_ANON_KEY`.
- **`BUCKET = 'memorandums'`**: Constant name of the Supabase storage bucket.
- **`formatDate(d)`**: Converts ISO date strings (`YYYY-MM-DD`) into localized `MM/DD/YYYY` format using UTC date construction to avoid timezone shifting.
- **`esc(str)`**: Sanitizes strings against HTML injection (`&`, `<`, `>`, `"`, `'`).
- **`fileUrl(path)`**: Resolves a storage path to its public CDN URL via `sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl`.
- **`getAdminStatus()`**: Returns `{ status: 'admin' | 'not_admin' | 'signed_out' | 'error', error? }`.
- **`isAdmin()`**: Async helper returning a boolean indicating if current visitor is a confirmed uploader.
- **`setupHeaderLink()`**: Updates the top-right navigation link to "Uploader page" (`/admin`) if the user is already logged in, or "Uploader login" (`/login`) otherwise.

### 2.2 `public/js/icons.js`
Zero-dependency SVG icon system:
- **`SchoolIcons.svg(name, options)`**: Returns inline SVG markup for common UI icons (`file-text`, `trash`, `arrow-up`, `arrow-down`, `arrow-up-down`, `search`, `calendar`, `x`, `check`, `external-link`, etc.).
- **`SchoolIcons.render(container)`**: Scans the provided DOM subtree for elements with `data-icon="name"` and injects corresponding SVGs.

---

## 3. Styling & Design System (`public/css/style.css`)

The application implements a tailored design system reflecting academic elegance and clean institutional identity:

### Design Tokens (CSS Variables)
```css
:root {
  --forest: #214d3b;       /* Primary school emerald green */
  --forest-dark: #193d2e;  /* Deep green for headers & active states */
  --forest-soft: #e8f0e9;  /* Light green tint for badges & highlights */
  --ink: #23332b;          /* Primary dark text */
  --muted: #748078;        /* Subdued text & secondary labels */
  --line: #e6e8df;         /* Borders and dividers */
  --paper: #fffefa;        /* Card & table surface background */
  --canvas: #f5f4ee;       /* Page background tone */
  --clay: #b76a4d;         /* Accent color for focus rings & warnings */
  --shadow: 0 18px 48px rgb(34 49 39 / 7%), 0 2px 6px rgb(34 49 39 / 3%);
}
```

### Key UI Components in CSS
- **Header (`.site-header`)**: Sticky glassmorphism header with `backdrop-filter: blur(14px)`.
- **Buttons (`.btn`, `.btn.primary`, `.btn.danger`, `.btn.ghost`)**: Standardized touch targets (minimum 44px), smooth transition transforms, active states, and focus-visible outlines.
- **Data Tables (`.memo-table`)**: Zebra-striped rows on hover, fixed header alignment, responsive horizontal scroll wrapping on mobile screens.
- **Modals & Dialogs (`dialog`)**: Native modal styling with semi-transparent tinted backdrop (`::backdrop { background: rgb(25 61 46 / 45%); backdrop-filter: blur(4px); }`).
- **Institutional Footer (`.site-footer`, `.footer-card`)**: Responsive multi-column card footer containing official DepEd and Bagong Pilipinas seals alongside the school emblem (`logo.png`), paired with school location, Facebook page, contact number, and official DepEd email address.
- **Responsive Layout**: Fluid breakpoints catering to desktop, tablets, and small mobile displays down to 320px width.
