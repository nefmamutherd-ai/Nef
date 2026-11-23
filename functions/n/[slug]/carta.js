// /n/<slug>/carta → la carta del negocio (SSR: se ve completa sin esperar JS). public/assets/carta.js agrega
// pestañas que siguen el scroll, la hoja de detalle y "Elige por mí".
import { rpc, esc, html, redirigir, paginaError, urlSegura } from '../../../lib/util.js';
import { paquete } from '../../../lib/sectores.js';
import { inicioPagina, firma, icono } from '../../../lib/portal.js';

const pesos = (n) => '$' + new Intl.NumberFormat('es-CO').format(n || 0);
const mayuscula = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);

function producto(p) {
  const foto = urlSegura(p.foto_url);
  return `<button type="button" class="pt-prod${p.agotado ? ' agotado' : ''}" data-id="${esc(p.id)}">
    <div class="pt-tx"><b>${esc(p.nombre)}</b>${p.agotado ? '<span class="pt-agotado">Agotado hoy</span>' : p.descripcion ? `<small>${esc(p.descripcion)}</small>` : ''}
    <span class="pt-precio">${pesos(p.precio)}</span></div>
    ${foto ? `<img class="pt-foto" src="${esc(foto)}" alt="" width="76" height="76" loading="lazy" decoding="async">` : ''}</button>`;
}

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const slug = String(params.slug || '').toLowerCase();
  const t = (url.searchParams.get('t') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  let n, c;
  try {
    [n, c] = await Promise.all([rpc(env, 'negocio_publico', { p_slug: slug }), rpc(env, 'carta_publica', { p_slug: slug })]);
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }
  if (!n) return redirigir(new URL('/inactivo', url).href);
  const secciones = [...(c && c.categorias) || []];
  if (c && c.otros && c.otros.length) secciones.push({ id: 'otros', nombre: 'Otros', productos: c.otros });
  if (!secciones.length) return redirigir(new URL(`/n/${encodeURIComponent(n.slug)}`, url).href);

  const titulo = mayuscula(paquete(n.sector).palabras.catalogo);
  const todos = secciones.flatMap((s) => s.productos);
  // Datos para la hoja y "Elige por mí" (JSON seguro dentro de <script>)
  const datos = JSON.stringify(todos.map((p) => ({ ...p, foto_url: urlSegura(p.foto_url) }))).replace(/</g, '\\u003c');

  return html(`${inicioPagina(n, { titulo: `${titulo} · ${n.nombre}`, extraHead: '<script src="/api/config"></script>' })}
<main class="pt-pagina" id="carta" data-slug="${esc(n.slug)}" data-tag="${esc(t)}">
  <div class="pt-fija">
    <div class="pt-barra">
      <a class="pt-volver" href="/n/${encodeURIComponent(n.slug)}${t ? `?t=${esc(t)}` : ''}" aria-label="Volver">${icono('volver')}</a>
      <h1>${esc(titulo)}</h1>
      <button type="button" class="pt-ayuda" id="elige">${icono('estrella')}Elige por mí</button>
    </div>
    ${secciones.length > 1 ? `<nav class="pt-pestanas" role="tablist">${secciones.map((s, i) =>
      `<button type="button" role="tab" data-cat="${esc(s.id)}" aria-selected="${i === 0}">${esc(s.nombre)}</button>`).join('')}</nav>` : ''}
  </div>
  ${secciones.map((s) => `<section class="pt-seccion" id="cat-${esc(s.id)}" data-cat="${esc(s.id)}">
    <h2 class="pt-categoria">${esc(s.nombre)}</h2>${s.productos.map(producto).join('')}</section>`).join('')}

  <div class="pt-fondo" hidden></div>
  <div class="pt-hoja" id="hoja-detalle" role="dialog" aria-label="Detalle" hidden>
    <img class="pt-foto-grande" id="d-foto" alt="" hidden>
    <h2 id="d-nombre"></h2>
    <span class="pt-precio" id="d-precio"></span>
    <span class="pt-agotado" id="d-agotado" hidden>Agotado hoy</span>
    <p id="d-desc"></p>
    <button type="button" class="pt-link" data-cerrar>Cerrar</button>
  </div>

  <div class="pt-fondo" hidden></div>
  <div class="pt-hoja" id="hoja-elige" role="dialog" aria-label="Elige por mí" hidden>
    <h2>¿Qué se te antoja?</h2>
    <div class="pt-botones" id="antojos"></div>
    <div id="giro" hidden>
      <div class="pt-ruleta"><div class="pt-rollo" id="rollo"></div></div>
      <span class="pt-precio" id="g-precio"></span>
      <p class="pt-frase" id="g-frase" hidden></p>
      <div class="pt-dos" id="g-acciones" hidden>
        <button type="button" class="pt-accion marca" id="lo-pido">Lo pido</button>
        <button type="button" class="pt-accion" id="otra-vez">Otra vez</button>
      </div>
    </div>
    <div class="pt-vacio" id="g-vacio" hidden><b>Hoy no hay opciones para ese antojo</b>Prueba con otro.</div>
    <button type="button" class="pt-link" data-cerrar>Cerrar</button>
  </div>
  <script type="application/json" id="datos-carta">${datos}</script>
  ${firma()}
</main>
<script type="module" src="/assets/carta.js"></script>
</body></html>`);
}
