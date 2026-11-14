// 浏览器内演示站点的静态服务（端到端测试和本地预览用）：
// 默认（不带参数）：/app/ → 员工端演示构建（apps/associate/dist-demo），/sim/ → 模拟器构建（apps/simulator/dist），/ → 展示页
// 整站模式（带目录参数）：`node e2e/static-server.mjs site 4188` → 把 npm run build:site 的完整产物（site/）整站托管，/ 出作品集首页
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MOUNTS = { '/app/': join(root, 'apps/associate/dist-demo'), '/sim/': join(root, 'apps/simulator/dist') };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };
const siteDir = process.argv[2] ? resolve(root, process.argv[2]) : null;
const port = Number(process.argv[3] ?? process.env.PORT ?? 4177);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://local');
  if (siteDir) {
    let file;
    try {
      file = normalize(join(siteDir, decodeURIComponent(url.pathname)));
    } catch {
      res.writeHead(400).end('bad request');
      return;
    }
    if (file !== siteDir && !file.startsWith(siteDir + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
    return;
  }
  if (url.pathname === '/') {
    res.writeHead(302, { location: '/app/showcase.html' }).end();
    return;
  }
  const mount = Object.keys(MOUNTS).find((m) => url.pathname.startsWith(m));
  if (!mount) {
    res.writeHead(404).end('not found');
    return;
  }
  const base = MOUNTS[mount];
  let file = normalize(join(base, decodeURIComponent(url.pathname.slice(mount.length)) || 'index.html'));
  if (!file.startsWith(base)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log(siteDir ? `full site (${process.argv[2]}) on http://127.0.0.1:${port}/` : `demo site on http://127.0.0.1:${port}/`));
