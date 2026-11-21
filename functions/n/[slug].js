// /n/<slug> → página del negocio (menú, reseñas, WhatsApp, WiFi, redes...)
// Se arma en el servidor para que cargue al instante después del toque.
import { rpc, esc, urlDeBoton, colorSeguro, html, redirigir, paginaError, urlSegura } from '../../lib/util.js';

const ICONOS = {
  menu: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z"/><path d="M8 7h6M8 11h6"/>',
  resena: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  whatsapp: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9.5 9.5c.3 2 2 3.8 4 4.2l1-1 1.8.8-.4 1.5c-3.3.4-6.7-3-6.4-6.3l1.5-.4.8 1.8z"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19.5" r=".8"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const icono = (k) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[k]}</svg>`;

// Texto blanco o negro según qué tan claro sea el color de la marca
function textoSobre(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? '#111' : '#fff';
}

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const slug = String(params.slug || '').toLowerCase();
  const t = (url.searchParams.get('t') || '').replace(/[^a-z0-9]/g, '').slice(0, 16);

  let n;
  try {
    n = await rpc(env, 'negocio_publico', { p_slug: slug });
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }
  if (!n) return redirigir(new URL('/inactivo', url).href);

  const color = colorSeguro(n.color);
  const sobre = textoSobre(color);
  const q = t ? `?t=${t}` : '';
  const href = (b) => `/c/${encodeURIComponent(n.slug)}/${b}${q}`;

  const botones = [];
  if (urlDeBoton(n, 'menu')) botones.push(`<a class="btn principal" href="${href('menu')}">${icono('menu')}<span>Ver el menú</span></a>`);
  if (urlDeBoton(n, 'resena'))
    botones.push(`<a class="btn resena" href="${href('resena')}">${icono('resena')}<span>Déjanos tu reseña en Google</span></a>`);
  if (urlDeBoton(n, 'whatsapp')) botones.push(`<a class="btn" href="${href('whatsapp')}">${icono('whatsapp')}<span>Escríbenos por WhatsApp</span></a>`);
  if (n.wifi_nombre)
    botones.push(`<details class="btn wifi" id="wifi"><summary>${icono('wifi')}<span>Conéctate al WiFi</span></summary>
      <div class="wifi-datos"><div><small>Red</small><b>${esc(n.wifi_nombre)}</b></div>
      ${n.wifi_clave ? `<div><small>Contraseña</small><b id="clave">${esc(n.wifi_clave)}</b></div><button type="button" id="copiar">Copiar contraseña</button>` : '<div><small>Red abierta, sin contraseña</small></div>'}
      </div></details>`);
  if (urlDeBoton(n, 'instagram')) botones.push(`<a class="btn" href="${href('instagram')}">${icono('instagram')}<span>Síguenos en Instagram</span></a>`);
  (Array.isArray(n.links) ? n.links : []).forEach((l, i) => {
    if (l && l.titulo && urlSegura(l.url)) botones.push(`<a class="btn" href="${href('link' + i)}">${icono('link')}<span>${esc(l.titulo)}</span></a>`);
  });

  const logo = urlSegura(n.logo_url)
    ? `<img class="logo" src="${esc(urlSegura(n.logo_url))}" alt="">`
    : `<div class="logo inicial">${esc((n.nombre || '?').trim().charAt(0).toUpperCase())}</div>`;
  const marca = esc(env.MARCA || 'Nef');

  return html(`<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="${color}">
<title>${esc(n.nombre)}</title>
<style>
  :root { --c: ${color}; --sobre: ${sobre}; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #f4f3ef; color: #1b1b1b; -webkit-font-smoothing: antialiased; }
  .portada { background: var(--c); height: 132px; }
  main { max-width: 440px; margin: -64px auto 0; padding: 0 18px 40px; text-align: center; }
  .logo { width: 104px; height: 104px; border-radius: 50%; object-fit: cover; border: 5px solid #f4f3ef; background: #fff; display: block; margin: 0 auto; }
  .inicial { display: grid; place-items: center; font-size: 44px; font-weight: 700; background: #fff; color: var(--c); }
  h1 { font-size: 26px; margin: 14px 0 6px; letter-spacing: -.01em; }
  .desc { margin: 0 auto 24px; color: #5b5b5b; line-height: 1.45; max-width: 34ch; }
  .botones { display: grid; gap: 12px; text-align: left; }
  .btn { display: flex; align-items: center; gap: 14px; padding: 17px 18px; border-radius: 16px; background: #fff; color: inherit; text-decoration: none;
         font-weight: 600; font-size: 16.5px; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.05); -webkit-tap-highlight-color: transparent; }
  .btn:active { transform: scale(.985); }
  .btn svg { flex: none; }
  .principal { background: var(--c); color: var(--sobre); box-shadow: none; }
  .resena svg { color: #e0a100; fill: #ffc929; stroke: #e0a100; }
  details.btn { display: block; padding: 0; }
  summary { display: flex; align-items: center; gap: 14px; padding: 17px 18px; cursor: pointer; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  .wifi-datos { padding: 0 18px 18px 54px; display: grid; gap: 10px; font-weight: 400; }
  .wifi-datos small { display: block; color: #777; font-size: 13px; }
  .wifi-datos b { font-size: 18px; word-break: break-all; }
  #copiar { justify-self: start; border: 0; border-radius: 10px; padding: 10px 14px; font: inherit; font-weight: 600; background: var(--c); color: var(--sobre); }
  footer { margin-top: 36px; font-size: 12.5px; color: #8a8a8a; }
  footer a { color: inherit; }
</style></head>
<body>
<div class="portada"></div>
<main>
  ${logo}
  <h1>${esc(n.nombre)}</h1>
  ${n.descripcion ? `<p class="desc">${esc(n.descripcion)}</p>` : '<div style="height:18px"></div>'}
  <div class="botones">${botones.join('\n')}</div>
  <footer>Hecho con <a href="/">${marca}</a> · acerca tu celular, sin apps</footer>
</main>
<script>
  (function () {
    var w = document.getElementById('wifi');
    if (!w) return;
    if (location.hash === '#wifi') w.open = true;
    var avisado = false;
    function avisar() { if (w.open && !avisado) { avisado = true; try { navigator.sendBeacon(${JSON.stringify(href('wifi'))}); } catch (e) {} } }
    w.addEventListener('toggle', avisar); avisar();
    var b = document.getElementById('copiar');
    if (b) b.addEventListener('click', function () {
      var c = document.getElementById('clave').textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(function () { b.textContent = '¡Copiada! ✓'; }, function () {
        var r = document.createRange(); r.selectNodeContents(document.getElementById('clave'));
        var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selecciónala y cópiala';
      });
    });
  })();
</script>
</body></html>`);
}
