// Service worker for the installable app shell.
//
// IMPORTANT: this only caches the static frontend files (HTML/CSS/JS/icons/
// fonts) so the app's interface loads instantly (and even fully offline).
// It deliberately never touches /api/* requests - your actual customer,
// plot, and accounting data always comes fresh from the server, every time.
// Caching that would mean seeing stale/wrong numbers, which would be worse
// than no offline support at all.

const CACHE_NAME = 'hs-erp-shell-v1';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/translations.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept API calls - always go straight to the network so data
  // is always current. This is the most important line in this file.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Only handle GET requests for same-origin static files
  if (event.request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
