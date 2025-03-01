// الإصدار الحالي للتطبيق (تغييره عند تحديث الملفات)
const CACHE_VERSION = 'v1.3';
const CACHE_NAME = `finance-app-${CACHE_VERSION}`;

// قائمة بالموارد الأساسية التي يجب تخزينها مؤقتًا
const PRE_CACHE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/icons/icon-72x72.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/fallback.html'
];

// استراتيجيات التخزين المؤقت لأنواع الملفات المختلفة
const CACHE_STRATEGIES = {
  static: {
    match: ({ url }) => url.pathname.startsWith('/static/'),
    handler: 'CacheFirst'
  },
  images: {
    match: ({ url }) => /\.(png|jpg|jpeg|webp|svg)$/i.test(url.pathname),
    handler: 'StaleWhileRevalidate'
  },
  api: {
    match: ({ url }) => url.pathname.startsWith('/api/'),
    handler: 'NetworkFirst'
  }
};

// ========== أحداث Service Worker ========== //

// حدث التثبيت الأولي
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('جارٍ تخزين الموارد الأساسية...');
        return cache.addAll(PRE_CACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// حدث التنشيط
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('جاري إزالة الذاكرة المؤقتة القديمة:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// حدث الجلب (Fetch)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // تجاهل الطلبات غير GET وطلبات chrome-extension
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension://')) {
    return;
  }

  // تحديد الاستراتيجية المناسبة
  const strategy = Object.values(CACHE_STRATEGIES).find(s => s.match(request));
  
  event.respondWith(
    strategy ? handleRequest(event, strategy.handler) : networkOnly(request)
  );
});

// ========== استراتيجيات التخزين المؤقت ========== //

async function handleRequest(event, strategy) {
  try {
    switch(strategy) {
      case 'NetworkFirst':
        return await networkFirst(event);
      case 'CacheFirst':
        return await cacheFirst(event);
      case 'StaleWhileRevalidate':
        return await staleWhileRevalidate(event);
      default:
        return await networkOnly(event.request);
    }
  } catch (error) {
    console.error('فشل في معالجة الطلب:', error);
    return fallbackResponse();
  }
}

async function networkFirst(event) {
  try {
    const networkResponse = await fetch(event.request);
    const cache = await caches.open(CACHE_NAME);
    await cache.put(event.request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(event.request);
    return cachedResponse || fallbackResponse();
  }
}

async function cacheFirst(event) {
  const cachedResponse = await caches.match(event.request);
  if (cachedResponse) return cachedResponse;
  
  const networkResponse = await fetch(event.request);
  const cache = await caches.open(CACHE_NAME);
  await cache.put(event.request, networkResponse.clone());
  return networkResponse;
}

async function staleWhileRevalidate(event) {
  const cachePromise = caches.open(CACHE_NAME);
  const cachedResponse = await caches.match(event.request);
  
  const networkPromise = fetch(event.request).then(networkResponse => {
    cachePromise.then(cache => cache.put(event.request, networkResponse.clone()));
    return networkResponse;
  });

  return cachedResponse || networkPromise;
}

async function networkOnly(request) {
  return fetch(request);
}

function fallbackResponse() {
  return caches.match('/fallback.html') || Response.json({ error: 'لا يوجد اتصال بالإنترنت' });
}

// ========== الخلفية المزامنة ========== //
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  // أضف هنا منطق مزامنة البيانات مع الخادم
}
