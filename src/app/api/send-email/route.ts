import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  // Act as the logged-in user so the database rules (RLS) apply
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData.user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { data: admin } = await supabase.from('admins').select('user_id').maybeSingle();
  if (!admin) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const memoId: string = body.memoId;
  const extra: string[] = Array.isArray(body.recipients) ? body.recipients : [];

  const { data: memo } = await supabase.from('memorandums').select('*').eq('id', memoId).maybeSingle();
  if (!memo) return NextResponse.json({ error: 'Memorandum not found.' }, { status: 404 });

  const defaultTo = process.env.MEMO_DEFAULT_RECIPIENT;
  const recipients = Array.from(
    new Set([defaultTo, ...extra].filter((e): e is string => !!e && EMAIL_RE.test(e)))
  );
  if (recipients.length === 0) return NextResponse.json({ error: 'No valid recipient.' }, { status: 400 });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const pageUrl = `${site}/memo/${memo.id}`;
  const fileLink = supabase.storage.from('memorandums').getPublicUrl(memo.file_path).data.publicUrl;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  let sent = 0;
  for (const to of recipients) {
    try {
      await transporter.sendMail({
        from: `"Luis Y. Ferrer Jr. SHS - School Memorandum" <${process.env.GMAIL_USER}>`,
        to,
        subject: `${memo.memo_no} — ${memo.title}`,
        html: `
          <p>A school memorandum has been shared with you.</p>
          <p><strong>${memo.memo_no}</strong><br>${memo.title}<br>${memo.memo_date}</p>
          <p><a href="${pageUrl}">View the memorandum</a><br>
             <a href="${fileLink}">Download the file</a></p>`,
      });
      sent++;
      await supabase.from('share_logs').insert({ memorandum_id: memo.id, recipient_email: to, status: 'sent' });
    } catch (err) {
      await supabase.from('share_logs').insert({
        memorandum_id: memo.id,
        recipient_email: to,
        status: 'failed',
        error_message: String(err).slice(0, 300),
      });
    }
  }

  if (sent === 0) return NextResponse.json({ error: 'Email failed. Check the Gmail settings.' }, { status: 500 });
  return NextResponse.json({ sent });
}