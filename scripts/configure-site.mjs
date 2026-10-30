// 배포 주소가 확정된 뒤 실행: node scripts/configure-site.mjs https://계정.github.io/저장소/
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const raw = process.argv[2];
if (!raw) throw new Error('실제 HTTPS 배포 주소를 인자로 지정하세요.');
const base = new URL(raw.endsWith('/') ? raw : raw + '/');
if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || ['localhost', '127.0.0.1'].includes(base.hostname)) {
  throw new Error('인증정보·쿼리·해시가 없는 실제 HTTPS 배포 주소가 필요합니다.');
}
const root = fileURLToPath(new URL('../', import.meta.url));
const pages = ['index.html', 'school.html', 'guide.html'];
const locations = [];
for (const name of pages) {
  const url = name === 'index.html' ? base.href : new URL(name, base).href;
  locations.push(url);
  let html = await readFile(join(root, name), 'utf8');
  html = html.replace(/<link\b[^>]*rel="canonical"[^>]*>\s*/gi, '')
    .replace(/<meta\b[^>]*property="og:url"[^>]*>\s*/gi, '');
  html = html.replace('</head>', `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n</head>`);
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (_, body) => {
    const schema = JSON.parse(body);
    schema.url = url;
    return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  });
  await writeFile(join(root, name), html);
}
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  locations.map(url => `  <url><loc>${url}</loc></url>`).join('\n') + '\n</urlset>\n';
await writeFile(join(root, 'sitemap.xml'), xml);
await writeFile(join(root, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml', base).href}\n`);
console.log('canonical, og:url, 구조화 데이터 URL, sitemap.xml, robots.txt 갱신 완료');
