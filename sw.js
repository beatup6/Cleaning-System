/* 설비 Cleaning Check Sheet - 오프라인 캐시 서비스워커
   업데이트 배포 시 아래 버전 번호를 올리면 모든 기기에 새 파일이 적용됩니다. */
const CACHE = 'ccs-v1';
const SHELL = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;

  // 기준사진/완료사진: 캐시 우선, 없으면 네트워크 후 캐시 저장 (오프라인에서도 한번 본 사진은 표시)
  if (url.includes('/storage/v1/object/public/cleaning-ref/') ||
      url.includes('/storage/v1/object/public/cleaning-photos/')) {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        try {
          const res = await fetch(e.request);
          if (res.ok) c.put(e.request, res.clone());
          return res;
        } catch (err) {
          return new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  // 페이지/라이브러리: 네트워크 우선, 실패 시 캐시 (항상 최신 유지 + 오프라인 동작)
  if (e.request.mode === 'navigate' || SHELL.some(s => url.startsWith(s) || url === s) ||
      url.includes('cdn.jsdelivr.net') || url.includes('cdnjs.cloudflare.com')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() =>
        caches.match(e.request).then(hit => hit ||
          (e.request.mode === 'navigate' ? caches.match('./index.html') : new Response('', { status: 504 })))
      )
    );
  }
});
