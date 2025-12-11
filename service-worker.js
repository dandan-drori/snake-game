const CACHE_NAME = 'snake-game-cache-v1';
const urlsToCache = [
  './',
  'index.html',
  'styles.css',
  'main.js',
  'assets/logo/icon-192x192.png',
  'assets/logo/icon-512x512.png',
  'assets/apple/apple.png',
  'assets/snake/tail_up.png',
  'assets/snake/tail_right.png',
  'assets/snake/tail_left.png',
  'assets/snake/tail_down.png',
  'assets/snake/head_down.png',
  'assets/snake/head_up.png',
  'assets/snake/head_right.png',
  'assets/snake/head_left.png',
  'assets/snake/body_vertical.png',
  'assets/snake/body_horizontal.png',
  'assets/snake/body_bottomleft.png',
  'assets/snake/body_bottomright.png',
  'assets/snake/body_topleft.png',
  'assets/snake/body_topright.png',
  'manifest.json',
];

// Install: Caches all files listed in urlsToCache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(urlsToCache);
    })
  );
});

// Fetch: Serves content from cache first, then falls back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return response
      if (response) {
        return response;
      }
      // No cache hit - fetch from network
      return fetch(event.request);
    })
  );
});
