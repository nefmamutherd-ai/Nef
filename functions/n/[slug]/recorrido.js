// /n/<slug>/recorrido → "Recorrido del gimnasio · Próximamente" (Jacobo, 26/11/2026). Solo vista previa: un piso en 3D
// con las 5 máquinas (scripts/maquinas_glb.py recorrido). Aún no es funcional: se muestra para vender la idea.
import { rpc, esc, html, redirigir, paginaError } from '../../../lib/util.js';
import { inicioPagina, firma, icono } from '../../../lib/portal.js';

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const slug = String(params.slug || '').toLowerCase();
  let n;
  try {
    n = await rpc(env, 'negocio_publico', { p_slug: slug });
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }
  if (!n) return redirigir(new URL('/inactivo', url).href);
  if (n.sector !== 'gimnasio') return redirigir(new URL(`/n/${encodeURIComponent(n.slug)}`, url).href);

  return html(`${inicioPagina(n, { titulo: `Recorrido del gimnasio · ${n.nombre}` })}
<main class="pt-pagina pt-recorrido">
  <div class="pt-barra"><a class="pt-volver" href="/n/${encodeURIComponent(n.slug)}" aria-label="Volver">${icono('volver')}</a><h1>Recorrido</h1><span></span></div>
  <p class="pt-pronto">Próximamente</p>
  <div class="pt-3d pt-3d-maquina" id="m-3d">
    <div class="pt-3d-carga"><i class="pt-3d-giro"></i><span>Cargando el gimnasio…</span></div>
    <model-viewer src="/assets/demo/3d/gym/recorrido.glb" alt="Recorrido del gimnasio en 3D" camera-controls auto-rotate auto-rotate-delay="1200"
      rotation-per-second="10deg" camera-orbit="-30deg 58deg auto" min-camera-orbit="auto 25deg auto" max-camera-orbit="auto 80deg auto"
      touch-action="pan-y" interaction-prompt="none" shadow-intensity="1" environment-image="neutral" exposure="1.1"></model-viewer>
    <p class="pt-3d-ayuda">Gíralo y acércate con dos dedos</p>
  </div>
  <ul class="pt-recorrido-lista">
    <li>${icono('lugar')}<span><b>Encuentra cada máquina</b> en el mapa de ${esc(n.nombre)}.</span></li>
    <li>${icono('reproducir')}<span><b>Toca una máquina</b> y mira cómo se usa, en 3D.</span></li>
    <li>${icono('monedas')}<span><b>Entrena con el tutorial</b> y gana monedas.</span></li>
  </ul>
  <a class="pt-accion" href="/n/${encodeURIComponent(n.slug)}">Volver</a>
  ${firma()}
</main>
<script type="module">
  const caja = document.getElementById('m-3d'), mv = caja.querySelector('model-viewer');
  mv.addEventListener('load', () => caja.classList.add('listo'), { once: true });
  import('/assets/vendor/model-viewer/model-viewer.min.js').catch(() => {});
</script>
</body></html>`);
}
