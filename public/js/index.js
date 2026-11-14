// Home page: list + search
(async function () {
  const params = new URLSearchParams(location.search);
  // remove characters that would break the filter
  const searchInput = document.getElementById('search-input');
  const form = searchInput.form;
  const sortButtons = Array.from(document.querySelectorAll('[data-sort-field]'));
  const initialQuery = (params.get('q') || '').replace(/[%,()*\\]/g, ' ').trim();
  const validFields = ['date', 'number', 'title'];
  const [initialField, initialDirection] = (params.get('sort') || 'date-desc').split('-');
  const sort = {
    field: validFields.includes(initialField) ? initialField : 'date',
    direction: initialDirection === 'asc' ? 'asc' : 'desc',
  };
  searchInput.value = initialQuery;

  const tbody = document.getElementById('memo-rows');
  const headers = Array.from(document.querySelectorAll('thead th'));

  let latestRequest = 0;
  let debounceTimer;

  function updateSortButtons() {
    sortButtons.forEach((button) => {
      const field = button.dataset.sortField;
      const active = field === sort.field;
      const direction = active ? sort.direction : null;
      const indicator = button.querySelector('.sort-indicator');
      const heading = field === 'date' ? 'date issued' : field === 'number' ? 'memorandum number' : 'title';
      const directionLabels = {
        date: { asc: 'oldest first', desc: 'newest first' },
        number: { asc: 'low to high', desc: 'high to low' },
        title: { asc: 'A to Z', desc: 'Z to A' },
      };

      button.classList.toggle('is-sorted', active);
      button.setAttribute('aria-label', active
        ? `Sort by ${heading}; currently ${directionLabels[field][direction]}. Click to reverse the order.`
        : `Sort by ${heading}.`);
      indicator.innerHTML = SchoolIcons.svg(
        direction ? (direction === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down'
      );
    });

    headers.forEach((header) => {
      const button = header.querySelector('[data-sort-field]');
      if (!button) return;
      header.setAttribute(
        'aria-sort',
        button.dataset.sortField === sort.field
          ? (sort.direction === 'asc' ? 'ascending' : 'descending')
          : 'none'
      );
    });
  }

  async function loadMemorandums(rawQuery) {
    const requestId = ++latestRequest;
    const q = rawQuery.replace(/[%,()*\\]/g, ' ').trim();
    const url = new URL(location.href);
    if (q) url.searchParams.set('q', q);
    else url.searchParams.delete('q');
    url.searchParams.set('sort', `${sort.field}-${sort.direction}`);
    history.replaceState(null, '', url);

    tbody.innerHTML = '<tr><td colspan="3" class="empty"><span class="loading-mark"></span>Loading memorandums</td></tr>';

    let query = sb.from('memorandums').select('*');
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

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const sorted = [...data].sort((a, b) => {
      let comparison;
      if (sort.field === 'date') {
        comparison = String(a.memo_date || '').localeCompare(String(b.memo_date || ''));
      } else if (sort.field === 'title') {
        comparison = collator.compare(a.title || '', b.title || '');
      } else {
        comparison = collator.compare(a.memo_no || '', b.memo_no || '');
      }
      return sort.direction === 'asc' ? comparison : -comparison;
    });

    tbody.innerHTML = sorted.map((m) => `
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

  sortButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.dataset.sortField;
      if (field === sort.field) {
        sort.direction = sort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        sort.field = field;
        sort.direction = field === 'date' ? 'desc' : 'asc';
      }
      updateSortButtons();
      loadMemorandums(searchInput.value);
    });
  });

  updateSortButtons();
  await loadMemorandums(initialQuery);
})();
