// Imported by the generated service worker.
// 1. When a new build activates and claims the open pages, reload them so nobody keeps running an
//    old version (covers pages opened before the page-side check existed, like a phone's
//    home-screen app).
// 2. Drop the old recordings cache: it answered byte-range requests with whole files and broke
//    playback; recordings now bypass the worker entirely.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('nutq-audio')).map((n) => caches.delete(n)));
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(clients.map((c) => (c.navigate ? c.navigate(c.url).catch(() => undefined) : undefined)));
    })(),
  );
});
// Never handle recordings or the local API inside the worker (byte ranges, no-store data).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.includes('/audio/') || url.pathname.startsWith('/__')) return; // let the browser do it
});
