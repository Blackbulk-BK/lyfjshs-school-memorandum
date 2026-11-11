// Helpers shared by the server functions (used on Vercel AND locally).
const { createClient } = require('@supabase/supabase-js');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getConfig() {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY:
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

// Supabase client. With a token it acts as the logged-in user (database rules apply).
function getSupabase(token) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getConfig();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY.');
  }
  return createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined
  );
}

// Makes text safe to put inside HTML
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// The website address (works on Vercel and on localhost)
function siteUrl(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000');
  const proto = String(req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https')).split(',')[0];
  const fromRequest = `${proto}://${host}`;
  const fromEnv = (process.env.SITE_URL || '').replace(/\/$/, '');
  const isLocal = (u) => /localhost|127\.0\.0\.1/.test(u);
  if (fromEnv && !(isLocal(fromEnv) && !isLocal(host))) return fromEnv;
  return fromRequest;
}

module.exports = { EMAIL_RE, getConfig, getSupabase, esc, siteUrl };
