// Login page
(async function () {
  if (await isAdmin()) { location.replace('/admin'); return; }

  const form = document.getElementById('login-form');
  const btn = document.getElementById('login-btn');
  const msg = document.getElementById('login-msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Logging in…';
    msg.textContent = '';

    const { error } = await sb.auth.signInWithPassword({
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
    });

    btn.disabled = false;
    btn.textContent = 'Log in';
    if (error) { msg.textContent = 'Wrong email or password.'; return; }
    location.href = '/admin';
  });
})();
