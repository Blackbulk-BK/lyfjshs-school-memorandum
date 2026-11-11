// Memo page: details, file preview, Facebook share, (uploader) email share
(async function () {
  const id = location.pathname.split('/').filter(Boolean).pop();

  const { data: memo } = await sb.from('memorandums').select('*').eq('id', id).maybeSingle();
  if (!memo) {
    document.getElementById('memo-missing').hidden = false;
    return;
  }

  const url = fileUrl(memo.file_path);

  document.getElementById('memo-no').textContent = memo.memo_no;
  document.getElementById('memo-title').textContent = memo.title;
  document.getElementById('memo-date').textContent = formatDate(memo.memo_date);

  const dl = document.getElementById('download-btn');
  dl.href = url;
  dl.setAttribute('download', memo.file_name);

  document.getElementById('preview').innerHTML = buildPreview(url, memo.file_name, memo.file_type);
  if (window.SchoolIcons) window.SchoolIcons.render(document.getElementById('memo-content'));
  document.getElementById('memo-content').hidden = false;

  // ---------- Facebook + copy link ----------
  document.getElementById('fb-btn').addEventListener('click', () => {
    window.open(
      'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(location.href),
      'fb-share',
      'width=600,height=500'
    );
  });

  const copyBtn = document.getElementById('copy-btn');
  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(location.href);
    const label = copyBtn.querySelector('span');
    if (label) label.textContent = 'Link copied';
    setTimeout(() => {
      if (label) label.textContent = 'Copy link';
    }, 2000);
  });

  setupEmailShare(memo.id);

  // ---------- File preview ----------
  // PDF / image -> shown directly. Word / Excel / PowerPoint -> Microsoft viewer.
  function buildPreview(fileLink, name, type) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const isPdf = type === 'application/pdf' || ext === 'pdf';
    const isImage = (type || '').startsWith('image/');
    const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);

    if (isPdf) return `<iframe class="preview" src="${esc(fileLink)}" title="${esc(name)}"></iframe>`;
    if (isImage) return `<img class="preview-image" src="${esc(fileLink)}" alt="${esc(name)}">`;
    if (isOffice) {
      const viewer = 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(fileLink);
      return `<iframe class="preview" src="${esc(viewer)}" title="${esc(name)}"></iframe>`;
    }
    return '<p>No preview available for this file type. Please download it to view.</p>';
  }

  // ---------- Email share (uploader only) ----------
  async function setupEmailShare(memoId) {
    if (!(await isAdmin())) return;

    document.getElementById('email-card').hidden = false;
    const list = document.getElementById('recipient-list');
    const msg = document.getElementById('email-msg');
    const sendBtn = document.getElementById('send-email-btn');
    const countLabel = document.getElementById('selected-count');
    const selected = new Set();
    let current = [];

    function updateCount() {
      countLabel.textContent = `${selected.size} of ${current.length} selected`;
    }

    function render() {
      list.innerHTML = '';

      current.forEach((r) => {
        const row = document.createElement('div');
        row.className = 'recipient';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selected.has(r.email);
        cb.addEventListener('change', () => {
          if (cb.checked) selected.add(r.email); else selected.delete(r.email);
          updateCount();
        });

        const label = document.createElement('span');
        label.textContent = (r.name ? r.name + ' — ' : '') + r.email;

        const del = document.createElement('button');
        del.className = 'btn danger';
        del.textContent = 'Remove';
        del.addEventListener('click', async () => {
          await sb.from('share_recipients').delete().eq('id', r.id);
          selected.delete(r.email);
          loadRecipients();
        });

        row.append(cb, label, del);
        list.append(row);
      });

      updateCount();
    }

    async function loadRecipients() {
      const { data } = await sb.from('share_recipients').select('*').order('created_at', { ascending: false });
      current = data || [];
      render();
    }

    document.getElementById('select-all-btn').addEventListener('click', () => {
      current.forEach((r) => selected.add(r.email));
      render();
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
      selected.clear();
      render();
    });

    document.getElementById('add-recipient-btn').addEventListener('click', async () => {
      msg.textContent = '';
      const nameInput = document.getElementById('new-name');
      const emailInput = document.getElementById('new-email');
      const email = emailInput.value.trim().toLowerCase();
      if (!email) return;

      const { error } = await sb.from('share_recipients').insert({
        name: nameInput.value.trim() || null,
        email,
      });
      if (error) { msg.textContent = error.message; return; }

      nameInput.value = '';
      emailInput.value = '';
      loadRecipients();
    });

    sendBtn.addEventListener('click', async () => {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';
      msg.textContent = '';

      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (session ? session.access_token : ''),
        },
        body: JSON.stringify({ memoId, recipients: Array.from(selected) }),
      });
      const json = await res.json().catch(() => ({}));

      sendBtn.disabled = false;
      sendBtn.textContent = 'Send email';
      msg.textContent = res.ok ? `Sent to ${json.sent} email(s).` : json.error || 'Failed to send.';
    });

    loadRecipients();
  }
})();
