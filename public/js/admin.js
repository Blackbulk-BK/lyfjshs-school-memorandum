// Uploader page: upload, list, delete, recipients (Excel import), logout
(async function () {
  const access = await getAdminStatus();
  if (access.status !== 'admin') {
    location.replace(access.status === 'signed_out' ? '/login' : '/login?reason=not-admin');
    return;
  }

  document.getElementById('admin-loading').hidden = true;
  document.getElementById('admin-content').hidden = false;

  // =========================== MEMORANDUMS ===========================
  const rows = document.getElementById('admin-rows');
  const form = document.getElementById('upload-form');
  const btn = document.getElementById('upload-btn');
  const msg = document.getElementById('upload-msg');
  let memos = [];

  async function loadMemos() {
    const { data } = await sb.from('memorandums').select('*').order('memo_date', { ascending: false });
    memos = data || [];
    rows.innerHTML = memos.map((m) => `
      <tr>
        <td><a href="/memo/${esc(m.id)}">${SchoolIcons.svg('file-text')}<span>${esc(m.memo_no)}</span></a></td>
        <td>${esc(m.title)}</td>
        <td class="date">${formatDate(m.memo_date)}</td>
        <td><button class="btn danger" data-id="${esc(m.id)}">${SchoolIcons.svg('trash')}<span>Delete</span></button></td>
      </tr>`).join('') || '<tr><td colspan="4" class="empty">No memorandums published yet.</td></tr>';
  }

  function formatMemoNumber(value) {
    const match = value.trim().match(/^(?:SM\s*NO\.?\s*)?(\d+)(?:\s+s\.\s*\d{4})?$/i);
    return match ? `SM NO. ${match[1]} s. ${new Date().getFullYear()}` : value.trim();
  }

  rows.addEventListener('click', async (e) => {
    const id = e.target.dataset && e.target.dataset.id;
    if (!id) return;
    const memo = memos.find((m) => m.id === id);
    if (!memo || !confirm(`Delete ${memo.memo_no}?`)) return;
    await sb.storage.from(BUCKET).remove([memo.file_path]);
    await sb.from('memorandums').delete().eq('id', id);
    loadMemos();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('file').files[0];
    if (!file) { msg.textContent = 'Please choose a file.'; return; }

    btn.disabled = true;
    const btnLabel = btn.querySelector('.button-label');
    if (btnLabel) btnLabel.textContent = 'Uploading…';
    msg.textContent = '';

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${Date.now()}-${safeName}`;

    try {
      const up = await sb.storage.from(BUCKET).upload(path, file);
      if (up.error) {
        msg.textContent = `Upload failed: ${up.error.message}`;
        return;
      }

      const ins = await sb.from('memorandums').insert({
        memo_no: formatMemoNumber(document.getElementById('memo-no').value),
        title: document.getElementById('title').value.trim(),
        memo_date: document.getElementById('date').value,
        file_path: path,
        file_name: file.name,
        file_type: file.type || null,
        file_size: file.size,
      }).select('id').single();

      if (ins.error) {
        const cleanup = await sb.storage.from(BUCKET).remove([path]);
        if (cleanup.error) console.error('Could not remove file after memo insert failed:', cleanup.error);
        msg.textContent = `Memorandum could not be saved: ${ins.error.message}`;
        return;
      }

      form.reset();
      await loadMemos();
      msg.textContent = 'Memorandum uploaded. Sending it to the saved email recipients…';

      const { data: authData, error: authError } = await sb.auth.getSession();
      if (authError || !authData.session) {
        console.error('Could not get uploader session for email notification:', authError);
        msg.textContent = 'Memorandum uploaded, but email notification could not be sent because your session is unavailable.';
        return;
      }

      let response;
      let result;
      try {
        response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authData.session.access_token}`,
          },
          body: JSON.stringify({ memoId: ins.data.id, includeSavedRecipients: true }),
        });
        result = await response.json();
      } catch (error) {
        console.error('Could not send upload notification:', error);
        msg.textContent = 'Memorandum uploaded, but email notification failed. Check your connection and email server settings.';
        return;
      }

      if (!response.ok) {
        msg.textContent = `Memorandum uploaded, but email notification failed: ${result.error || 'Check the email server settings.'}`;
      } else if (result.failed > 0) {
        msg.textContent = `Memorandum uploaded. Email sent to ${result.sent} of ${result.total} recipients; ${result.failed} failed. Check the email server settings and try sharing again.`;
      } else {
        msg.textContent = `Memorandum uploaded and emailed to ${result.sent} recipient(s).`;
      }
    } catch (error) {
      console.error('Unexpected memorandum upload error:', error);
      msg.textContent = 'An unexpected error occurred while uploading the memorandum.';
    } finally {
      btn.disabled = false;
      if (btnLabel) btnLabel.textContent = 'Upload notice';
    }
  });

  // ======================= EMAIL RECIPIENTS (EXCEL) =======================
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const recRows = document.getElementById('recipient-rows');
  const recMsg = document.getElementById('recipient-msg');
  let recipients = [];

  async function loadRecipients() {
    const { data } = await sb.from('share_recipients').select('*').order('created_at', { ascending: false });
    recipients = data || [];
    document.getElementById('recipient-count').textContent = recipients.length;
    recRows.innerHTML = recipients.length
      ? recipients.map((r) => `
          <tr>
            <td>${esc(r.name || '')}</td>
            <td>${esc(r.email)}</td>
            <td><button class="btn danger" data-rid="${esc(r.id)}">${SchoolIcons.svg('trash')}<span>Remove</span></button></td>
          </tr>`).join('')
      : '<tr><td colspan="3" class="empty">No recipients yet.</td></tr>';
  }

  // Download the Excel template
  document.getElementById('template-btn').addEventListener('click', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Email'],
      ['Juan Dela Cruz', 'juan.delacruz@gmail.com'],
      ['Maria Santos', 'maria.santos@gmail.com'],
    ]);
    ws['!cols'] = [{ wch: 30 }, { wch: 38 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recipients');
    XLSX.writeFile(wb, 'recipients-template.xlsx');
  });

  // Upload the filled template: read every email and save them all
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    recMsg.textContent = 'Reading file…';

    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const table = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      const found = new Map(); // email -> name (removes duplicates inside the file)
      let skipped = 0;

      table.forEach((row, index) => {
        const cells = row.map((c) => String(c).trim());
        if (!cells.some((c) => c)) return; // empty row

        const email = cells.find((c) => EMAIL_RE.test(c));
        if (!email) {
          const isHeader = index === 0 && cells.some((c) => /e-?mail|gmail/i.test(c));
          if (!isHeader) skipped++;
          return;
        }
        const name = cells.find((c) => c && c !== email && !c.includes('@')) || null;
        const key = email.toLowerCase();
        if (!found.has(key)) found.set(key, name);
      });

      if (found.size === 0) {
        recMsg.textContent = 'No valid email found. Please use the template.';
        return;
      }

      const list = Array.from(found, ([email, name]) => ({ email, name }));
      let added = 0;
      for (let i = 0; i < list.length; i += 500) {
        const { data, error } = await sb
          .from('share_recipients')
          .upsert(list.slice(i, i + 500), { onConflict: 'email', ignoreDuplicates: true })
          .select();
        if (error) { recMsg.textContent = error.message; return; }
        added += data.length;
      }

      recMsg.textContent =
        `Found ${list.length} email(s): ${added} added, ${list.length - added} already in the list` +
        (skipped ? `, ${skipped} row(s) skipped (no valid email).` : '.');
      loadRecipients();
    } catch (err) {
      recMsg.textContent = 'Could not read that file. Please use the Excel template.';
    } finally {
      e.target.value = ''; // allows uploading the same file again
    }
  });

  recRows.addEventListener('click', async (e) => {
    const id = e.target.dataset && e.target.dataset.rid;
    if (!id) return;
    await sb.from('share_recipients').delete().eq('id', id);
    loadRecipients();
  });

  document.getElementById('remove-all-btn').addEventListener('click', async () => {
    if (!recipients.length || !confirm(`Remove all ${recipients.length} recipients?`)) return;
    await sb.from('share_recipients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    recMsg.textContent = 'All recipients removed.';
    loadRecipients();
  });

  // ============================== LOGOUT ==============================
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await sb.auth.signOut();
    location.replace('/login');
  });

  loadMemos();
  loadRecipients();
})();
