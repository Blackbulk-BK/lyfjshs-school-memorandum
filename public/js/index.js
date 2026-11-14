// Home page: list + search
(async function () {
  const params = new URLSearchParams(location.search);
  // remove characters that would break the filter
  const searchInput = document.getElementById('search-input');
  const form = searchInput.form;
  const sortTriggers = Array.from(document.querySelectorAll('.sort-trigger'));
  const sortOptions = Array.from(document.querySelectorAll('[data-sort-option]'));
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

  function closeSortMenus(returnFocus) {
    document.querySelectorAll('.sort-menu:not([hidden])').forEach((menu) => {
      menu.hidden = true;
      const trigger = menu.parentElement.querySelector('.sort-trigger');
      trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) trigger.focus();
    });
  }

  function updateSortButtons() {
    sortTriggers.forEach((trigger) => {
      const menu = trigger.parentElement.querySelector('.sort-menu');
      const field = menu.querySelector('[data-sort-option]').dataset.sortOption.split('-')[0];
      const active = field === sort.field;
      trigger.classList.toggle('is-sorted', active);
      trigger.setAttribute('aria-label', `Sort ${field === 'date' ? 'date issued' : field === 'number' ? 'memorandum number' : 'title'}`);
      trigger.innerHTML = SchoolIcons.svg(
        active ? (sort.direction === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down'
      );
    });

    sortOptions.forEach((option) => {
      const selected = option.dataset.sortOption === `${sort.field}-${sort.direction}`;
      option.setAttribute('aria-pressed', String(selected));
      option.classList.toggle('is-selected', selected);
    });

    headers.forEach((header) => {
      const option = header.querySelector('[data-sort-option]');
      if (!option) return;
      const field = option.dataset.sortOption.split('-')[0];
      header.setAttribute(
        'aria-sort',
        field === sort.field
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

  sortTriggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const menu = trigger.parentElement.querySelector('.sort-menu');
      const shouldOpen = menu.hidden;
      closeSortMenus(false);
      if (!shouldOpen) return;
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      menu.querySelector('[aria-pressed="true"]')?.focus();
    });
  });

  sortOptions.forEach((option) => {
    option.addEventListener('click', () => {
      [sort.field, sort.direction] = option.dataset.sortOption.split('-');
      updateSortButtons();
      closeSortMenus(true);
      loadMemorandums(searchInput.value);
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.sort-control')) closeSortMenus(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSortMenus(true);
  });

  updateSortButtons();
  await loadMemorandums(initialQuery);
})();
