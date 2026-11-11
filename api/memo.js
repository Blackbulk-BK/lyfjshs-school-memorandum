// /memo/<id> : sends memo.html with the memorandum title filled in,
// so Facebook shows the right title when the link is shared.
const fs = require('fs');
const path = require('path');
const { esc, getSupabase, siteUrl } = require('../lib/shared');

module.exports = async (req, res) => {
  try {
    const id = String((req.query && req.query.id) || '').trim();
    const template = fs.readFileSync(path.join(process.cwd(), 'public', 'memo.html'), 'utf8');

    let title = 'School Memorandum';
    try {
      const { data: memo } = await getSupabase()
        .from('memorandums').select('memo_no,title').eq('id', id).maybeSingle();
      if (memo) title = `${memo.memo_no} — ${memo.title}`;
    } catch (e) { /* keep the default title */ }

    const meta = `<base href="/">
  <title>${esc(title)}</title>
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="Luis Y. Ferrer Jr. Senior High School — School Memorandum">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${esc(siteUrl(req) + '/memo/' + id)}">`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(template.replace('<!--META-->', meta));
  } catch (err) {
    res.status(500).send('Could not load this memorandum page.');
  }
};
