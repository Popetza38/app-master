const CACHE_NAME = 'sup-v1';
const STATIC_ASSETS = [
  '/testapp/',
  '/testapp/index.html',
  '/testapp/styles.css',
  '/testapp/api.js',
  '/testapp/mock-api.js',
  '/testapp/app.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    }).catch(function(){})
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.filter(function(n){ return n !== CACHE_NAME; }).map(function(n){ return caches.delete(n); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var fetchPromise = fetch(e.request).then(function(networkRes) {
        if (networkRes && networkRes.status === 200) {
          var clone = networkRes.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, clone); }).catch(function(){});
        }
        return networkRes;
      }).catch(function(){});
      return cached || fetchPromise;
    })
  );
});
