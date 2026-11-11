// POST /api/send-email : emails a memorandum (only the logged-in uploader).
const nodemailer = require('nodemailer');
const { EMAIL_RE, getSupabase, esc, siteUrl } = require('../lib/shared');

const BATCH_SIZE = 50; // recipients per email (hidden with BCC)

function buildTransporter() {
  // Option A: Brevo (or any SMTP service) when SMTP_HOST is set
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  // Option B: Gmail with an App Password
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return null;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

    const token = String(req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not logged in.' });

    const userDb = getSupabase(token);

    const { data: userData } = await userDb.auth.getUser(token);
    if (!userData || !userData.user) return res.status(401).json({ error: 'Not logged in.' });

    const { data: admin } = await userDb.from('admins').select('user_id').maybeSingle();
    if (!admin) return res.status(403).json({ error: 'Not allowed.' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    const memoId = body.memoId;
    let extraRaw = Array.isArray(body.recipients) ? body.recipients : [];

    if (body.includeSavedRecipients === true) {
      const { data: savedRecipients, error } = await userDb
        .from('share_recipients')
        .select('email');
      if (error) {
        console.error('Could not load saved email recipients:', error);
        return res.status(500).json({ error: 'Could not load the saved email recipients.' });
      }
      extraRaw = extraRaw.concat((savedRecipients || []).map((recipient) => recipient.email));
    }

    const { data: memo } = await userDb.from('memorandums').select('*').eq('id', memoId).maybeSingle();
    if (!memo) return res.status(404).json({ error: 'Memorandum not found.' });

    const transporter = buildTransporter();
    if (!transporter) return res.status(500).json({ error: 'Email sending is not set up on the server.' });

    const fromAddress = process.env.MAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER;

    // The built-in email ALWAYS receives it
    const defaultTo = String(process.env.MEMO_DEFAULT_RECIPIENT || fromAddress || '').trim();
    if (!EMAIL_RE.test(defaultTo)) {
      return res.status(500).json({ error: 'MEMO_DEFAULT_RECIPIENT is not set correctly.' });
    }

    const maxRecipients = Number(process.env.MAX_RECIPIENTS || 290); // Brevo free: 300 per day
    const extra = Array.from(new Set(
      extraRaw.map((e) => String(e).trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))
    )).filter((e) => e !== defaultTo.toLowerCase());

    if (extra.length > maxRecipients) {
      return res.status(400).json({ error: `Too many recipients at once (max ${maxRecipients}).` });
    }

    const pageUrl = `${siteUrl(req)}/memo/${memo.id}`;
    const fileLink = userDb.storage.from('memorandums').getPublicUrl(memo.file_path).data.publicUrl;

    const subject = `${memo.memo_no} — ${memo.title}`;
    const html = `
      <p>A school memorandum has been shared with you.</p>
      <p><strong>${esc(memo.memo_no)}</strong><br>${esc(memo.title)}<br>${esc(memo.memo_date)}</p>
      <p><a href="${esc(pageUrl)}">View the memorandum</a><br>
         <a href="${esc(fileLink)}">Download the file</a></p>`;

    // The built-in email is in "to" of the first message,
    // everybody else is in BCC so they cannot see each other's emails.
    const groups = [];
    for (let i = 0; i < extra.length; i += BATCH_SIZE) groups.push(extra.slice(i, i + BATCH_SIZE));
    if (groups.length === 0) groups.push([]);

    let sent = 0;
    let failed = 0;
    for (let g = 0; g < groups.length; g++) {
      const bcc = groups[g];
      const first = g === 0;
      const emailed = first ? [defaultTo, ...bcc] : bcc;

      try {
        await transporter.sendMail({
          from: `"Luis Y. Ferrer Jr. SHS - School Memorandum" <${fromAddress}>`,
          to: first ? defaultTo : fromAddress,
          bcc: bcc.length ? bcc : undefined,
          subject,
          html,
        });
        sent += emailed.length;
        await userDb.from('share_logs').insert(
          emailed.map((email) => ({ memorandum_id: memo.id, recipient_email: email, status: 'sent' }))
        );
      } catch (err) {
        console.error('Could not send memorandum email batch:', err);
        failed += emailed.length;
        const { error: logError } = await userDb.from('share_logs').insert(
          emailed.map((email) => ({
            memorandum_id: memo.id,
            recipient_email: email,
            status: 'failed',
            error_message: String(err).slice(0, 300),
          }))
        );
        if (logError) console.error('Could not record failed email batch:', logError);
      }
    }

    const total = sent + failed;
    if (sent === 0) {
      return res.status(502).json({
        error: 'Email delivery failed. Check the SMTP or Gmail settings.',
        sent,
        failed,
        total,
      });
    }
    return res.status(200).json({ sent, failed, total });
  } catch (err) {
    console.error('Unexpected email notification error:', err);
    return res.status(500).json({ error: 'Something went wrong while sending.' });
  }
};
