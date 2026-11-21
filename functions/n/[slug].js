// /n/<slug> → portal del negocio (SSR). Se arma en el servidor para que cargue al instante después del toque.
// Estructura: docs/UI.md §3 · Componentes: public/assets/portal.css · Textos y botones: lib/sectores/*.json
import { rpc, esc, urlDeBoton, colorSeguro, html, redirigir, paginaError, urlSegura } from '../../lib/util.js';
import { paquete, botonesPortal } from '../../lib/sectores.js';

// Íconos de trazo (docs/UI.md §5)
const ICONOS = {
  lista: '<path d="M4 5h16M4 12h16M4 19h10"/>',
  monedas: '<circle cx="12" cy="12" r="8"/>',
  estrella: '<path d="m12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/>',
  calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16"/>',
  reproducir: '<path d="m8 5 11 7-11 7z"/>',
  flecha: '<path d="m9 6 6 6-6 6"/>',
};
const icono = (k, clase = '') => `<svg class="pt-icono${clase}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[k] || ''}</svg>`;

const COLOR_POR_DEFECTO = '#1f1f1f'; // el negocio no eligió color: se usa el del tema del sector

// Texto blanco o negro según qué tan claro sea el color de la marca
function textoSobre(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? '#111111' : '#ffffff';
}

const mayuscula = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const iniciales = (nombre) =>
  String(nombre || '?').trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase() || '?';

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const slug = String(params.slug || '').toLowerCase();
  const t = (url.searchParams.get('t') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);

  let n, nombreTag = null;
  try {
    [n, nombreTag] = await Promise.all([
      rpc(env, 'negocio_publico', { p_slug: slug }),
      t ? rpc(env, 'tag_publico', { p_slug: slug, p_codigo: t }) : null,
    ]);
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }
  if (!n) return redirigir(new URL('/inactivo', url).href);

  const pq = paquete(n.sector);
  const q = t ? `?t=${t}` : '';
  const href = (b) => `/c/${encodeURIComponent(n.slug)}/${b}${q}`;
  const conTag = (ruta) => (ruta.startsWith('/c/') ? ruta + q : ruta);

  // Color del negocio (si eligió uno); si no, el del tema del sector
  const color = colorSeguro(n.color);
  const propio = color.toLowerCase() !== COLOR_POR_DEFECTO;
  const estiloMarca = propio ? `<style>:root{--marca:${color};--sobre-marca:${textoSobre(color)}}</style>` : '';

  // Botones grandes (máximo 3, el primero principal)
  const botones = botonesPortal(n).map((b, i) =>
    `<a class="pt-boton${i === 0 ? ' principal' : ''}" href="${esc(conTag(b.ruta))}" data-boton="${esc(b.id)}">` +
    `${icono(b.icono)}<span>${esc(b.texto)}</span>${icono('flecha', ' pt-flecha')}</a>`
  );

  // Enlaces de texto (lo secundario). Todos pasan por /c/<slug>/<boton> para contar el clic.
  const enlaces = [];
  const enBotones = new Set(botonesPortal(n).map((b) => b.requiere));
  if (urlDeBoton(n, 'menu') && !enBotones.has('menu_url')) enlaces.push(`<a href="${href('menu')}">${esc(mayuscula(pq.palabras.catalogo))}</a>`);
  if (n.wifi_nombre) {
    enlaces.push(`<details id="wifi"><summary>WiFi</summary>
      <div class="pt-fondo" data-cerrar></div>
      <div class="pt-hoja" role="dialog" aria-label="WiFi">
        <h2>Conéctate al WiFi</h2>
        <div class="pt-dato"><small>Red</small><b>${esc(n.wifi_nombre)}</b></div>
        ${n.wifi_clave
          ? `<div class="pt-dato"><small>Clave</small><b id="clave">${esc(n.wifi_clave)}</b></div>
             <button type="button" class="pt-accion" id="copiar">Copiar clave</button>`
          : `<div class="pt-dato"><small>Clave</small><b>Red abierta, sin clave</b></div>`}
        <button type="button" class="pt-link" data-cerrar>Cerrar</button>
      </div></details>`);
  }
  if (urlDeBoton(n, 'whatsapp')) enlaces.push(`<a href="${href('whatsapp')}">WhatsApp</a>`);
  if (urlDeBoton(n, 'instagram')) enlaces.push(`<a href="${href('instagram')}">Instagram</a>`);
  (Array.isArray(n.links) ? n.links : []).forEach((l, i) => {
    if (l && l.titulo && urlSegura(l.url)) enlaces.push(`<a href="${href('link' + i)}">${esc(l.titulo)}</a>`);
  });

  const logo = urlSegura(n.logo_url)
    ? `<div class="pt-logo"><img src="${esc(urlSegura(n.logo_url))}" alt=""></div>`
    : `<div class="pt-logo" aria-hidden="true">${esc(iniciales(n.nombre))}</div>`;
  const debajo = nombreTag || n.ubicacion_etiqueta || n.descripcion || '';

  return html(`<!doctype html><html lang="es" data-tema="${esc(pq.tema)}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(n.nombre)}</title>
${n.descripcion ? `<meta name="description" content="${esc(n.descripcion)}">` : ''}
${propio ? `<meta name="theme-color" content="${color}">` : ''}
<link rel="stylesheet" href="/assets/tokens.css"><link rel="stylesheet" href="/assets/portal.css">
${estiloMarca}
</head><body class="pt"><main class="pt-pagina">
  <header class="pt-cabeza">${logo}<h1>${esc(n.nombre)}</h1>${debajo ? `<p>${esc(debajo)}</p>` : ''}</header>
  ${botones.length ? `<div class="pt-botones">${botones.join('')}</div>` : ''}
  ${enlaces.length ? `<nav class="pt-enlaces">${enlaces.join('')}</nav>` : ''}
  <footer class="pt-firma"><a href="/">Hecho con <img src="/assets/marca/logo-nef-una-tinta.svg" alt="nef" width="38" height="14"></a></footer>
</main>
<script>
  (function () {
    var w = document.getElementById('wifi');
    if (!w) return;
    var hoja = w.querySelector('.pt-hoja'), fondo = w.querySelector('.pt-fondo'), avisado = false;
    function abrir() {
      requestAnimationFrame(function () { requestAnimationFrame(function () { hoja.classList.add('abierta'); fondo.classList.add('abierta'); }); });
      if (!avisado) { avisado = true; try { navigator.sendBeacon(${JSON.stringify(href('wifi'))}); } catch (e) {} }
    }
    function cerrar() {
      hoja.classList.remove('abierta'); fondo.classList.remove('abierta');
      setTimeout(function () { w.open = false; }, 300);
    }
    w.addEventListener('toggle', function () { if (w.open) abrir(); });
    w.querySelectorAll('[data-cerrar]').forEach(function (b) { b.addEventListener('click', cerrar); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && w.open) cerrar(); });
    if (location.hash === '#wifi') w.open = true;
    var b = document.getElementById('copiar');
    if (b) b.addEventListener('click', function () {
      var c = document.getElementById('clave').textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(function () { b.textContent = '¡Copiada!'; }, function () {
        var r = document.createRange(); r.selectNodeContents(document.getElementById('clave'));
        var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selecciónala y cópiala';
      });
    });
  })();
</script>
</body></html>`);
}
