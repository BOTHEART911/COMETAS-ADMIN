/* Registros · Cometas XVII — caché de la app de administración.
   El nombre del caché sale de version.js: cambiar esa línea basta
   para que todos reciban la versión nueva. */
importScripts('./version.js');

const V     = self.APP_VERSION || '0';
const MARCA = 'cometas-adm-';          // prefijo propio: NUNCA tocar cachés de otras apps del mismo dominio
const CACHE = MARCA + V;
const ARCHIVOS = ['./', './index.html', './styles.css', './app.js', './marca.js', './version.js',
                  './fondo.png', './icon-192.png', './icon-512.png', './manifest.webmanifest',
                  './vendor/jspdf.umd.min.js', './vendor/jspdf.autotable.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks
      .filter(k => k.indexOf(MARCA) === 0 && k !== CACHE)   // solo los míos
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Los datos del backend nunca se cachean.
  if (e.request.method !== 'GET' || /script\.google\.com/.test(url.host)) return;

  // version.js siempre desde la red (así la app se entera de que hay algo nuevo);
  // si no hay internet, se sirve la copia guardada.
  if (url.origin === location.origin && /\/version\.js$/.test(url.pathname)) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r && r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return r;
      }).catch(() => caches.match('./version.js'))
    );
    return;
  }

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
