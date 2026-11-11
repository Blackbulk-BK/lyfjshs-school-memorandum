// Gives the browser the (public) Supabase settings as /config.js
const { getConfig } = require('../lib/shared');

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(`window.APP_CONFIG = ${JSON.stringify(getConfig())};`);
};
