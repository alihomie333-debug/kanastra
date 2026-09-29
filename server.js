// Servidor de la Kanastra de la familia. Sin dependencias: solo Node.js 18 o más nuevo.
// Uso: node server.js   (luego abre http://localhost:3000)
const http = require('http');
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'mesas.json');
const INDEX = path.join(__dirname, 'public', 'index.html');
const MAX_AGE_DAYS = 14;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// Archivos de la app instalable (PWA)
const STATIC = {
  'manifest.webmanifest': 'application/manifest+json',
  'sw.js': 'text/javascript; charset=utf-8',
  'icon-192.png': 'image/png', 'icon-512.png': 'image/png', 'icon-maskable-512.png': 'image/png',
  'apple-touch-icon.png': 'image/png', 'favicon.png': 'image/png'
};

let mesas = {};
try { mesas = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); console.log(`Cargadas ${Object.keys(mesas).length} mesas guardadas.`); } catch (e) {}
const streams = {}; // code -> Set<{res, cid}>

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(mesas)); }
    catch (e) { console.error('No se pudo guardar:', e.message); }
  }, 400);
}
function seatOf(s, cid) {
  for (let i = 0; i < 4; i++) { const x = s.seats['s' + i]; if (x && x.cid === cid) return i; }
  return null;
}
// Cada jugador solo recibe su propia mano; el mazo va boca abajo.
function redact(s, cid) {
  const c = JSON.parse(JSON.stringify(s));
  const me = seatOf(s, cid);
  if (c.hands) for (let i = 0; i < 4; i++) if (i !== me) c.hands['s' + i] = c.hands['s' + i].map(() => -1);
  if (c.stock) c.stock = c.stock.map(() => -1);
  for (let i = 0; i < 4; i++) { const x = c.seats['s' + i]; if (x && x.cid !== cid) x.cid = 'otro' + i; }
  if (c.host !== cid) c.host = 'otro';
  return c;
}
// Los ids de los demás se ocultan: cada quien ve "otroN" para los asientos ajenos.
function onlineFor(code, cid) {
  const s = mesas[code]; if (!s) return [];
  const ids = new Set([...(streams[code] || [])].map(x => x.cid));
  const out = [];
  for (let i = 0; i < 4; i++) { const x = s.seats['s' + i]; if (x && ids.has(x.cid)) out.push(x.cid === cid ? cid : 'otro' + i); }
  return out;
}
function payload(code, cid) { return { state: redact(mesas[code], cid), online: onlineFor(code, cid) }; }
function broadcast(code) {
  for (const st of streams[code] || []) {
    st.res.write('data: ' + JSON.stringify(mesas[code] ? payload(code, st.cid) : { gone: true }) + '\n\n');
  }
}
function summary(s) {
  const seats = {};
  for (let i = 0; i < 4; i++) seats['s' + i] = s.seats['s' + i] ? { name: s.seats['s' + i].name } : null;
  return { code: s.code, status: s.status, round: s.round, seats, updated: s.updated };
}
function send(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', ch => { data += ch; if (data.length > 50000) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
const cleanCid = v => typeof v === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(v) ? v : null;
const cleanName = v => typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 18) : '';

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url.replace(/^\/+/, '/'), 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
  const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && (parts.length === 0 || url.pathname === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      return fs.createReadStream(INDEX).pipe(res);
    }
    if (req.method === 'GET' && parts.length === 1 && STATIC[parts[0]]) {
      res.writeHead(200, { 'content-type': STATIC[parts[0]], 'cache-control': parts[0] === 'sw.js' ? 'no-cache' : 'public, max-age=86400' });
      return fs.createReadStream(path.join(__dirname, 'public', parts[0])).pipe(res);
    }
    if (parts[0] === 'api' && parts[1] === 'ping') return send(res, 200, { ok: true });
    if (parts[0] !== 'api' || parts[1] !== 'mesas') return send(res, 404, { error: 'No existe.' });
    const code = (parts[2] || '').toUpperCase();

    // lista de mesas
    if (req.method === 'GET' && parts.length === 2) {
      const list = Object.values(mesas).sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 30).map(summary);
      return send(res, 200, { mesas: list });
    }
    // crear mesa
    if (req.method === 'POST' && parts.length === 2) {
      const body = await readBody(req);
      const cid = cleanCid(body.cid), name = cleanName(body.name);
      if (!cid || !name) return send(res, 400, { error: 'Escribe tu nombre primero.' });
      let c;
      do { c = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); } while (mesas[c]);
      mesas[c] = E.newTable(c, cid, name);
      save();
      return send(res, 200, { code: c });
    }
    const s = mesas[code];
    if (!s) return send(res, 404, { error: 'No encontramos esa mesa.' });

    if (req.method === 'GET' && parts.length === 3) return send(res, 200, summary(s));

    // transmisión en vivo (Server-Sent Events)
    if (req.method === 'GET' && parts[3] === 'stream') {
      const cid = cleanCid(url.searchParams.get('cid')) || 'anon';
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
      res.write('retry: 2000\n\n');
      const entry = { res, cid };
      (streams[code] = streams[code] || new Set()).add(entry);
      broadcast(code);
      const ping = setInterval(() => res.write(': ping\n\n'), 20000);
      req.on('close', () => { clearInterval(ping); streams[code] && streams[code].delete(entry); broadcast(code); });
      return;
    }
    // jugada
    if (req.method === 'POST' && parts[3] === 'act') {
      const body = await readBody(req);
      const cid = cleanCid(body.cid);
      const action = body.action;
      if (!cid || !Object.prototype.hasOwnProperty.call(E.ACTIONS, action)) return send(res, 400, { error: 'Jugada no válida.' });
      const args = Object.assign({}, body.args || {}, { cid });
      if (action === 'sit') args.name = cleanName(args.name);
      const next = JSON.parse(JSON.stringify(s));
      const seat = seatOf(next, cid);
      if (!['sit', 'stand', 'takeover'].includes(action) && seat == null) return send(res, 403, { error: 'No tienes asiento en esta mesa.' });
      try { E.ACTIONS[action](next, seat, args); }
      catch (e) { if (e instanceof E.GameErr) return send(res, 400, { error: e.message }); throw e; }
      next.rev = (next.rev || 0) + 1; next.updated = Date.now();
      mesas[code] = next;
      save(); broadcast(code);
      return send(res, 200, payload(code, cid));
    }
    // borrar mesa (solo quien la creó)
    if (req.method === 'DELETE' && parts.length === 3) {
      if (cleanCid(url.searchParams.get('cid')) !== s.host) return send(res, 403, { error: 'Solo quien creó la mesa puede borrarla.' });
      delete mesas[code]; save(); broadcast(code);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'No existe.' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'Error en el servidor.' });
  }
});

// limpia mesas viejas cada hora
setInterval(() => {
  const limit = Date.now() - MAX_AGE_DAYS * 86400000;
  let n = 0;
  for (const c in mesas) if ((mesas[c].updated || 0) < limit && !(streams[c] && streams[c].size)) { delete mesas[c]; n++; }
  if (n) save();
}, 3600000);

server.listen(PORT, () => console.log(`Kanastra lista en http://localhost:${PORT}`));
