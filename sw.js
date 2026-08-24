/* Registros · Cometas XVII — caché de la app de administración */
const CACHE = 'cometas-adm-v2';
const ARCHIVOS = ['./', './index.html', './styles.css', './app.js', './marca.js',
                  './fondo.png', './icon-192.png', './icon-512.png', './manifest.webmanifest',
                  './vendor/jspdf.umd.min.js', './vendor/jspdf.autotable.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Los datos del backend nunca se cachean.
  if (e.request.method !== 'GET' || /script\.google\.com/.test(url.host)) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok && url.origin === location.origin) {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
      }
      return r;
    }).catch(() => hit))
  );
});
