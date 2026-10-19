const CACHE = 'eps-topik-v6b-gemini-20261019';
const CORE = ['./', './index.html', './style.css?v=20261019-gemini-v1', './app.js?v=20261019-gemini-v1', './data/chapters.json', './data/vocabulary.json', './manifest.webmanifest'];
const SHELL = ['/', '/index.html', '/style.css', '/app.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (SHELL.includes(u.pathname)) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; }).catch(() => cached)));
});
