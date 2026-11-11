// Home page: list + search
(async function () {
  const params = new URLSearchParams(location.search);
  // remove characters that would break the filter
  const q = (params.get('q') || '').replace(/[%,()*\\]/g, ' ').trim();
  document.getElementById('search-input').value = q;

  const tbody = document.getElementById('memo-rows');

  let query = sb.from('memorandums').select('*').order('memo_date', { ascending: false });
  if (q) query = query.or(`title.ilike.%${q}%,memo_no.ilike.%${q}%`);
  const { data, error } = await query;

  if (error) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty">Could not load memorandums.</td></tr>';
    return;
  }
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty">No memorandum found.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((m) => `
    <tr>
      <td><a href="/memo/${esc(m.id)}">${esc(m.memo_no)}</a></td>
      <td>${esc(m.title)}</td>
      <td class="date">${formatDate(m.memo_date)}</td>
    </tr>`).join('');
})();
