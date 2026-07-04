/* 토탈 설교 앱 — 오프라인 셸 캐시 */
var CACHE = 'tsa-v393';           /* 앱 셸 — 버전마다 교체(index.html 등) */
var CONTENT = 'tsa-content-v1';   /* 대용량 콘텐츠 — 버전 업에도 유지(매번 재다운로드 방지) */
var ASSETS = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
var CONTENT_RE = /(illustrations\.json$|\/bible\/|\/commentary\/|\/fonts\/|\/devo_assets\/)/;

self.addEventListener('install', function (e) {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }),
    /* 예화 DB는 콘텐츠 캐시에 선적재 — 이미 있으면 재다운로드하지 않음 */
    caches.open(CONTENT).then(function (c) {
      return c.match('./illustrations.json').then(function (hit) { return hit ? null : c.add('./illustrations.json'); });
    }).catch(function () {})
  ]).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== CONTENT; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  /* API 호출(script.google.com 등)은 항상 네트워크 사용 */
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

  /* 대용량 콘텐츠(예화DB·성경·주석·폰트) — 버전과 무관한 영속 캐시 우선.
     illustrations.json만은 갱신될 수 있어 캐시 응답 후 백그라운드로 새 버전을 받아 둔다. */
  if (CONTENT_RE.test(url.pathname)) {
    e.respondWith(
      caches.open(CONTENT).then(function (c) {
        return c.match(e.request).then(function (hit) {
          var isIll = /illustrations\.json$/.test(url.pathname);
          if (hit) {
            if (isIll) fetch(e.request).then(function (res) { if (res.ok) c.put(e.request, res.clone()); }).catch(function () {});
            return hit;
          }
          return fetch(e.request).then(function (res) {
            if (e.request.method === 'GET' && res.ok) c.put(e.request, res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  /* 그 외 정적 파일은 버전 캐시 우선 */
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
