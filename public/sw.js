// Service worker mínimo de Nef: hace "instalable" el portal de los negocios que lo permiten (gimnasios, 27/11/2026).
// No guarda nada en caché: todo sigue viniendo fresco del servidor (la carta, los agotados, las clases).
// Si no hay internet al abrir la app, muestra un aviso en vez de la página de error del navegador.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Sin conexión</title><body style="font:17px system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;padding:24px;text-align:center;color:#222">' +
    '<div><b style="font-size:22px">Sin conexión</b><p>Revisa tu internet y vuelve a abrir la app.</p></div></body>',
    { headers: { 'content-type': 'text/html; charset=utf-8' } })));
});
