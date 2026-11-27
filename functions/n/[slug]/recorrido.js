// /n/<slug>/recorrido → "Encuentra tu máquina" (Jacobo, 27/11/2026): el PLANO del piso visto desde arriba, como el piso
// real por el que uno camina: entrada con "Estás aquí", recepción, vestidores y zonas. Al elegir una máquina (en el
// plano o con el buscador) se dibuja la ruta desde la entrada y se dice dónde queda ("al fondo a la izquierda, en la
// zona de pierna · unos 18 pasos"); "Ver cómo se usa" abre su página (la misma del NFC o QR pegado en la máquina).
// Por ahora el plano es el de la demostración: el de cada gimnasio se dibuja con ellos. Colores: los de la piel.
import { rpc, esc, html, redirigir, paginaError, fotoSegura } from '../../../lib/util.js';
import { inicioPagina, firma, icono } from '../../../lib/portal.js';

// Piso de 20 × 14 m (1 unidad = 1 m). La entrada está abajo en el centro.
const PISO = { ancho: 20, alto: 14, entrada: [10, 14] };
const ZONAS = [
  { nombre: 'Zona de pierna', x: 0.6, y: 0.6, w: 8.2, h: 5.6 },
  { nombre: 'Cardio', x: 0.6, y: 7, w: 8.2, h: 3.6 },
  { nombre: 'Pecho y espalda', x: 11.2, y: 4.2, w: 8.2, h: 4.8 },
  { nombre: 'Peso libre', x: 11.2, y: 9.8, w: 8.2, h: 3.6 },
];
const SALAS = [
  { nombre: 'Vestidores', x: 14.4, y: 0, w: 5.6, h: 3.4 },
  { nombre: 'Recepción', x: 0.6, y: 11.4, w: 4.6, h: 2.2 },
];
// Puestos del plano; cada máquina del gimnasio cae en uno por su nombre
const PUESTOS = [
  { clave: /prensa/i, x: 1.4, y: 1.4, w: 2.4, h: 3.6, zona: 'Zona de pierna' },
  { clave: /extensi/i, x: 5.2, y: 1.6, w: 1.9, h: 1.9, zona: 'Zona de pierna' },
  { clave: /press/i, x: 12, y: 5, w: 1.9, h: 2.2, zona: 'Pecho y espalda' },
  { clave: /jal[oó]n/i, x: 14.7, y: 5, w: 1.9, h: 2.2, zona: 'Pecho y espalda' },
  { clave: /remo/i, x: 17.3, y: 5, w: 1.6, h: 2.4, zona: 'Pecho y espalda' },
  { clave: /mancuern/i, x: 12.4, y: 11.6, w: 5.4, h: 1.2, zona: 'Peso libre' },
  { clave: /caminad|cardio|el[ií]ptic|bici/i, x: 1.4, y: 7.6, w: 1.2, h: 2.4, zona: 'Cardio', extra: [[3.2, 7.6], [5, 7.6]] },
];

// "Al fondo a la izquierda, en la zona de pierna" + pasos desde la entrada (por el pasillo central)
function indicaciones(p) {
  const cx = p.x + p.w / 2, frente = p.y + p.h + 0.5;
  const lado = cx < 8 ? 'a la izquierda' : cx > 12 ? 'a la derecha' : 'al frente';
  const fondo = frente < 6.5 ? 'Al fondo' : frente < 10.5 ? 'En la mitad' : 'Cerca de la entrada';
  const metros = (PISO.entrada[1] - frente) + Math.abs(cx - PISO.entrada[0]);
  return { texto: `${fondo} ${lado}, en la zona de ${p.zona.replace(/^Zona de /, '').toLowerCase()}`, pasos: Math.max(4, Math.round(metros / 0.75)),
    ruta: [[PISO.entrada[0], PISO.entrada[1] - 0.2], [PISO.entrada[0], frente], [cx, frente]] };
}

// En el plano va el nombre corto ("Press", "Jalón", "Remo"): los completos se montaban unos sobre otros
const corto = (nombre) => String(nombre).replace(/^(rack|m[aá]quina) de /i, '').split(/\s+/)[0].replace(/^./, (c) => c.toUpperCase());

function plano(lista) {
  const E = 10; // escala del dibujo: 1 m = 10 unidades del SVG
  const r = (o, cls, extra = '') => `<rect class="${cls}" x="${o.x * E}" y="${o.y * E}" width="${o.w * E}" height="${o.h * E}" rx="6"${extra}/>`;
  const zonas = ZONAS.map((z) => r(z, 'pl-zona') + `<text class="pl-zona-txt" x="${(z.x + 0.4) * E}" y="${(z.y + 0.9) * E}">${esc(z.nombre)}</text>`).join('');
  const salas = SALAS.map((z) => r(z, 'pl-sala') + `<text class="pl-sala-txt" x="${(z.x + z.w / 2) * E}" y="${(z.y + z.h / 2 + 0.25) * E}">${esc(z.nombre)}</text>`).join('');
  const maquinas = lista.filter((m) => m.puesto).map((m) => {
    const p = m.puesto;
    const piezas = [[p.x, p.y], ...(p.extra || [])].map(([x, y]) => r({ x, y, w: p.w, h: p.h }, 'pl-maq-forma')).join('');
    return `<g class="pl-maq" data-id="${esc(m.id)}" tabindex="0" role="button" aria-label="${esc(m.nombre)}">${piezas}` +
      `<text class="pl-maq-txt" x="${(p.x + p.w / 2) * E}" y="${(p.y + p.h + 0.75) * E}">${esc(corto(m.nombre))}</text></g>`;
  }).join('');
  const [ex, ey] = PISO.entrada;
  return `<svg class="pl-svg" viewBox="-6 -6 ${PISO.ancho * E + 12} ${PISO.alto * E + 30}" role="img" aria-label="Plano del gimnasio">
    <rect class="pl-piso" x="0" y="0" width="${PISO.ancho * E}" height="${PISO.alto * E}" rx="10"/>
    <path class="pl-pasillo" d="M${ex * E} ${ey * E - 4} V${0.8 * E}"/>
    ${zonas}${salas}
    <path class="pl-muro" d="M${(ex - 1.2) * E} ${PISO.alto * E} H10 Q0 ${PISO.alto * E} 0 ${PISO.alto * E - 10} V10 Q0 0 10 0 H${PISO.ancho * E - 10} Q${PISO.ancho * E} 0 ${PISO.ancho * E} 10 V${PISO.alto * E - 10} Q${PISO.ancho * E} ${PISO.alto * E} ${PISO.ancho * E - 10} ${PISO.alto * E} H${(ex + 1.2) * E}"/>
    <path class="pl-ruta" id="pl-ruta" d=""/>
    ${maquinas}
    <g class="pl-aqui" transform="translate(${ex * E} ${ey * E + 4})"><circle class="pl-aqui-onda" r="7"/><circle class="pl-aqui-punto" r="5"/></g>
    <text class="pl-aqui-txt" x="${ex * E}" y="${ey * E + 20}">Estás aquí · Entrada</text>
  </svg>`;
}

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
  const usados = new Set();
  const lista = (maquinas || []).map((m) => {
    const puesto = PUESTOS.find((p) => !usados.has(p) && p.clave.test(m.nombre));
    if (puesto) usados.add(puesto);
    return { ...m, puesto, guia: puesto ? { ...indicaciones(puesto), foto: fotoSegura(m.foto_url) || null } : (fotoSegura(m.foto_url) ? { foto: fotoSegura(m.foto_url) } : null) };
  });
  const datos = Object.fromEntries(lista.map((m) => [m.id, m.guia]));
  const filas = lista.map((m) =>
    `<button type="button" class="pt-maq" data-id="${esc(m.id)}" data-nombre="${esc(m.nombre.toLowerCase())}">` +
    `<b>${esc(m.nombre)}</b><small>${esc(m.puesto ? m.puesto.zona : 'Pregunta en recepción')}</small></button>`).join('');

  return html(`${inicioPagina(n, { titulo: `Encuentra tu máquina · ${n.nombre}` })}
<main class="pt-pagina pt-recorrido">
  <div class="pt-barra"><a class="pt-volver" href="/n/${s}" aria-label="Volver">${icono('volver')}</a><h1>Encuentra tu máquina</h1><span></span></div>
  <div class="pl-marco">${plano(lista)}</div>
  <div class="pt-elegida" id="elegida" hidden aria-live="polite">
    <img class="pl-foto" id="el-foto" alt="" width="96" height="96" hidden>
    <div><small class="pt-versalitas" id="el-zona"></small><b id="el-nombre"></b><p class="pl-guia" id="el-guia"></p></div>
    <a class="pt-accion marca" id="el-ir" href="#">Ver cómo se usa</a>
  </div>
  <label class="pt-buscar pt-buscar-maq">${icono('buscar')}<input id="buscar" type="search" placeholder="Busca una máquina" autocomplete="off" enterkeyhint="search"></label>
  <div class="pt-maquinas" id="maquinas">${filas || '<p class="pt-vacio">Aún no hay máquinas en el plano.</p>'}</div>
  <p class="pt-nota-plano">En la máquina, acerca tu celular o escanea su QR para ver cómo se usa.</p>
  ${firma()}
</main>
<script type="module">
  const GUIA = ${JSON.stringify(datos).replace(/</g, '\\u003c')};
  const $ = (id) => document.getElementById(id);
  const ruta = $('pl-ruta');
  const sinTilde = (t) => t.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
  function elegir(id, mover) {
    document.querySelectorAll('.pt-maq.activa, .pl-maq.activa').forEach((x) => x.classList.remove('activa'));
    const fila = document.querySelector('.pt-maq[data-id="' + id + '"]');
    const enPlano = document.querySelector('.pl-maq[data-id="' + id + '"]');
    if (fila) fila.classList.add('activa');
    if (enPlano) enPlano.classList.add('activa');
    const g = GUIA[id];
    $('el-nombre').textContent = fila ? fila.querySelector('b').textContent : '';
    const enMapa = g && g.ruta;
    $('el-zona').textContent = enMapa ? 'Está aquí' : 'No está en el plano';
    $('el-guia').textContent = enMapa ? g.texto + ' · unos ' + g.pasos + ' pasos desde la entrada.' : 'Pregunta en recepción dónde está.';
    const foto = $('el-foto');
    if (g && g.foto) { foto.src = g.foto; foto.hidden = false; foto.classList.remove('entra'); void foto.offsetWidth; foto.classList.add('entra'); } else foto.hidden = true;
    const tarjeta = $('elegida'); tarjeta.classList.remove('entra'); void tarjeta.offsetWidth; tarjeta.classList.add('entra');
    $('el-ir').href = '/n/${s}/p/' + encodeURIComponent(id);
    $('elegida').hidden = false;
    if (enMapa) {
      ruta.setAttribute('d', 'M' + g.ruta.map((p) => p[0] * 10 + ' ' + p[1] * 10).join(' L'));
      ruta.classList.remove('dibuja'); void ruta.getBBox(); ruta.classList.add('dibuja');
    } else ruta.setAttribute('d', '');
    if (mover) document.querySelector('.pl-marco').scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { navigator.vibrate && navigator.vibrate(12); } catch (e) { /* nada */ }
  }
  document.querySelectorAll('.pt-maq').forEach((b) => b.addEventListener('click', () => elegir(b.dataset.id, true)));
  document.querySelectorAll('.pl-maq').forEach((g) => {
    g.addEventListener('click', () => elegir(g.dataset.id, false));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(g.dataset.id, false); } });
  });
  $('buscar').addEventListener('input', (e) => {
    const q = sinTilde(e.target.value.trim().toLowerCase());
    const filas = [...document.querySelectorAll('.pt-maq')];
    filas.forEach((b) => { b.hidden = q && !sinTilde(b.dataset.nombre).includes(q); });
    const visibles = filas.filter((b) => !b.hidden);
    if (q && visibles.length === 1) elegir(visibles[0].dataset.id, true);
  });
</script>
</body></html>`);
}
