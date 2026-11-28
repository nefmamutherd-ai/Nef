// /n/<slug>/p/<id> → ficha de un producto. Para máquinas: video 16:9 (sin reproducirse solo) + 3 pasos.
import { rpc, esc, html, redirigir, paginaError, urlSegura, fechaVuelve } from '../../../../lib/util.js';
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

  // Cómo se usa: el video del gimnasio (una persona real) si lo subió; si no, la máquina en 3D animada con un muñeco
  // haciendo el ejercicio (estilo artístico, scripts/maquinas_glb.py), que se gira con el dedo. Solo modelos del propio sitio o https.
  const modelo = /^(https:\/\/[^\s"<>]+|\/assets\/[A-Za-z0-9_/.-]+)\.glb$/.test(p.modelo_url || '') ? p.modelo_url : null;
  const visor = modelo ? `<div class="pt-3d pt-3d-maquina" id="m-3d">
    <div class="pt-3d-carga"><i class="pt-3d-giro"></i><span>Cargando la máquina…</span></div>
    <model-viewer src="${esc(modelo)}" alt="Cómo se usa: ${esc(p.nombre)} en 3D" camera-controls autoplay auto-rotate auto-rotate-delay="4000" rotation-per-second="12deg"
      camera-orbit="-35deg 72deg auto" min-camera-orbit="auto 30deg auto" max-camera-orbit="auto 88deg auto" touch-action="pan-y" disable-pan
      interaction-prompt="none" shadow-intensity="1.1" shadow-softness="0.8" environment-image="neutral" exposure="1.1"></model-viewer>
    <p class="pt-3d-ayuda">Así se usa · gírala con el dedo</p>
  </div>
  <script type="module">
    const caja = document.getElementById('m-3d'), mv = caja.querySelector('model-viewer');
    mv.addEventListener('load', () => caja.classList.add('listo'), { once: true });
    mv.addEventListener('error', () => caja.remove(), { once: true });
    import('/assets/vendor/model-viewer/model-viewer.min.js').catch(() => caja.remove());
  </script>` : '';
  const pasos = (Array.isArray(p.pasos) ? p.pasos : []).filter((x) => typeof x === 'string' && x.trim());
  const demas = (otras || []).filter((m) => m.id !== p.id);
  // Gimnasio con club: "Entrena con el tutorial" (cronómetro + Terminé → monedas). Lo arma public/assets/entreno.js
  // En mantenimiento no se entrena en ella: sin cronómetro ni monedas hasta que el dueño la apague
  const entreno = p.tipo === 'maquina' && !p.mantenimiento && n.servicios && n.servicios.club ? `<section class="pt-entreno" id="entreno" data-slug="${esc(n.slug)}" data-producto="${esc(p.id)}" hidden>
    <h2 class="pt-versalitas">Entrena con el tutorial</h2>
    <div class="pt-entreno-reloj"><b id="e-reloj">15:00</b></div>
    <div class="pt-entreno-barra" aria-hidden="true"><i id="e-barra"></i></div>
    <p class="pt-entreno-estado" id="e-estado" role="status">Entrena con el tutorial y gana monedas.</p>
    <button type="button" class="pt-accion marca" id="e-empezar" hidden>Empezar entrenamiento</button>
    <button type="button" class="pt-accion marca" id="e-terminar" hidden disabled>Terminé</button>
    <a class="pt-accion" id="e-club" href="/n/${encodeURIComponent(n.slug)}/club" hidden>Unirme al club</a>
  </section>
  <script type="module" src="/assets/entreno.js"></script>` : '';

  return html(`${inicioPagina(n, { titulo: `${p.nombre} · ${n.nombre}` })}
<main class="pt-pagina">
  <div class="pt-club-top"><a class="pt-volver" id="volver" href="/n/${encodeURIComponent(n.slug)}">${icono('volver')}${esc(n.nombre)}</a></div>
  <script>
    // Si llegó desde el plano ("Encuentra tu máquina"), volver lo lleva de nuevo al plano; si no, al inicio del gimnasio
    (function () { try { var r = new URL(document.referrer); if (r.origin === location.origin && r.pathname.endsWith('/recorrido')) document.getElementById('volver').href = r.pathname; } catch (e) {} })();
  </script>
  ${p.mantenimiento ? `<div class="pt-mantenimiento" id="aviso-mantenimiento" role="status">${icono('herramienta')}<div><b>Esta máquina está en mantenimiento</b>${p.vuelve && fechaVuelve(p.vuelve) ? `<span>Vuelve el ${esc(fechaVuelve(p.vuelve))}</span>` : '<span>Mientras tanto, puedes ver cómo se usa.</span>'}</div></div>` : ''}
  <header class="pt-cabeza"><h1>${esc(p.nombre)}</h1><p>${esc(n.nombre)}</p></header>
  ${video(p.video_url) || visor}
  ${p.descripcion ? `<p class="pt-frase">${esc(p.descripcion)}</p>` : ''}
  ${pasos.length ? `<ol class="pt-pasos">${pasos.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
  ${entreno}
  ${demas.length ? `<button type="button" class="pt-accion" id="otras">Ver otras máquinas</button>` : `<a class="pt-accion" href="/n/${encodeURIComponent(n.slug)}">Volver</a>`}
  ${demas.length ? `<a class="pt-link" href="/n/${encodeURIComponent(n.slug)}">Volver al inicio</a>` : ''}
  ${demas.length ? `<div class="pt-fondo" hidden></div>
  <div class="pt-hoja" id="hoja-otras" role="dialog" aria-label="Otras máquinas" hidden>
    <h2>Otras máquinas</h2>
    ${demas.map((m) => `<a class="pt-prod${m.mantenimiento ? ' agotado' : ''}" href="/n/${encodeURIComponent(n.slug)}/p/${esc(m.id)}"><div class="pt-tx"><b>${esc(m.nombre)}</b>${m.mantenimiento ? '<span class="pt-agotado">En mantenimiento</span>' : ''}</div>${icono('flecha')}</a>`).join('')}
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
