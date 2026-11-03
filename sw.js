/* نيوكيم — offline support. Serves the app from the device first, refreshes it in the background. */
var VERSION = 'newchem-v2';
var SHELL = [
  './',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];
var FONT_CSS = 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&family=Reem+Kufi:wght@500;600;700&display=swap';

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    var cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    try {
      var res = await fetch(FONT_CSS, { mode: 'cors' });
      if (res.ok) {
        await cache.put(FONT_CSS, res.clone());
        var css = await res.text();
        var urls = Array.from(css.matchAll(/url\((https:[^)]+)\)/g)).map(function (m) { return m[1]; });
        await Promise.all(urls.map(function (u) {
          return fetch(u, { mode: 'cors' }).then(function (r) { if (r.ok) return cache.put(u, r); }).catch(function () {});
        }));
      }
    } catch (e) { /* fonts are optional; the app falls back to system Arabic fonts */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  var isPage = req.mode === 'navigate';
  event.respondWith((async function () {
    var cache = await caches.open(VERSION);
    var key = isPage ? './' : req;
    var hit = await cache.match(key, { ignoreSearch: isPage, ignoreVary: true });
    var network = fetch(req).then(function (res) {
      if (res && !res.redirected && (res.ok || res.type === 'opaque')) cache.put(key, res.clone()).catch(function () {});
      return res;
    }).catch(function () { return null; });
    if (hit) { event.waitUntil(network); return hit; }
    var res = await network;
    if (res) return res;
    if (isPage) {
      var shell = await cache.match('./');
      if (shell) return shell;
    }
    return new Response('', { status: 504, statusText: 'offline' });
  })());
});
