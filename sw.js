const CACHE='bard-companion-static-v3';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',evt=>evt.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',evt=>evt.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',evt=>{const req=evt.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;evt.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return res})))})
