const CACHE_PREFIX = 'bard-companion-static-';
const CACHE = CACHE_PREFIX + 'v17';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './src/styles.css',
  './src/bard-rules.js',
  './src/spell-catalog.js',
  './src/party.js',
  './src/combat-rules.js',
  './src/combat-data.js',
  './src/pathfinder-api.js',
  './src/level-up.js',
  './src/save-state.js',
  './src/local-repository.js',
  './src/campaign-config.js',
  './src/sync-state.js',
  './src/campaign-repository.js',
  './src/party-view.js',
  './src/combat-view.js',
  './src/level-view.js',
  './src/ui.js',
  './src/app-updates.js',
  './src/app.js',
];

self.addEventListener('install', event => {
  const requests = ASSETS.map(path => new Request(path, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;

  event.respondWith(caches.open(CACHE).then(async cache => {
    if (request.url === self.registration.scope + 'src/campaign-config.js') {
      try {
        const config = await fetch(request, { cache: 'no-store' });
        if (config.ok) return config;
      } catch {}
    }
    const hit = await cache.match(request);
    if (hit) return hit;

    const scope = self.registration.scope;
    const { pathname } = new URL(request.url);
    const appPath = new URL(scope).pathname;
    if (request.mode === 'navigate' && (pathname === appPath || pathname === appPath + 'index.html')) {
      const shell = await cache.match(scope + 'index.html');
      if (shell) return shell;
    }
    return fetch(request);
  }));
});
