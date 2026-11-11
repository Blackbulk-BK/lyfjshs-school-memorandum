// Login page
(async function () {
  const form = document.getElementById('login-form');
  const btn = document.getElementById('login-btn');
  const msg = document.getElementById('login-msg');

  function showStatus(result) {
    if (result.status === 'not_admin') {
      msg.textContent =
        'You are signed in, but uploader access is not enabled for this account yet. ' +
        'In Supabase SQL Editor, run supabase/migrations/006_make_uploader_admin.sql, ' +
        'then sign in again.';
    } else if (result.status === 'error') {
      console.error('Could not verify uploader access:', result.error);
      msg.textContent =
        'Could not verify uploader access. Check the Supabase configuration and admins table, then try again.';
    } else if (result.status === 'signed_out') {
      msg.textContent = 'Please log in to continue.';
    }
  }

  const initialStatus = await getAdminStatus();
  if (initialStatus.status === 'admin') {
    location.replace('/admin');
    return;
  }
  if (initialStatus.status !== 'signed_out') showStatus(initialStatus);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    const btnLabel = btn.querySelector('span');
    if (btnLabel) btnLabel.textContent = 'Logging in…';
    msg.textContent = '';

    try {
      const { error } = await sb.auth.signInWithPassword({
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
      });

      if (error) {
        msg.textContent = 'Could not log in. Check your email and password, and confirm the account in Supabase.';
        return;
      }

      const result = await getAdminStatus();
      if (result.status === 'admin') {
        location.replace('/admin');
        return;
      }
      showStatus(result);
    } catch (error) {
      console.error('Login request failed:', error);
      msg.textContent = 'Login could not reach Supabase. Check your connection and try again.';
    } finally {
      btn.disabled = false;
      if (btnLabel) btnLabel.textContent = 'Log in';
    }
  });
})();
