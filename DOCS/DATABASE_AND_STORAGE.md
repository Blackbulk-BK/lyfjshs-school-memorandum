# Database & Storage Guide

This document covers the complete Supabase PostgreSQL database architecture, table definitions, indexing strategies, functions, triggers, Row-Level Security (RLS) policies, and object storage configurations.

---

## 1. Database Architecture Overview

The system uses a hosted PostgreSQL 15+ database managed via Supabase. The database is strictly secured via PostgreSQL Row Level Security (RLS), ensuring that even though the anonymous public key (`SUPABASE_ANON_KEY`) is exposed in client-side JavaScript, unauthenticated or unauthorized users cannot perform write, update, or delete operations.

---

## 2. PostgreSQL Extensions & Custom Functions

### 2.1 Trigram Matching Extension (`pg_trgm`)
```sql
create extension if not exists pg_trgm with schema extensions;
```
Enables GIN trigram indexes for high-speed, typo-tolerant, partial substring searching on memorandum titles and memorandum numbers.

### 2.2 Administrator Verification Function (`is_admin()`)
```sql
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;
```
- **Execution Mode**: `security definer` runs with function owner privileges to safely inspect the `admins` table.
- **Search Path**: Explicitly fixed to `public` to prevent search path hijacking.
- **Purpose**: Reusable boolean check used across all RLS policies to verify if the currently authenticated session belongs to a valid administrator.

### 2.3 Automated Timestamp Trigger (`set_updated_at()`)
```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```
Automatically updates the `updated_at` column whenever a row in `public.memorandums` is modified.

---

## 3. Data Dictionary (Tables)

### 3.1 `public.admins`
Stores authorized administrator user IDs.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | `uuid` | `PRIMARY KEY`, `REFERENCES auth.users(id) ON DELETE CASCADE` | The Supabase Auth user ID. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Timestamp when admin privileges were granted. |

### 3.2 `public.memorandums`
Core repository of published memorandums.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique memorandum record identifier. |
| `memo_no` | `text` | `NOT NULL UNIQUE` | Official number (e.g. `SM NO. 001 s. 2026`). |
| `title` | `text` | `NOT NULL` | Full title / subject matter of the memorandum. |
| `memo_date` | `date` | `NOT NULL` | Calendar date on which the memorandum was issued. |
| `file_path` | `text` | `NOT NULL` | Storage object key path within the `memorandums` bucket. |
| `file_name` | `text` | `NOT NULL` | Original uploaded filename (e.g. `Memo_Schedule.pdf`). |
| `file_type` | `text` | `NULL` | MIME type (e.g. `application/pdf`). |
| `file_size` | `bigint` | `NULL` | File size in bytes. |
| `created_by` | `uuid` | `REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid()` | ID of the uploader who created the record. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Upload timestamp. |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Last modified timestamp. |

#### Indexes
- `memorandums_date_idx` on `(memo_date desc, created_at desc)`: Optimizes public directory default sorting.
- `memorandums_title_trgm_idx` using `GIN (title extensions.gin_trgm_ops)`: Accelerated text search on title.
- `memorandums_memo_no_trgm_idx` using `GIN (memo_no extensions.gin_trgm_ops)`: Accelerated text search on memo number.

### 3.3 `public.share_recipients`
Saved staff and faculty contact roster for automated email broadcasts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique recipient record identifier. |
| `name` | `text` | `NULL` | Recipient full name (e.g. `Juan Dela Cruz`). |
| `email` | `text` | `NOT NULL UNIQUE` | Email address (sanitized and normalized). |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Timestamp added. |

### 3.4 `public.share_logs`
Historical audit trail of all email sharing transactions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique log record identifier. |
| `memorandum_id` | `uuid` | `NOT NULL REFERENCES public.memorandums(id) ON DELETE CASCADE` | Associated memorandum ID. |
| `recipient_email` | `text` | `NOT NULL` | Recipient email address. |
| `status` | `text` | `NOT NULL CHECK (status IN ('sent', 'failed'))` | Delivery status outcome. |
| `error_message` | `text` | `NULL` | Truncated error diagnostic message (if failed). |
| `sent_by` | `uuid` | `REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid()` | Uploader who initiated dispatch. |
| `sent_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Timestamp of dispatch attempt. |

#### Indexes
- `share_logs_memo_idx` on `(memorandum_id, sent_at desc)`: Quick lookup of sharing history per memorandum.

---

## 4. Row Level Security (RLS) Policy Matrix

| Table | Operation | Target Role | Policy Rule (`USING` / `WITH CHECK`) | Purpose |
|---|---|---|---|---|
| `admins` | `SELECT` | `authenticated` | `user_id = auth.uid()` | Allows admin user to verify their own membership; hides other admins. |
| `memorandums` | `SELECT` | `anon, authenticated` | `true` | Public read access for the student & teacher directory. |
| `memorandums` | `INSERT` | `authenticated` | `(select public.is_admin())` | Only confirmed admins can upload memorandums. |
| `memorandums` | `UPDATE` | `authenticated` | `(select public.is_admin())` | Only confirmed admins can edit memorandums. |
| `memorandums` | `DELETE` | `authenticated` | `(select public.is_admin())` | Only confirmed admins can delete memorandums. |
| `share_recipients` | `ALL` | `authenticated` | `(select public.is_admin())` | Full CRUD restricted solely to administrators. |
| `share_logs` | `ALL` | `authenticated` | `(select public.is_admin())` | Audit log creation and review restricted to admins. |

---

## 5. Storage Bucket Configuration (`memorandums`)

The storage bucket is configured directly in PostgreSQL using Supabase's `storage.buckets` and `storage.objects` schema:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memorandums',
  'memorandums',
  true,          -- Public bucket: files are directly accessible via CDN URLs
  52428800,      -- 50 MB per file limit (Supabase free tier max)
  null           -- Allows any file type (PDF, docx, xlsx, pptx, images)
)
on conflict (id) do nothing;
```

### Storage Object Policies (`storage.objects`)

- **Public Download / View (`SELECT`)**:
  ```sql
  create policy "Anyone can read memorandum files"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'memorandums');
  ```
- **Admin Upload (`INSERT`)**:
  ```sql
  create policy "Admin can upload memorandum files"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'memorandums' and (select public.is_admin()));
  ```
- **Admin Update (`UPDATE`)**:
  ```sql
  create policy "Admin can update memorandum files"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'memorandums' and (select public.is_admin()))
    with check (bucket_id = 'memorandums' and (select public.is_admin()));
  ```
- **Admin Deletion (`DELETE`)**:
  ```sql
  create policy "Admin can delete memorandum files"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'memorandums' and (select public.is_admin()));
  ```

---

## 6. Migration History Breakdown

The project provides both a consolidated master setup script ([`supabase/schema.sql`](../supabase/schema.sql)) and discrete, step-by-step migrations in [`supabase/migrations/`](../supabase/migrations/):

1. **`001_extensions_and_admins.sql`**: Enables `pg_trgm`, creates `public.admins`, and defines `is_admin()`.
2. **`002_memorandums.sql`**: Creates `public.memorandums`, sets up trigram indexes, and attaches `set_updated_at()` trigger.
3. **`003_sharing_tables.sql`**: Creates `public.share_recipients` and `public.share_logs`.
4. **`004_row_level_security.sql`**: Enables RLS on all tables and creates authorization policies.
5. **`005_storage_bucket.sql`**: Configures the 50MB `memorandums` bucket and applies RLS policies on `storage.objects`.
6. **`006_make_uploader_admin.sql`**: Queries `auth.users` for `lyfjshsmemorandum@gmail.com` and inserts the user ID into `public.admins`.
