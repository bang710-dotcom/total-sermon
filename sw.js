/* 토탈 설교 앱 — 오프라인 셸 캐시 */
var CACHE = 'tsa-v560';         /* 앱 셸 — 버전마다 교체(index.html 등) */
var CONTENT = 'tsa-content-v1';   /* 대용량 콘텐츠 — 버전 업에도 유지(매번 재다운로드 방지) */
var ASSETS = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
/* ill-index(색인)·ill-story(전문 샤드, 해시 파일명=불변)도 콘텐츠 캐시 — v444 */
var CONTENT_RE = /(illustrations(-archive)?\.json$|ill-index\.json$|ill-story-[^\/]+\.json$|\/bible\/|\/commentary\/|\/fonts\/|\/devo_assets\/)/;

self.addEventListener('install', function (e) {
  e.waitUntil(Promise.all([
    /* cache:'reload'로 HTTP 캐시를 우회해 항상 서버 최신본을 셸에 담는다(구본 고착 방지) */
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) { return c.add(new Request(u, { cache: 'reload' })); }));
    }),
    /* 예화 색인·아카이브는 콘텐츠 캐시에 선적재 — 이미 있으면 재다운로드하지 않음
       (v444: 단일 illustrations.json 선적재 → 경량 ill-index.json 으로 교체.
        전문 샤드는 앱이 백그라운드에서 받고, illustrations.json 은 폴백·성경앱용으로만 남음) */
    caches.open(CONTENT).then(function (c) {
      return Promise.all(['./ill-index.json', './illustrations-archive.json'].map(function (u) {
        return c.match(u).then(function (hit) { return hit ? null : c.add(u); }).catch(function () {});
      }));
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

  /* ★ v513: 앱 루트가 아닌 하위 페이지(예: /retreat/)는 셸 캐시에 넣지 않는다.
     기존 코드는 같은 오리진의 '모든' navigate 응답을 './index.html' 로 저장해,
     하위 페이지를 한 번 열면 오프라인 진입 시 그 페이지가 앱 대신 뜨는 문제가 있었다. */
  var ROOT = new URL('./', self.registration.scope).pathname;
  var isAppEntry = (url.pathname === ROOT || url.pathname === ROOT + 'index.html');

  /* 앱 진입(index.html)은 네트워크 우선 → 새 버전이 첫 실행에 바로 적용.
     오프라인일 때만 캐시 사용 */
  if (isAppEntry && (e.request.mode === 'navigate' || /index\.html$/.test(url.pathname) || url.pathname.slice(-1) === '/')) {
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
     illustrations*.json·ill-index.json 은 갱신될 수 있어 캐시 응답 후 백그라운드로 새 버전을
     받아 둔다(SWR). ill-story-* 샤드는 해시 파일명(불변)이라 순수 캐시 우선으로 충분. */
  if (CONTENT_RE.test(url.pathname)) {
    e.respondWith(
      caches.open(CONTENT).then(function (c) {
        return c.match(e.request).then(function (hit) {
          var isIll = /(illustrations(-archive)?|ill-index)\.json$/.test(url.pathname);
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
