/* 三合棋牌 Service Worker
   页面与脚本用「网络优先」：联网时总能拿到最新版本，断网时回落到缓存；
   图标等静态资源用「缓存优先」。 */
const CACHE = 'sanhe-qipai-v14';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './js/vendor/motion.js', './js/core.js', './js/baque.js', './js/douxian.js', './js/sanguo.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

const isFresh = req =>
  req.mode === 'navigate' || /\.(js|html|webmanifest)(\?|$)/.test(new URL(req.url).pathname + new URL(req.url).search);

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const req = e.request;
  if (isFresh(req)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const cp = res.clone();
          caches.open(CACHE).then(c => c.put(req, cp));
        }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(req, cp));
      }
      return res;
    }))
  );
});
