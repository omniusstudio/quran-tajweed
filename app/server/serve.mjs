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
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { networkInterfaces, hostname } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(APP, 'dist');
const PUBLIC = join(APP, 'public');
const LOCAL = join(APP, '.local');
const PORT = Number(process.env.PORT || 7373);
const TLS_PORT = Number(process.env.TLS_PORT || PORT + 1);

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
  const preferred = (tls ? https : http)[0] || `${proto}://localhost:${PORT}/`;
  const fallback = online ? (tls ? `https://${addresses[0]}:${TLS_PORT}/` : `http://${addresses[0]}:${PORT}/`) : null;
  const plain = online ? `http://${host}:${PORT}/` : null;
  const qr = await QRCode.toString(preferred, { type: 'svg', margin: 1, color: { dark: '#1f2622', light: '#0000' } });
  return { hostname: host, http, https, preferred, fallback, plain, qr };
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
  const file = locate(url);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
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
