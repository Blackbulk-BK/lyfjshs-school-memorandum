// Runs the website on your own computer: npm start  ->  http://localhost:3000
// (On Vercel this file is NOT used; Vercel uses /api, /public and vercel.json.)
require('dotenv').config();
const express = require('express');
const path = require('path');
const { getConfig } = require('./lib/shared');

const cfg = getConfig();
if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in your .env file.');
  process.exit(1);
}
if (!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) &&
    !(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)) {
  console.warn('WARNING: email sending is not set up yet (see .env.example). Sharing by email will fail.');
}

const configHandler = require('./api/config');
const memoHandler = require('./api/memo');
const sendEmailHandler = require('./api/send-email');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.get('/config.js', configHandler);
app.get('/memo/:id', (req, res) => {
  req.query = { id: req.params.id };
  memoHandler(req, res);
});
app.post('/api/send-email', sendEmailHandler);
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`School Memorandum running on http://localhost:${PORT}`));
