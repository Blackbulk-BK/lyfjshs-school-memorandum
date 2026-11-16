# Email System & Distribution

This document details the architecture, configuration, batching mechanics, security protocols, HTML templates, and recipient management for the automated memorandum notification system.

---

## 1. System Overview

When an administrator uploads a new school memorandum (or triggers a manual re-share), the platform can automatically broadcast email notifications to the school faculty and staff.

```
+-----------------------------------------------------------+
|                   Admin Interface (/admin)                |
|  - Uploads memorandum                                     |
|  - Triggers POST /api/send-email                          |
+-----------------------------+-----------------------------+
                              | (Bearer Token)
                              v
+-----------------------------------------------------------+
|               Node.js Engine (/api/send-email)            |
|  1. Authenticates JWT with Supabase                       |
|  2. Fetches recipients from public.share_recipients       |
|  3. Deduplicates & validates email addresses              |
|  4. Partitions recipients into batches of 50              |
+-----------------------------+-----------------------------+
                              |
               +--------------+--------------+
               |                             |
      (Brevo SMTP Relay)            (Gmail App Password)
               v                             v
+-----------------------------+-----------------------------+
|    Nodemailer Transporter   |    Nodemailer Transporter   |
|   smtp-relay.brevo.com:587  |      smtp.gmail.com:465     |
+-----------------------------+-----------------------------+
                              |
                              v
        +-------------------------------------------+
        |                Recipients                 |
        |  - Primary TO: School Default Address     |
        |  - Recipients: BCC (Privacy Protected)    |
        |  - Embedded CID: School Logo PNG          |
        +-------------------------------------------+
```

---

## 2. SMTP Provider Configuration

The notification engine supports two primary transport options configured through environment variables:

### Option A: Brevo (Recommended for Production)
Brevo provides reliable transactional SMTP delivery with a free tier of 300 emails per day.

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-smtp-login
SMTP_PASS=your-generated-smtp-master-key
MAIL_FROM=lyfjshsmemorandum@gmail.com
```

*Note: For Brevo, `SMTP_PASS` must be the generated SMTP Key, not the Brevo account login password.*

### Option B: Gmail with App Password (Alternative / Development)
Utilizes Google's SMTP servers authenticated with a 16-character Google App Password.

```env
GMAIL_USER=lyfjshsmemorandum@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
MAIL_FROM=lyfjshsmemorandum@gmail.com
```

---

## 3. Privacy, Quotas & Batching Mechanics

### 3.1 BCC Privacy Safeguard
To comply with data privacy policies and prevent exposure of faculty and staff email addresses to external viewers:
- The `To:` field is set exclusively to the designated administrative recipient (`MEMO_DEFAULT_RECIPIENT` or `MAIL_FROM`).
- All faculty recipients are appended to the `Bcc:` (Blind Carbon Copy) header. No recipient can see other recipients' email addresses or names.

### 3.2 Batch Chunking (`BATCH_SIZE = 50`)
SMTP servers (including Brevo and Gmail) impose strict caps on the maximum number of recipients per individual SMTP transaction.
- The system splits recipient lists into slices of 50:
  ```javascript
  const BATCH_SIZE = 50;
  for (let i = 0; i < extra.length; i += BATCH_SIZE) {
    groups.push(extra.slice(i, i + BATCH_SIZE));
  }
  ```
- Each batch is transmitted as an independent SMTP session, preventing connection drops and recipient overflow errors.

### 3.3 Daily Quota Cap (`MAX_RECIPIENTS = 290`)
Brevo's free tier permits 300 emails per 24 hours. The application enforces a default safety limit of 290 recipients per blast (`process.env.MAX_RECIPIENTS || 290`), reserving sufficient quota for administrative test emails and retry attempts.

---

## 4. Recipient Management & Excel Integration

Administrators manage recipients without database queries using client-side Excel tools built into `/admin`.

### 4.1 Excel Template Format
Admins can click **"Download Excel template"** to generate `recipients-template.xlsx` using SheetJS:

| Name | Email |
|---|---|
| Juan Dela Cruz | juan.delacruz@gmail.com |
| Maria Santos | maria.santos@gmail.com |

### 4.2 Client-Side Parsing & Sanitization (`public/js/admin.js`)
When an administrator uploads a spreadsheet:
1. SheetJS reads the workbook as an array buffer.
2. The script extracts cell values row-by-row.
3. It identifies email cells by matching against `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
4. It extracts associated names from non-email columns in the same row.
5. All emails are lowercased and deduplicated inside a JavaScript `Map`.
6. Batches of 500 rows are upserted into `public.share_recipients` with `onConflict: 'email', ignoreDuplicates: true`.

---

## 5. Email Template & Visual Design

The generated notification email follows high-compatibility HTML email best practices (table-based layout, inline styling, cross-client tested in Gmail, Outlook, Apple Mail, and Yahoo).

### 5.1 Inline CID Attachment (School Logo)
To avoid broken remote images or blocked image warnings, the school logo is embedded directly into the MIME message body as an inline Content-ID attachment:
```javascript
attachments: [{
  filename: 'logo.png',
  content: fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png')),
  contentType: 'image/png',
  cid: 'school-logo',
  contentDisposition: 'inline',
}]
```
Inside the HTML body, the image is rendered with `<img src="cid:school-logo" width="64" alt="School logo">`.

### 5.2 Responsive Structure
- **Preheader text**: Hidden zero-size span preventing unwanted email client snippet leaks.
- **Header**: Deep emerald banner (`#214d3b`) displaying the school emblem and institution title.
- **Body Card**: Clean white card on light background (`#f4f6f4`) containing:
  - Memo number badge (`SM NO. 001 s. 2026`).
  - Large memorandum headline.
  - Date issued.
  - Distinct call-to-action button linking directly to the online viewer (`/memo/:id`).
  - Secondary direct download link to the file.
- **Footer**: Institutional footer with school details.
- **Plain-Text Alternative**: Complete text summary included for screen readers and text-only mail clients.

---

## 6. Audit Logging & Diagnostic Error Handling

Every delivery attempt is tracked in `public.share_logs`:

```json
{
  "memorandum_id": "97b3708d-8a5b-4375-a0cf-84091ca275c1",
  "recipient_email": "teacher@school.edu.ph",
  "status": "sent",
  "error_message": null,
  "sent_by": "0f62b8aa-639a-4122-b2a1-cf8d97010a30",
  "sent_at": "2026-11-16T14:24:00Z"
}
```

### Error Diagnostic Parser (`getDeliveryError`)
When Nodemailer encounters an exception, the handler maps low-level SMTP status codes to human-readable troubleshooting guidance:

| Condition / Code | User-Facing Explanation |
|---|---|
| `err.code === 'EAUTH'` or `534` / `535` | *"SMTP authentication failed. Check SMTP_USER and SMTP_PASS; for Brevo, use the SMTP key as SMTP_PASS."* |
| `550` or `553` | *"The SMTP server rejected the sender. Check that MAIL_FROM is a verified sender address."* |
| `ECONNECTION` / `ETIMEDOUT` / `ESOCKET` | *"Could not connect to the SMTP server. Check SMTP_HOST and SMTP_PORT."* |
| Other failures | *"Email delivery failed. Check the SMTP or Gmail settings."* |
