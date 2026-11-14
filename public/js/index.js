// Home page: list + search
(async function () {
  const params = new URLSearchParams(location.search);
  // remove characters that would break the filter
  const searchInput = document.getElementById('search-input');
  const form = searchInput.form;
  const initialQuery = (params.get('q') || '').replace(/[%,()*\\]/g, ' ').trim();
  searchInput.value = initialQuery;

  const tbody = document.getElementById('memo-rows');

  let latestRequest = 0;
  let debounceTimer;

  async function loadMemorandums(rawQuery) {
    const requestId = ++latestRequest;
    const q = rawQuery.replace(/[%,()*\\]/g, ' ').trim();
    const url = new URL(location.href);
    if (q) url.searchParams.set('q', q);
    else url.searchParams.delete('q');
    history.replaceState(null, '', url);

    tbody.innerHTML = '<tr><td colspan="3" class="empty"><span class="loading-mark"></span>Loading memorandums</td></tr>';

    let query = sb.from('memorandums').select('*').order('memo_date', { ascending: false });
    if (q) query = query.or(`title.ilike.%${q}%,memo_no.ilike.%${q}%`);
    const { data, error } = await query;

    if (requestId !== latestRequest) return;
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
        <td><a href="/memo/${esc(m.id)}">${SchoolIcons.svg('file-text')}<span>${esc(m.memo_no)}</span></a></td>
        <td>${esc(m.title)}</td>
        <td class="date">${formatDate(m.memo_date)}</td>
      </tr>`).join('');
  }

  searchInput.addEventListener('input', () => {
    latestRequest++;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadMemorandums(searchInput.value), 250);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(debounceTimer);
    loadMemorandums(searchInput.value);
  });

  await loadMemorandums(initialQuery);
})();
