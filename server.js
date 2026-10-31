// Bike TV — servidor local (Mac). Sem dependências: `node server.js`
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT) || 8787;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'docs');
const CONFIG = path.join(ROOT, 'config.json');
const VIDEOS = path.join(ROOT, 'docs', 'videos.json');
const SESSIONS = path.join(ROOT, 'sessions.json');

const DEFAULT_CONFIG = {
  pulsoidToken: '',
  age: 35,
  weightKg: 80,
  sex: 'male',
  restingHr: 60,
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (p === '/ping') return send(res, 200, { ok: true });

  if (p === '/api/config' && req.method === 'GET') {
    return send(res, 200, { ...DEFAULT_CONFIG, ...readJson(CONFIG, {}) });
  }
  if (p === '/api/config' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const cfg = { ...DEFAULT_CONFIG, ...readJson(CONFIG, {}) };
      if (typeof body.pulsoidToken === 'string') cfg.pulsoidToken = body.pulsoidToken.trim();
      for (const k of ['age', 'weightKg', 'restingHr']) if (body[k] != null && !isNaN(+body[k])) cfg[k] = +body[k];
      if (body.sex === 'male' || body.sex === 'female') cfg.sex = body.sex;
      writeJson(CONFIG, cfg);
      return send(res, 200, cfg);
    } catch { return send(res, 400, { error: 'invalid json' }); }
  }
  if (p === '/api/videos') return send(res, 200, readJson(VIDEOS, []));
  if (p === '/api/sessions' && req.method === 'GET') return send(res, 200, readJson(SESSIONS, []));
  if (p === '/api/sessions' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const all = readJson(SESSIONS, []);
      all.push({ ...body, savedAt: new Date().toISOString() });
      writeJson(SESSIONS, all);
      return send(res, 200, { ok: true, count: all.length });
    } catch { return send(res, 400, { error: 'invalid json' }); }
  }

  // arquivos estáticos
  let file = p === '/' ? '/index.html' : p === '/setup' ? '/setup.html' : p;
  file = path.normalize(path.join(PUBLIC, file));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'not found', 'text/plain');
    send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`Bike TV rodando:`);
  for (const ip of ips) console.log(`  TV:     http://${ip}:${PORT}/`);
  console.log(`  Ajustes: http://localhost:${PORT}/setup`);
});
