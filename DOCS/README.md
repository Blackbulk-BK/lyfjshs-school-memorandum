# Luis Y. Ferrer Jr. Senior High School — School Memorandum Documentation

Welcome to the comprehensive technical and operational documentation for the **Luis Y. Ferrer Jr. Senior High School (LYFJSHS) School Memorandum** platform.

This documentation covers every component, architectural decision, interface, database schema, serverless API endpoint, security policy, and operational workflow of the platform.

---

## Documentation Index

| Document | Description |
|---|---|
| [**1. Architecture & Tech Stack**](ARCHITECTURE.md) | High-level system design, architectural patterns, component topology, complete technology stack, data flow diagrams, and directory tree. |
| [**2. Frontend Guide**](FRONTEND.md) | Deep dive into client-side architecture: pages (`index.html`, `memo.html`, `login.html`, `admin.html`), scripts (`index.js`, `memo.js`, `admin.js`, `login.js`, `common.js`, `icons.js`), CSS design system, state handling, and file previews. |
| [**3. Backend & API Reference**](BACKEND_API.md) | Comprehensive specification of all backend endpoints (`/api/config`, `/api/memo`, `/api/send-email`), serverless functions, shared helpers (`lib/shared.js`), local Express development runner (`local-server.js`), and routing config (`vercel.json`). |
| [**4. Database & Storage Guide**](DATABASE_AND_STORAGE.md) | Supabase PostgreSQL schema, data dictionary, Row Level Security (RLS) policies, triggers, trigram search indexing (`pg_trgm`), storage bucket permissions, and migration history. |
| [**5. Email System & Distribution**](EMAIL_SYSTEM.md) | Specification of the automated notification engine: Nodemailer integration, Brevo / Gmail SMTP dispatch, batching, BCC privacy safeguards, HTML email templates, inline CID attachments, and Excel recipient import. |
| [**6. Deployment & Operations**](DEPLOYMENT_AND_OPERATIONS.md) | Step-by-step setup instructions for local development, Vercel deployment, Supabase cloud configuration, environment variables specification, backup strategies, and comprehensive troubleshooting guide. |

---

## System Quick Reference

- **Repository**: `Blackbulk-BK/lyfjshs-school-memorandum`
- **Application Type**: Serverless Web Application (JAMstack + Edge/Node Functions)
- **Primary Public URL**: `https://lyfjshs-school-memorandum.vercel.app` (or custom domain)
- **Local Dev Server**: `http://localhost:3000` via `npm start`
- **Minimum Node Version**: Node.js `>= 20.0.0`
- **Key External Services**:
  - [Supabase](https://supabase.com): Database (PostgreSQL), Authentication, Object Storage.
  - [Brevo (formerly Sendinblue)](https://www.brevo.com): Transactional SMTP email delivery.
  - [Vercel](https://vercel.com): Global Edge CDN & Serverless Function hosting.
  - [Microsoft Office Apps Live](https://view.officeapps.live.com): Office document viewer embedding.
