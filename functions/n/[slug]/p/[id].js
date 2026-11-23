// /n/<slug>/p/<id> → ficha de un producto. Para máquinas: video 16:9 (sin reproducirse solo) + 3 pasos.
import { rpc, esc, html, redirigir, paginaError, urlSegura } from '../../../../lib/util.js';
import { inicioPagina, firma, icono } from '../../../../lib/portal.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// YouTube solo con youtube-nocookie.com; otro link http/https se muestra como <video>
function video(url) {
  const u = urlSegura(url);
  if (!u) return '';
  const yt = /^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(u);
  if (yt) return `<iframe class="pt-video" src="https://www.youtube-nocookie.com/embed/${esc(yt[1])}" title="Video" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  return `<video class="pt-video" src="${esc(u)}" controls playsinline preload="none"></video>`;
}

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const slug = String(params.slug || '').toLowerCase();
  const id = String(params.id || '');
  const portal = new URL(`/n/${encodeURIComponent(slug)}`, url).href;
  if (!UUID.test(id)) return redirigir(portal);
  let n, p, otras;
  try {
    [n, p, otras] = await Promise.all([
      rpc(env, 'negocio_publico', { p_slug: slug }),
      rpc(env, 'producto_publico', { p_slug: slug, p_id: id }),
      rpc(env, 'maquinas_publicas', { p_slug: slug }),
    ]);
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }
  if (!n) return redirigir(new URL('/inactivo', url).href);
  if (!p) return redirigir(portal);

  const pasos = (Array.isArray(p.pasos) ? p.pasos : []).filter((x) => typeof x === 'string' && x.trim());
  const demas = (otras || []).filter((m) => m.id !== p.id);

  return html(`${inicioPagina(n, { titulo: `${p.nombre} · ${n.nombre}` })}
<main class="pt-pagina">
  <header class="pt-cabeza"><h1>${esc(p.nombre)}</h1><p>${esc(n.nombre)}</p></header>
  ${video(p.video_url)}
  ${p.descripcion ? `<p class="pt-frase">${esc(p.descripcion)}</p>` : ''}
  ${pasos.length ? `<ol class="pt-pasos">${pasos.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
  ${demas.length ? `<button type="button" class="pt-accion" id="otras">Ver otras máquinas</button>` : `<a class="pt-accion" href="/n/${encodeURIComponent(n.slug)}">Volver</a>`}
  ${demas.length ? `<div class="pt-fondo" hidden></div>
  <div class="pt-hoja" id="hoja-otras" role="dialog" aria-label="Otras máquinas" hidden>
    <h2>Otras máquinas</h2>
    ${demas.map((m) => `<a class="pt-prod" href="/n/${encodeURIComponent(n.slug)}/p/${esc(m.id)}"><div class="pt-tx"><b>${esc(m.nombre)}</b></div>${icono('flecha')}</a>`).join('')}
    <button type="button" class="pt-link" data-cerrar>Cerrar</button>
  </div>
  <script type="module">
    import { hoja } from '/assets/nef-rpc.js';
    const h = hoja(document.getElementById('hoja-otras'));
    document.getElementById('otras').addEventListener('click', h.abrir);
  </script>` : ''}
  ${firma()}
</main>
</body></html>`);
}
