// /n/<slug> → portal del negocio (SSR). Se arma en el servidor para que cargue al instante después del toque.
// Estructura: docs/UI.md §3 · Componentes: public/assets/portal.css · Textos y botones: lib/sectores/*.json
import { rpc, esc, urlDeBoton, html, redirigir, paginaError, urlSegura, fotoSegura } from '../../lib/util.js';
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
  // Vista previa del admin: cambia solo la ropa (tema) y el color, nunca datos
  const vista = url.searchParams.get('vista');
  const colorVista = url.searchParams.get('color');
  if (['calido', 'noche', 'limpio', 'energia'].includes(vista)) n = { ...n, tema: vista };
  if (/^#[0-9a-f]{6}$/i.test(colorVista || '')) n = { ...n, color: colorVista };
  const conCarta = !!(n.servicios && n.servicios.catalogo && n.tiene_carta);
  let pop = [];
  if (conCarta) { try { pop = (await rpc(env, 'carta_populares', { p_slug: slug })) || []; } catch { pop = []; } }

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
  const carta = `/n/${encodeURIComponent(n.slug)}/carta${q}`;
  // "Elige por mí" en la portada (pedido de Jacobo): abre la tragamonedas de la carta de una
  const elige = conCarta ? `<a class="pt-baldosa pt-baldosa-elige" href="${esc(carta)}#elige"><i class="pt-dado">${icono('dado')}</i><span>Elige por mí</span><em>Que la suerte decida</em></a>` : '';
  const fotos = (pop || []).filter((p) => fotoSegura(p.foto_url)).slice(0, 8);
  const populares = fotos.length >= 2 ? `<section class="pt-populares pt-entra" aria-label="Lo más pedido"><h2 class="pt-versalitas">Lo más pedido</h2>
    <div class="pt-carrusel">${fotos.map((p) => `<a class="pt-pop" href="${esc(carta)}"><img src="${esc(fotoSegura(p.foto_url))}" alt="" width="300" height="300" loading="lazy" decoding="async"><b>${esc(p.nombre)}</b></a>`).join('')}</div></section>` : '';
  // Fondo vivo (tema cálido): manchas de color que se mueven y dibujos de comida flotando. Solo decoración.
  const DOODLES = ['<path d="M5 9h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M9 3c0 2 2 2 2 4"/>',
    '<path d="M3 15c2-6 6-9 9-9s7 3 9 9c-3 2-6 2-9 2s-6 0-9-2zM8 8l2 8M16 8l-2 8M12 6v11"/>',
    '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 13v8M17 3c-2 0-3 3-3 7h3v11"/>',
    '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
    '<path d="M4 14a8 8 0 0 0 16 0zM8 10c0-2 1-3 2-4M12 10c0-2 1-4 3-5"/>'];
  const deco = `<div class="pt-deco" aria-hidden="true"><i class="pt-mancha uno"></i><i class="pt-mancha dos"></i><i class="pt-mancha tres"></i>${
    DOODLES.map((d, k) => `<svg class="pt-doodle d${k}" viewBox="0 0 24 24">${d}</svg>`).join('')}</div>`;

  return html(`${inicioPagina(n, { extraHead: n.descripcion ? `<meta name="description" content="${esc(n.descripcion)}">` : '' })}
${deco}
<main class="pt-pagina pt-inicio">
  <header class="pt-cabeza pt-portada pt-entra">${logo}<h1>${esc(n.nombre)}</h1>${lugar ? `<p class="pt-versalitas pt-lugar">${esc(lugar)}</p>` : ''}<div class="pt-filete" aria-hidden="true"><i></i></div>${n.descripcion ? `<p class="pt-versalitas">${esc(n.descripcion)}</p>` : ''}</header>
  ${botones.length || elige ? `<div class="pt-botones pt-entra">${botones.join('')}${elige}</div>` : ''}
  ${populares}
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
