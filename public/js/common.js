// Shared helpers used by every page.
const sb = supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);
const BUCKET = 'memorandums';

// 11/11/2026 style, matching the division memorandum page
function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
  });
}

// Makes text safe to put inside HTML
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fileUrl(path) {
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Distinguish an ordinary signed-out state from failed checks and missing admin access.
async function getAdminStatus() {
  try {
    const { data: authData, error: authError } = await sb.auth.getSession();
    if (authError) return { status: 'error', error: authError };

    const session = authData.session;
    if (!session) return { status: 'signed_out' };

    const { data, error } = await sb
      .from('admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) return { status: 'error', error };
    return { status: data ? 'admin' : 'not_admin' };
  } catch (error) {
    return { status: 'error', error };
  }
}

async function isAdmin() {
  const result = await getAdminStatus();
  return result.status === 'admin';
}

// Top-right header link: "Uploader login", or "Uploader page" when already logged in
async function setupHeaderLink() {
  const link = document.getElementById('header-link');
  if (!link) return;
  if (await isAdmin()) {
    link.textContent = 'Uploader page';
    link.href = '/admin';
  }
}
setupHeaderLink();