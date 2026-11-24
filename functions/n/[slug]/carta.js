// /n/<slug>/carta → la carta del negocio (SSR: se ve completa sin esperar JS). Estilo carta impresa:
// categorías numeradas, el plato estrella con foto grande, los demás con foto redonda y "nombre ······ precio".
// public/assets/carta.js agrega pestañas que siguen el scroll, la hoja de detalle y "Elige por mí".
import { rpc, esc, html, redirigir, paginaError, fotoSegura, modeloSeguro } from '../../../lib/util.js';
import { paquete } from '../../../lib/sectores.js';
import { inicioPagina, firma, icono } from '../../../lib/portal.js';

const pesos = (n) => '$' + new Intl.NumberFormat('es-CO').format(n || 0);
const mayuscula = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);

function estrella(p) {
  const foto = fotoSegura(p.foto_url);
  return `<button type="button" class="pt-prod pt-estrella pt-revela${p.agotado ? ' agotado' : ''}" data-id="${esc(p.id)}">
    ${foto ? `<img src="${esc(foto)}" alt="${esc(p.nombre)}" width="600" height="375" loading="lazy" decoding="async">` : '<span class="pt-sin-foto"></span>'}
    <div class="pt-tx"><span class="pt-sello">La de la casa</span><b>${esc(p.nombre)}</b>
    ${p.agotado ? '<span class="pt-agotado">Agotado hoy</span>' : p.descripcion ? `<small>${esc(p.descripcion)}</small>` : ''}
    <span class="pt-precio">${pesos(p.precio)}</span></div></button>`;
}

function plato(p) {
  const foto = fotoSegura(p.foto_url);
  return `<button type="button" class="pt-prod pt-revela${p.agotado ? ' agotado' : ''}" data-id="${esc(p.id)}">
    ${foto ? `<img class="pt-foto" src="${esc(foto)}" alt="" width="84" height="84" loading="lazy" decoding="async">` : '<span class="pt-foto"></span>'}
    <div class="pt-tx"><div class="pt-linea"><b>${esc(p.nombre)}</b><i></i><span class="pt-precio">${pesos(p.precio)}</span></div>
    ${p.agotado ? '<span class="pt-agotado">Agotado hoy</span>' : p.descripcion ? `<small>${esc(p.descripcion)}</small>` : ''}</div></button>`;
}

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const slug = String(params.slug || '').toLowerCase();
  const t = (url.searchParams.get('t') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  let n, c, pop;
  try {
    [n, c, pop] = await Promise.all([rpc(env, 'negocio_publico', { p_slug: slug }), rpc(env, 'carta_publica', { p_slug: slug }),
      rpc(env, 'carta_populares', { p_slug: slug })]);
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }
  if (!n) return redirigir(new URL('/inactivo', url).href);
  const secciones = [...((c && c.categorias) || [])];
  if (c && c.otros && c.otros.length) secciones.push({ id: 'otros', nombre: 'Otros', productos: c.otros });
  if (!secciones.length) return redirigir(new URL(`/n/${encodeURIComponent(n.slug)}`, url).href);

  const titulo = mayuscula(paquete(n.sector).palabras.catalogo);
  const todos = secciones.flatMap((s) => s.productos);
  // Datos para la hoja y "Elige por mí" (JSON seguro dentro de <script>)
  const datos = JSON.stringify(todos.map((p) => ({ ...p, foto_url: fotoSegura(p.foto_url), modelo_url: modeloSeguro(p.modelo_url) }))).replace(/</g, '\\u003c');
  // En cada categoría, el primer plato destacado (y disponible) va con foto grande
  const cuerpo = (s) => {
    const i = s.productos.findIndex((p) => p.destacado && !p.agotado);
    return s.productos.map((p, k) => (k === i ? estrella(p) : plato(p))).join('');
  };

  // "Lo más pedido": carrusel con fotos grandes (solo si hay al menos 2 con foto)
  const populares = (pop || []).filter((p) => fotoSegura(p.foto_url));
  const carrusel = populares.length >= 2 ? `<section class="pt-populares pt-entra" aria-label="Lo más pedido">
    <h2 class="pt-versalitas">Lo más pedido</h2>
    <div class="pt-carrusel">${populares.map((p) => `<button type="button" class="pt-pop" data-id="${esc(p.id)}">
      <img src="${esc(fotoSegura(p.foto_url))}" alt="" width="300" height="300" loading="lazy" decoding="async"><b>${esc(p.nombre)}</b><span class="pt-precio">${pesos(p.precio)}</span></button>`).join('')}</div>
  </section>` : '';

  return html(`${inicioPagina(n, { titulo: `${titulo} · ${n.nombre}`, extraHead: '<script src="/api/config"></script>' })}
<main class="pt-pagina" id="carta" data-slug="${esc(n.slug)}" data-tag="${esc(t)}">
  <header class="pt-carta-cabeza pt-entra">
    <a class="pt-volver" href="/n/${encodeURIComponent(n.slug)}${t ? `?t=${esc(t)}` : ''}" aria-label="Volver">${icono('volver')}</a>
    <span class="pt-versalitas">${esc(n.nombre)}</span>
    <h1>${esc(titulo)}</h1>
    <div class="pt-filete" aria-hidden="true"><i></i></div>
    <button type="button" class="pt-elige" id="elige">${icono('dado')}Elige por mí</button>
  </header>
  ${carrusel}
  ${secciones.length > 1 ? `<div class="pt-fija"><nav class="pt-pestanas" role="tablist">${secciones.map((s, i) =>
    `<button type="button" role="tab" data-cat="${esc(s.id)}" aria-selected="${i === 0}">${esc(s.nombre)}</button>`).join('')}</nav></div>` : ''}
  ${secciones.map((s, i) => `<section class="pt-seccion" id="cat-${esc(s.id)}" data-cat="${esc(s.id)}">
    <h2 class="pt-categoria"><small>${String(i + 1).padStart(2, '0')}</small>${esc(s.nombre)}</h2>${cuerpo(s)}</section>`).join('')}

  <div class="pt-fondo" hidden></div>
  <div class="pt-hoja" id="hoja-detalle" role="dialog" aria-label="Detalle" hidden>
    <div class="pt-vista" id="d-vista">
      <img class="pt-foto-grande" id="d-foto" alt="" hidden>
      <div class="pt-3d" id="d-3d" hidden></div>
      <button type="button" class="pt-girar" id="d-girar" hidden><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg><span> Girar en 3D</span></button>
    </div>
    <h2 id="d-nombre"></h2>
    <span class="pt-precio" id="d-precio"></span>
    <span class="pt-agotado" id="d-agotado" hidden>Agotado hoy</span>
    <p id="d-desc"></p>
    <button type="button" class="pt-link" data-cerrar>Cerrar</button>
  </div>

  <div class="pt-fondo" hidden></div>
  <div class="pt-hoja" id="hoja-elige" role="dialog" aria-label="Elige por mí" hidden>
    <h2 id="e-titulo">¿Qué se te antoja?</h2>
    <div class="pt-antojos" id="antojos"></div>
    <div id="giro" hidden>
      <div class="pt-maquina" id="maquina">
        <div class="pt-marquesina" aria-hidden="true">La suerte de la casa</div>
        <div class="pt-luces" aria-hidden="true"><i style="--k:0"></i><i style="--k:1"></i><i style="--k:2"></i><i style="--k:3"></i><i style="--k:4"></i><i style="--k:5"></i><i style="--k:6"></i><i style="--k:7"></i><i style="--k:8"></i><i style="--k:9"></i><i style="--k:10"></i></div>
        <div class="pt-gabinete">
          <span class="pt-flecha" aria-hidden="true"></span><span class="pt-flecha der" aria-hidden="true"></span>
          <div class="pt-ruleta"><div class="pt-rollo" id="rollo"></div><div class="pt-ventana" aria-hidden="true"></div></div>
          <div class="pt-estampa" aria-hidden="true">Para ti</div>
        </div>
        <div class="pt-luces abajo" aria-hidden="true"><i style="--k:0"></i><i style="--k:1"></i><i style="--k:2"></i><i style="--k:3"></i><i style="--k:4"></i><i style="--k:5"></i><i style="--k:6"></i><i style="--k:7"></i><i style="--k:8"></i><i style="--k:9"></i><i style="--k:10"></i></div>
        <div class="pt-bandeja" aria-hidden="true"><span>1 giro · gratis</span><i></i><span>Solo sugiere</span></div>
        <div class="pt-palanca" aria-hidden="true"><i></i><b></b></div>
        <div class="pt-confeti" id="confeti" aria-hidden="true"></div>
      </div>
      <div class="pt-resultado" id="g-resultado" hidden>
        <span class="pt-precio" id="g-precio"></span>
        <p class="pt-frase" id="g-frase" hidden></p>
      </div>
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
