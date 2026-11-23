// /n/<slug> → portal del negocio (SSR). Se arma en el servidor para que cargue al instante después del toque.
// Estructura: docs/UI.md §3 · Componentes: public/assets/portal.css · Textos y botones: lib/sectores/*.json
import { rpc, esc, urlDeBoton, html, redirigir, paginaError, urlSegura } from '../../lib/util.js';
import { paquete, botonesPortal } from '../../lib/sectores.js';
import { inicioPagina, firma, icono } from '../../lib/portal.js';

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

  // Botones grandes (máximo 3, el primero principal)
  const botones = botonesPortal(n).map((b, i) =>
    `<a class="pt-boton${i === 0 ? ' principal' : ''}" href="${esc(conTag(b.ruta))}" data-boton="${esc(b.id)}">` +
    `<i class="pt-ico">${icono(b.icono)}</i><span>${esc(b.texto)}</span>${b.detalle ? `<em>${esc(b.detalle)}</em>` : ''}${icono('flecha', ' pt-flecha')}</a>`
  );

  // Enlaces de texto (lo secundario). Todos pasan por /c/<slug>/<boton> para contar el clic.
  const enlaces = [];
  const hayCatalogo = botonesPortal(n).some((b) => b.servicio === 'catalogo');
  if (urlDeBoton(n, 'menu') && !hayCatalogo) enlaces.push(`<a href="${href('menu')}">${esc(mayuscula(pq.palabras.catalogo))}</a>`);
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
  const lugar = nombreTag || n.ubicacion_etiqueta || '';

  return html(`${inicioPagina(n, { extraHead: n.descripcion ? `<meta name="description" content="${esc(n.descripcion)}">` : '' })}
<main class="pt-pagina">
  <header class="pt-cabeza pt-portada pt-entra">${logo}<h1>${esc(n.nombre)}</h1>${lugar ? `<p class="pt-versalitas pt-lugar">${esc(lugar)}</p>` : ''}<div class="pt-filete" aria-hidden="true"><i></i></div>${n.descripcion ? `<p class="pt-versalitas">${esc(n.descripcion)}</p>` : ''}</header>
  ${botones.length ? `<div class="pt-botones pt-entra">${botones.join('')}</div>` : ''}
  ${enlaces.length ? `<nav class="pt-enlaces pt-puntos">${enlaces.join('')}</nav>` : ''}
  ${firma()}
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
