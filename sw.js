/* 토탈 설교 앱 — 오프라인 셸 캐시 */
var CACHE = 'tsa-v17';
var ASSETS = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  /* API 호출(script.google.com)은 항상 네트워크 사용 */
  if (url.origin !== location.origin) return;

  /* 앱 진입(index.html)은 네트워크 우선 → 새 버전이 첫 실행에 바로 적용.
     오프라인일 때만 캐시 사용 */
  if (e.request.mode === 'navigate' || /index\.html$/.test(url.pathname) || url.pathname.slice(-1) === '/') {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  /* 그 외 정적 파일은 캐시 우선 */
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        if (e.request.method === 'GET' && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      });
    })
  );
});
