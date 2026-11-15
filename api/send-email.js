// POST /api/send-email : emails a memorandum (only the logged-in uploader).
const nodemailer = require('nodemailer');
const { EMAIL_RE, getSupabase, esc, siteUrl } = require('../lib/shared');

const BATCH_SIZE = 50; // recipients per email (hidden with BCC)

function buildTransporter() {
  // Option A: Brevo (or any SMTP service) when SMTP_HOST is set
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('SMTP_PORT must be a valid port number.');
    }
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP_USER and SMTP_PASS are required when SMTP_HOST is set. For Brevo, SMTP_PASS must be your SMTP key.');
    }
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
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

function getDeliveryError(err) {
  const responseCode = Number(err && err.responseCode);
  if ((err && err.code === 'EAUTH') || responseCode === 534 || responseCode === 535) {
    return 'SMTP authentication failed. Check SMTP_USER and SMTP_PASS; for Brevo, use the SMTP key as SMTP_PASS.';
  }
  if (responseCode === 550 || responseCode === 553) {
    return 'The SMTP server rejected the sender. Check that MAIL_FROM is a verified sender address.';
  }
  if (err && ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET'].includes(err.code)) {
    return 'Could not connect to the SMTP server. Check SMTP_HOST and SMTP_PORT.';
  }
  return 'Email delivery failed. Check the SMTP or Gmail settings.';
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

    let transporter;
    try {
      transporter = buildTransporter();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
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
    const preheader = `${memo.memo_no}: ${memo.title}. Open the school memorandum and download the file.`;
    const html = `
      <div style="display:none;font-size:1px;color:#f4f6f4;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
        ${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f4;margin:0;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;color:#26332d;">
        <tr><td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e4e9e5;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:#214d3b;padding:24px 32px;">
                <p style="margin:0;color:#dce9df;font-size:11px;line-height:16px;letter-spacing:1.5px;text-transform:uppercase;">Luis Y. Ferrer Jr. Senior High School</p>
                <p style="margin:5px 0 0;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:28px;">School Memorandum</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 20px;color:#526158;font-size:15px;line-height:24px;">A new memorandum has been shared with you.</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f9f7;border-left:4px solid #4d8064;">
                  <tr><td style="padding:20px 22px;">
                    <p style="margin:0 0 8px;color:#477257;font-size:12px;font-weight:bold;line-height:18px;letter-spacing:1px;text-transform:uppercase;">${esc(memo.memo_no)}</p>
                    <h1 style="margin:0 0 12px;color:#24372c;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:normal;line-height:30px;">${esc(memo.title)}</h1>
                    <p style="margin:0;color:#657168;font-size:14px;line-height:21px;">Issued ${esc(memo.memo_date)}</p>
                  </td></tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                  <tr><td align="center" style="background-color:#214d3b;border-radius:6px;">
                    <a href="${esc(pageUrl)}" style="display:inline-block;padding:13px 20px;color:#ffffff;font-size:14px;font-weight:bold;line-height:20px;text-decoration:none;">View memorandum</a>
                  </td></tr>
                </table>
                <p style="margin:20px 0 0;color:#657168;font-size:14px;line-height:22px;">
                  Or <a href="${esc(fileLink)}" style="color:#285f43;text-decoration:underline;">download the memorandum file</a>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e8ece9;padding:18px 32px;">
                <p style="margin:0;color:#879189;font-size:12px;line-height:18px;">Luis Y. Ferrer Jr. Senior High School<br>School Memorandum Archive</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>`;
    const text = [
      'A new school memorandum has been shared with you.',
      '',
      memo.memo_no,
      memo.title,
      `Issued ${memo.memo_date}`,
      '',
      `View memorandum: ${pageUrl}`,
      `Download the memorandum file: ${fileLink}`,
      '',
      'Luis Y. Ferrer Jr. Senior High School — School Memorandum Archive',
    ].join('\n');

    // The built-in email is in "to" of the first message,
    // everybody else is in BCC so they cannot see each other's emails.
    const groups = [];
    for (let i = 0; i < extra.length; i += BATCH_SIZE) groups.push(extra.slice(i, i + BATCH_SIZE));
    if (groups.length === 0) groups.push([]);

    let sent = 0;
    let failed = 0;
    let deliveryError;
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
          text,
        });
        sent += emailed.length;
        await userDb.from('share_logs').insert(
          emailed.map((email) => ({ memorandum_id: memo.id, recipient_email: email, status: 'sent' }))
        );
      } catch (err) {
        console.error('Could not send memorandum email batch:', err);
        deliveryError = deliveryError || getDeliveryError(err);
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
        error: deliveryError || 'Email delivery failed. Check the SMTP or Gmail settings.',
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
