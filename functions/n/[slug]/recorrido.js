// /n/<slug>/recorrido → plano del gimnasio en 3D (Jacobo, 26/11/2026): las máquinas en su lugar del piso, animadas,
// con un buscador; al elegir una, la cámara vuela hasta ella y ofrece "Ver cómo se usa" (la página de la máquina, que
// es la misma a la que lleva el NFC o el QR pegado en la máquina). Por ahora el piso es el de la demostración
// (scripts/maquinas_glb.py recorrido); el plano real de cada gimnasio se arma con ellos.
import { rpc, esc, html, redirigir, paginaError } from '../../../lib/util.js';
import { inicioPagina, firma, icono } from '../../../lib/portal.js';

// Dónde está cada máquina en el piso de la demo (mismas posiciones que PLANO en scripts/maquinas_glb.py, en metros).
// glTF usa Y hacia arriba: el punto de Blender (x, y) queda en (x, -y) sobre el piso.
const PLANO = {
  'press-pecho': [-2.7, 1.5], jalon: [0, 1.6], extension: [2.6, 1.6], 'prensa-45': [-2.7, -1.6], mancuernas: [2.6, -2.1],
};
const lugar = (modelo) => {
  const m = /\/([a-z0-9-]+)\.glb$/.exec(modelo || '');
  return m && PLANO[m[1]] ? PLANO[m[1]] : null;
};

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const slug = String(params.slug || '').toLowerCase();
  let n, maquinas;
  try {
    [n, maquinas] = await Promise.all([rpc(env, 'negocio_publico', { p_slug: slug }), rpc(env, 'maquinas_publicas', { p_slug: slug })]);
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }
  if (!n) return redirigir(new URL('/inactivo', url).href);
  if (n.sector !== 'gimnasio') return redirigir(new URL(`/n/${encodeURIComponent(n.slug)}`, url).href);
  const s = encodeURIComponent(n.slug);
  const lista = (maquinas || []).map((m) => ({ ...m, pos: lugar(m.modelo_url) }));
  const puntos = lista.filter((m) => m.pos).map((m, k) =>
    `<button type="button" class="pt-punto" slot="hotspot-${k}" data-id="${esc(m.id)}" data-position="${m.pos[0]}m 2.45m ${-m.pos[1]}m" data-normal="0m 1m 0m">${esc(m.nombre)}</button>`).join('');
  const filas = lista.map((m) =>
    `<button type="button" class="pt-maq" data-id="${esc(m.id)}" data-nombre="${esc(m.nombre.toLowerCase())}"${m.pos ? ` data-x="${m.pos[0]}" data-y="${m.pos[1]}"` : ''}>` +
    `<b>${esc(m.nombre)}</b>${m.descripcion ? `<small>${esc(m.descripcion)}</small>` : ''}</button>`).join('');

  return html(`${inicioPagina(n, { titulo: `Plano del gimnasio · ${n.nombre}` })}
<main class="pt-pagina pt-recorrido">
  <div class="pt-barra"><a class="pt-volver" href="/n/${s}" aria-label="Volver">${icono('volver')}</a><h1>Encuentra tu máquina</h1><span></span></div>
  <div class="pt-3d pt-3d-maquina pt-plano" id="m-3d">
    <div class="pt-3d-carga"><i class="pt-3d-giro"></i><span>Cargando el gimnasio…</span></div>
    <model-viewer id="plano" src="/assets/demo/3d/gym/recorrido.glb" alt="Plano del gimnasio en 3D" camera-controls autoplay
      camera-orbit="-25deg 52deg 16m" camera-target="0m 0.4m 0m" min-camera-orbit="auto 20deg 3m" max-camera-orbit="auto 80deg 22m" field-of-view="30deg"
      touch-action="pan-y" interaction-prompt="none" interpolation-decay="160" shadow-intensity="1" environment-image="neutral" exposure="1.1">${puntos}</model-viewer>
    <button type="button" class="pt-plano-todo" id="todo" hidden>Ver todo el gimnasio</button>
  </div>
  <div class="pt-elegida" id="elegida" hidden>
    <div><small class="pt-versalitas">Está aquí</small><b id="el-nombre"></b></div>
    <a class="pt-accion marca" id="el-ir" href="#">Ver cómo se usa</a>
  </div>
  <label class="pt-buscar pt-buscar-maq">${icono('buscar')}<input id="buscar" type="search" placeholder="Busca una máquina" autocomplete="off" enterkeyhint="search"></label>
  <div class="pt-maquinas" id="maquinas">${filas || '<p class="pt-vacio">Aún no hay máquinas en el plano.</p>'}</div>
  <p class="pt-nota-plano">En la máquina, acerca tu celular o escanea su QR para ver cómo se usa.</p>
  ${firma()}
</main>
<script type="module">
  const caja = document.getElementById('m-3d'), mv = document.getElementById('plano');
  const $ = (id) => document.getElementById(id);
  const INICIO = { orbita: mv.getAttribute('camera-orbit'), centro: mv.getAttribute('camera-target') };
  mv.addEventListener('load', () => caja.classList.add('listo'), { once: true });
  import('/assets/vendor/model-viewer/model-viewer.min.js').catch(() => {});
  const ir = (id) => '/n/${s}/p/' + encodeURIComponent(id);
  function elegir(b) {
    document.querySelectorAll('.pt-maq.activa, .pt-punto.activo').forEach((x) => x.classList.remove('activa', 'activo'));
    b.classList.add('activa');
    const punto = document.querySelector('.pt-punto[data-id="' + b.dataset.id + '"]');
    if (punto) punto.classList.add('activo');
    $('el-nombre').textContent = b.querySelector('b').textContent;
    $('el-ir').href = ir(b.dataset.id);
    $('elegida').hidden = false;
    if (b.dataset.x !== undefined) {
      mv.cameraTarget = b.dataset.x + 'm 0.9m ' + (-Number(b.dataset.y)) + 'm';
      mv.cameraOrbit = '-20deg 58deg 6m';
      $('todo').hidden = false;
      caja.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    try { navigator.vibrate && navigator.vibrate(12); } catch (e) { /* nada */ }
  }
  document.querySelectorAll('.pt-maq').forEach((b) => b.addEventListener('click', () => elegir(b)));
  document.querySelectorAll('.pt-punto').forEach((p) => p.addEventListener('click', () => {
    const b = document.querySelector('.pt-maq[data-id="' + p.dataset.id + '"]');
    if (b) elegir(b);
  }));
  $('todo').addEventListener('click', () => {
    mv.cameraTarget = INICIO.centro; mv.cameraOrbit = INICIO.orbita; $('todo').hidden = true;
  });
  $('buscar').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
    const filas = [...document.querySelectorAll('.pt-maq')];
    filas.forEach((b) => { b.hidden = q && !b.dataset.nombre.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').includes(q); });
    const visibles = filas.filter((b) => !b.hidden);
    if (q && visibles.length === 1) elegir(visibles[0]);
  });
</script>
</body></html>`);
}
