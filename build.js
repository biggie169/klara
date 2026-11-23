// Builds one fully translated page per language from src/index.html:
//   public/index.html (English), public/de/index.html, public/fr/index.html, ...
// plus public/sitemap.xml and public/robots.txt.
//
//   node build.js                      (no domain yet: relative links only)
//   SITE_URL=https://klara.eu node build.js
//
// Search engines get real text in every language, a canonical address per page and
// hreflang links between the versions. Run it after every change to src/ or public/i18n.js.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const TEMPLATE = path.join(ROOT, 'src', 'index.html');
const SITE = (process.env.SITE_URL || '').replace(/\/+$/, '');

global.window = {};
eval(fs.readFileSync(path.join(PUBLIC, 'i18n.js'), 'utf8'));
const I18N = global.window.KLARA_I18N;
const LANGS = I18N.langs;
const pathFor = (code) => (code === 'en' ? '/' : `/${code}/`);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml'
};

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const isPage = url === '/' || /^\/[a-z]{2}\/(index\.html)?$/.test(url);
    const file = isPage ? TEMPLATE : path.join(PUBLIC, path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(PUBLIC) && file !== TEMPLATE) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  for (const l of LANGS) {
    const ctx = await browser.newContext({ locale: l.locale });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin + pathFor(l.code), { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-faq] details');

    const html = await page.evaluate(({ site, langs, code, pathFor1, ticker }) => {
      const pathFor = (c) => (c === 'en' ? '/' : `/${c}/`);
      // Back to the state a fresh visitor sees before the script runs.
      document.querySelectorAll('.is-open').forEach((el) => el.classList.remove('is-open'));
      document.querySelectorAll('[data-open]').forEach((el) => el.setAttribute('aria-hidden', 'true'));
      document.querySelectorAll('[data-show="loading"]').forEach((el) => el.removeAttribute('hidden'));
      const msg = document.querySelector('.k-ticker-msg');
      if (msg) { msg.getAnimations().forEach((a) => a.cancel()); msg.textContent = ticker; msg.removeAttribute('style'); }
      document.body.removeAttribute('style');
      document.documentElement.removeAttribute('style');
      const lb = document.querySelector('.k-lang-btn');
      if (lb) lb.setAttribute('aria-expanded', 'false');

      // Addresses for search engines and link previews.
      const head = document.head;
      head.querySelectorAll('link[rel="canonical"], link[rel="alternate"], meta[property="og:url"], meta[property="og:locale"]').forEach((el) => el.remove());
      const add = (tag, attrs) => { const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); head.appendChild(el); };
      const abs = (p) => (site ? site + p : p);
      if (site) {
        add('link', { rel: 'canonical', href: abs(pathFor(code)) });
        langs.forEach((x) => add('link', { rel: 'alternate', hreflang: x.code, href: abs(pathFor(x.code)) }));
        add('link', { rel: 'alternate', hreflang: 'x-default', href: abs('/') });
        add('meta', { property: 'og:url', content: abs(pathFor(code)) });
        const img = head.querySelector('meta[property="og:image"]');
        if (img) img.setAttribute('content', abs('/assets/shampoo.webp'));
      }
      add('meta', { property: 'og:locale', content: langs.find((x) => x.code === code).locale.replace('-', '_') });
      return '<!doctype html>\n' + document.documentElement.outerHTML + '\n';
    }, { site: SITE, langs: LANGS, code: l.code, ticker: I18N[l.code].ticker1 });

    const out = html.split(origin).join(SITE);
    const dir = l.code === 'en' ? PUBLIC : path.join(PUBLIC, l.code);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), out);
    console.log(`${l.code}  ${pathFor(l.code).padEnd(5)} ${(out.length / 1024).toFixed(0)} KB${errors.length ? '  ERRORS: ' + errors.join('; ') : ''}`);
    await ctx.close();
  }

  await browser.close();
  server.close();

  // robots.txt and sitemap.xml
  const robots = ['User-agent: *', 'Allow: /'];
  if (SITE) robots.push('', `Sitemap: ${SITE}/sitemap.xml`);
  fs.writeFileSync(path.join(PUBLIC, 'robots.txt'), robots.join('\n') + '\n');
  if (SITE) {
    const today = new Date().toISOString().slice(0, 10);
    const alts = LANGS.map((x) => `    <xhtml:link rel="alternate" hreflang="${x.code}" href="${SITE}${pathFor(x.code)}"/>`).join('\n') +
      `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`;
    const urls = LANGS.map((x) => `  <url>\n    <loc>${SITE}${pathFor(x.code)}</loc>\n    <lastmod>${today}</lastmod>\n${alts}\n  </url>`).join('\n');
    fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
  } else {
    console.log('No SITE_URL set: skipped canonical, hreflang and sitemap.xml (they need the live domain).');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
