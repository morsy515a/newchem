/* نيوكيم — offline support. Serves the app from the device first, refreshes it in the background. */
var VERSION = 'newchem-v9';
var SHELL = [
  './',
  './manifest.webmanifest',
  './firebase-config.js',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './logo-mark.png',
  './items/agriva-10-52-10.jpg',
  './items/agriva-21-21-21.jpg',
  './items/agriva-6-6-43.jpg',
  './items/agriva-cal.jpg',
  './items/agriva-hume.jpg',
  './items/agriva-mix.jpg',
  './items/crystalo-10-50-10.jpg',
  './items/crystalo-5-5-46.jpg',
  './items/power-cyto.jpg'
];
// online sync library (loaded by the page only when the phone is linked to the company account)
var FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
var FB_FILES = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'].map(function (f) { return FB + f; });
var FONT_CSS = 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&family=Reem+Kufi:wght@500;600;700&display=swap';

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    var cache = await caches.open(VERSION);
    // 'reload' skips the browser's HTTP cache, so a new version never precaches a stale page
    await cache.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }));
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
    await Promise.all(FB_FILES.map(function (u) {
      return fetch(u, { mode: 'no-cors' }).then(function (r) { if (r.ok || r.type === 'opaque') return cache.put(u, r); }).catch(function () {});
    }));
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
  var isLib = url.href.indexOf(FB) === 0;
  if (!sameOrigin && !isFont && !isLib) return;

  var isPage = req.mode === 'navigate';
  if (isPage) {
    // only the app's own page is served from the cache; anything else on the site loads normally
    var scope = new URL(self.registration.scope).pathname;
    if (url.pathname !== scope && url.pathname !== scope + 'index.html') return;
  }
  event.respondWith((async function () {
    var cache = await caches.open(VERSION);
    var key = isPage ? './' : req;
    var hit = await cache.match(key, { ignoreSearch: isPage, ignoreVary: true });
    var fresh = isPage ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : req;
    var network = fetch(fresh).then(function (res) {
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
