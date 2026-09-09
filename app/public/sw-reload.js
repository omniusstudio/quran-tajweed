// Imported by the generated service worker. When a new build activates and claims the open pages,
// reload them so nobody keeps running an old version (the page-side check covers newer builds; this
// covers pages that were opened before it existed, like a phone's home-screen app).
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) =>
      Promise.all(clients.map((c) => (c.navigate ? c.navigate(c.url).catch(() => undefined) : undefined))),
    ),
  );
});
