#!/usr/bin/env node
// Local server for نُطق: serves the built app (app/dist) on every interface so a phone on the same
// Wi-Fi can open it, with Range requests for the recordings and an HTTPS port (self-signed
// certificate, generated on first run) so the phone's microphone works for record-and-compare.
//
//   node server/serve.mjs            # http://localhost:7373  https://localhost:7374
//   PORT=8080 node server/serve.mjs
//
// GET /__lan answers with the addresses to type on the phone and a QR code for the settings page.

import { execFileSync } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import http from 'node:http';
import https from 'node:https';
import { networkInterfaces, hostname } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { mergeState } from './merge.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(APP, 'dist');
const PUBLIC = join(APP, 'public');
const LOCAL = join(APP, '.local');
const PORT = Number(process.env.PORT || 7373);
const TLS_PORT = Number(process.env.TLS_PORT || PORT + 1);

// The learner's state, shared between devices through this server (GET/PUT /__state).
const STATE_FILE = join(LOCAL, 'state.json');
function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}
function writeStateSync(state) {
  mkdirSync(LOCAL, { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, STATE_FILE);
}
function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) reject(new Error('body too large'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// The learner's recordings (record-and-compare, teacher clips), shared between devices:
// GET /__clips (index), GET/PUT/DELETE /__clips/<key>. Files live in .local/clips/.
const CLIPS_DIR = join(LOCAL, 'clips');
const CLIPS_INDEX = join(CLIPS_DIR, 'index.json');
function readClipsIndex() {
  try {
    return JSON.parse(readFileSync(CLIPS_INDEX, 'utf8'));
  } catch {
    return {};
  }
}
function writeClipsIndex(idx) {
  mkdirSync(CLIPS_DIR, { recursive: true });
  writeFileSync(`${CLIPS_INDEX}.tmp`, JSON.stringify(idx));
  renameSync(`${CLIPS_INDEX}.tmp`, CLIPS_INDEX);
}
const clipFile = (key) => join(CLIPS_DIR, encodeURIComponent(key));
function readBinary(req, limit = 64 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) reject(new Error('body too large'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function clipsHandler(req, res, url) {
  const json = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  const rest = url.slice('/__clips'.length).replace(/^\//, '').split('?')[0];
  if (!rest) {
    if (req.method !== 'GET') { res.writeHead(405, json); return res.end('{}'); }
    res.writeHead(200, json);
    return res.end(JSON.stringify(readClipsIndex()));
  }
  const key = decodeURIComponent(rest);
  if (!/^[\w./-]+$/.test(key) || key.includes('..')) { res.writeHead(400, json); return res.end('{"error":"bad key"}'); }
  const idx = readClipsIndex();
  if (req.method === 'GET') {
    const meta = idx[key];
    const f = clipFile(key);
    if (!meta || !existsSync(f)) return notFound(res);
    res.writeHead(200, { 'content-type': meta.mime || 'application/octet-stream', 'content-length': statSync(f).size, 'x-clip-at': String(meta.at || 0), 'cache-control': 'no-store' });
    return createReadStream(f).pipe(res);
  }
  if (req.method === 'PUT') {
    return readBinary(req)
      .then((buf) => {
        mkdirSync(CLIPS_DIR, { recursive: true });
        const at = Number(req.headers['x-clip-at']) || Date.now();
        writeFileSync(clipFile(key), buf);
        idx[key] = { mime: req.headers['content-type'] || 'application/octet-stream', at, size: buf.length };
        writeClipsIndex(idx);
        res.writeHead(200, json);
        res.end(JSON.stringify(idx[key]));
      })
      .catch((e) => { res.writeHead(400, json); res.end(JSON.stringify({ error: String(e) })); });
  }
  if (req.method === 'DELETE') {
    try { unlinkSync(clipFile(key)); } catch { /* ignore */ }
    delete idx[key];
    writeClipsIndex(idx);
    res.writeHead(200, json);
    return res.end('{}');
  }
  res.writeHead(405, json);
  res.end('{}');
}

// Reciter servers (copied next to this file by the installer; falls back to the source tree).
const RECITERS_FILE = [join(APP, 'server', 'reciters.json'), join(APP, 'src', 'content', 'reciters.json')].find((f) => existsSync(f));
const RECITERS = RECITERS_FILE ? JSON.parse(readFileSync(RECITERS_FILE, 'utf8')).reciters : [];
/** In-flight downloads keyed by relative path, so parallel requests share one fetch. */
const downloads = new Map();

/**
 * A recording that is not cached yet is fetched once from the reciter's server into public/audio
 * (never hot-linked by the app itself), so any of the 114 sūrahs plays without a full pre-fetch.
 */
async function ensureAudio(rel) {
  const m = /^audio\/([\w-]+)\/(\d{3})\.mp3$/.exec(rel.split(sep).join('/'));
  if (!m) return null;
  const reciter = RECITERS.find((r) => r.id === m[1]);
  if (!reciter) return null;
  const dst = join(PUBLIC, 'audio', m[1], `${m[2]}.mp3`);
  if (existsSync(dst) && statSync(dst).size > 10_000) return dst;
  if (downloads.has(rel)) return downloads.get(rel);
  const job = (async () => {
    mkdirSync(dirname(dst), { recursive: true });
    const url = `${reciter.server}${m[2]}.mp3`;
    const res = await fetch(url, { headers: { 'user-agent': 'nutq-tajweed/1.0 (local cache)' } });
    if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
    const tmp = `${dst}.part`;
    try {
      await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
      renameSync(tmp, dst);
      console.log(`fetched ${rel} (${Math.round(statSync(dst).size / 1024)} KB)`);
      return dst;
    } catch (e) {
      try { unlinkSync(tmp); } catch { /* ignore */ }
      throw e;
    } finally {
      downloads.delete(rel);
    }
  })();
  downloads.set(rel, job);
  return job;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webm': 'audio/webm',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('app/dist is missing: run `npm run build` first (the launcher does this for you).');
  process.exit(1);
}

/** The Bonjour name phones resolve on the same network: <LocalHostName>.local (read at run time, so any Mac works). */
function bonjourName() {
  let name = '';
  try {
    name = execFileSync('scutil', ['--get', 'LocalHostName'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    /* not macOS or scutil missing */
  }
  if (!name) name = hostname().replace(/\.local$/i, '');
  return `${name}.local`;
}

/**
 * Tailscale, if installed and signed in: the private way to reach this Mac from outside the home
 * network. `tailscale serve` in front of port 7373 gives a real https address on the tailnet.
 */
function tailscaleInfo() {
  const bins = ['/Applications/Tailscale.app/Contents/MacOS/Tailscale', '/usr/local/bin/tailscale', '/opt/homebrew/bin/tailscale'];
  const bin = bins.find((b) => existsSync(b));
  if (!bin) return { installed: false };
  try {
    const st = JSON.parse(execFileSync(bin, ['status', '--json'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).toString());
    const self = st.Self || {};
    const dns = (self.DNSName || '').replace(/\.$/, '');
    const ip = (self.TailscaleIPs || [])[0];
    let serve = null;
    try {
      const out = execFileSync(bin, ['serve', 'status'], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).toString();
      const m = /https:\/\/[^\s/]+/.exec(out);
      if (m && /7373/.test(out)) serve = `${m[0]}/`;
    } catch {
      /* serve not configured */
    }
    return { installed: true, online: st.BackendState === 'Running', dnsName: dns, ip, http: dns ? `http://${dns}:${PORT}/` : ip ? `http://${ip}:${PORT}/` : null, serve };
  } catch {
    return { installed: true, online: false };
  }
}

/** IPv4 addresses of this Mac on the local network (no loopback, no link-local). */
function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.')) out.push(i.address);
  }
  return out;
}

/** Self-signed certificate for the LAN addresses and the Bonjour name, kept in app/.local. */
function certificate() {
  mkdirSync(LOCAL, { recursive: true });
  const key = join(LOCAL, 'key.pem');
  const cert = join(LOCAL, 'cert.pem');
  const sans = [`DNS:${bonjourName()}`, ...lanAddresses().map((a) => `IP:${a}`), 'DNS:localhost', 'IP:127.0.0.1'];
  const stamp = join(LOCAL, 'cert.sans');
  const wanted = sans.join(',');
  const fresh = existsSync(key) && existsSync(cert) && existsSync(stamp) && readFileSync(stamp, 'utf8') === wanted;
  if (!fresh) {
    try {
      execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '3650', '-keyout', key, '-out', cert, '-subj', '/CN=nutq.local', '-addext', `subjectAltName=${wanted}`], { stdio: 'ignore' });
      execFileSync('sh', ['-c', `printf %s '${wanted}' > '${stamp}'`]);
    } catch (e) {
      console.warn('could not create a certificate (openssl missing?); HTTPS disabled.', String(e));
      return null;
    }
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

function safePath(urlPath) {
  const p = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  return p.split('/').filter((s) => s !== '..').join(sep);
}

/** The file to serve for a request path: dist first, then public (recordings fetched after the build). */
function locate(urlPath) {
  const rel = safePath(urlPath);
  for (const root of [DIST, PUBLIC]) {
    let file = join(root, rel);
    if (!file.startsWith(root)) continue;
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  // hash routing: anything without an extension is the app shell
  if (!extname(rel)) return join(DIST, 'index.html');
  return null;
}

async function lanInfo(req) {
  const proto = req.socket.encrypted ? 'https' : 'http';
  const host = bonjourName();
  const addresses = lanAddresses();
  const online = addresses.length > 0;
  // The Bonjour name first (stable across DHCP leases, same on every install), the numeric addresses as a fallback.
  const http = online ? [`http://${host}:${PORT}/`, ...addresses.map((a) => `http://${a}:${PORT}/`)] : [];
  const https = tls && online ? [`https://${host}:${TLS_PORT}/`, ...addresses.map((a) => `https://${a}:${TLS_PORT}/`)] : [];
  // Plain http by name is what the QR encodes: no certificate warning. The https address is
  // offered alongside for the phone's microphone (browsers allow it only on https).
  const preferred = http[0] || `${proto}://localhost:${PORT}/`;
  const fallback = online ? `http://${addresses[0]}:${PORT}/` : null;
  const plain = online ? `http://${host}:${PORT}/` : null;
  const secure = tls && online ? `https://${host}:${TLS_PORT}/` : null;
  const svg = (text) => QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#1f2622', light: '#0000' } });
  const qr = await svg(preferred);
  const tailscale = tailscaleInfo();
  const away = tailscale.serve || tailscale.http;
  if (away) tailscale.qr = await svg(away);
  return { hostname: host, http, https, preferred, fallback, plain, secure, qr, tailscale };
}

function handler(req, res) {
  const url = req.url || '/';
  if (url.startsWith('/__lan')) {
    lanInfo(req).then((info) => {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(info));
    });
    return;
  }
  if (url.startsWith('/__clips')) return clipsHandler(req, res, url);
  if (url.startsWith('/__state')) {
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
    if (req.method === 'GET') {
      res.writeHead(200, headers);
      res.end(JSON.stringify(readState()));
      return;
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      readBody(req)
        .then((txt) => {
          const incoming = txt ? JSON.parse(txt) : null;
          const merged = mergeState(readState(), incoming);
          if (merged) writeStateSync(merged);
          res.writeHead(200, headers);
          res.end(JSON.stringify(merged));
        })
        .catch((e) => {
          res.writeHead(400, headers);
          res.end(JSON.stringify({ error: String(e) }));
        });
      return;
    }
    res.writeHead(405, headers);
    res.end('{}');
    return;
  }
  let file = locate(url);
  if (!file && /^\/audio\//.test(url.split('?')[0])) {
    ensureAudio(safePath(url).replace(/^[/\\]/, ''))
      .then((f) => (f ? serveFile(req, res, f) : notFound(res)))
      .catch((e) => {
        console.warn(String(e));
        res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('could not fetch the recording');
      });
    return;
  }
  if (!file) return notFound(res);
  serveFile(req, res, file);
}

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
}

function serveFile(req, res, file) {
  const st = statSync(file);
  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  const isAsset = file.includes(`${sep}assets${sep}`) || /\.(mp3|ttf|png|webp)$/i.test(file);
  const headers = {
    'content-type': type,
    'accept-ranges': 'bytes',
    'cache-control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    'last-modified': st.mtime.toUTCString(),
  };
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (range) {
    let start = range[1] ? Number(range[1]) : 0;
    let end = range[2] ? Number(range[2]) : st.size - 1;
    if (!range[1] && range[2]) { start = Math.max(0, st.size - Number(range[2])); end = st.size - 1; }
    if (start > end || start >= st.size) {
      res.writeHead(416, { 'content-range': `bytes */${st.size}` });
      res.end();
      return;
    }
    end = Math.min(end, st.size - 1);
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'content-length': st.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

const tls = certificate();
http.createServer(handler).listen(PORT, '0.0.0.0', async () => {
  const info = await lanInfo({ socket: {} });
  console.log(`نُطق  http://localhost:${PORT}/`);
  if (info.plain) console.log(`      ${info.plain}   (phone, same Wi-Fi)`);
  if (tls && info.https[0]) console.log(`      ${info.https[0]}   (phone, microphone works; accept the certificate once)`);
  if (info.fallback) console.log(`      ${info.fallback}   (if the name does not resolve)`);
  if (process.stdout.isTTY) {
    try {
      console.log(await QRCode.toString(info.preferred, { type: 'terminal', small: true }));
    } catch {
      /* no terminal QR */
    }
  }
});
if (tls) {
  https.createServer(tls, handler).listen(TLS_PORT, '0.0.0.0');
}
process.on('SIGTERM', () => process.exit(0));
