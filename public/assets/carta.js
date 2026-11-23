// Carta: pestañas que siguen el scroll, hoja de detalle y "Elige por mí".
// Datos → textContent. Girar NO da monedas ni premios (regla 2): solo sugiere un plato.
import { rpc, hoja } from '/assets/nef-rpc.js';
import { ANTOJOS, elegir, candidatos } from '/assets/elegir.js';

const raiz = document.getElementById('carta');
const slug = raiz.dataset.slug;
const tag = raiz.dataset.tag || null;
const $ = (id) => document.getElementById(id);
const productos = JSON.parse($('datos-carta').textContent || '[]');
const porId = new Map(productos.map((p) => [p.id, p]));
const pesos = (n) => '$' + new Intl.NumberFormat('es-CO').format(n || 0);
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
const evento = (tipo, producto = null) => rpc('registrar_evento_carta', { p_slug: slug, p_tipo: tipo, p_producto: producto, p_tag: tag }).catch(() => {});

evento('ver_carta');

// ── Pestañas: tocar → ir a la sección; hacer scroll → se marca la visible ──────────
const pestanas = [...document.querySelectorAll('.pt-pestanas [data-cat]')];
const marcar = (cat) => pestanas.forEach((b) => {
  const activa = b.dataset.cat === cat;
  b.setAttribute('aria-selected', String(activa));
  if (activa) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
});
let saltando = false;
pestanas.forEach((b) => b.addEventListener('click', () => {
  saltando = true;
  marcar(b.dataset.cat);
  $('cat-' + b.dataset.cat).scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'start' });
  setTimeout(() => (saltando = false), 700);
}));
if (pestanas.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entradas) => {
    if (saltando) return;
    const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (visible) marcar(visible.target.dataset.cat);
  }, { rootMargin: '-130px 0px -55% 0px' });
  document.querySelectorAll('.pt-seccion').forEach((s) => io.observe(s));
}

// ── Hoja de detalle (cierra con fondo, Escape, "Cerrar" y el botón atrás del celular) ──
const detalle = hoja($('hoja-detalle'));
let conHistoria = false;
function abrirDetalle(p) {
  const foto = $('d-foto');
  foto.hidden = !p.foto_url;
  if (p.foto_url) { foto.src = p.foto_url; foto.alt = p.nombre; }
  $('d-nombre').textContent = p.nombre;
  $('d-precio').textContent = pesos(p.precio);
  $('d-agotado').hidden = !p.agotado;
  $('d-desc').textContent = p.descripcion || '';
  detalle.abrir();
  history.pushState({ hoja: 'detalle' }, '');
  conHistoria = true;
  evento('ver_producto', p.id);
}
document.querySelectorAll('.pt-prod[data-id]').forEach((b) => b.addEventListener('click', () => {
  const p = porId.get(b.dataset.id);
  if (p) abrirDetalle(p);
}));
window.addEventListener('popstate', () => { if (!$('hoja-detalle').hidden) { conHistoria = false; detalle.cerrar(); } });
const cerrarDetalle = () => { if (conHistoria) { conHistoria = false; history.back(); } };
$('hoja-detalle').querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrarDetalle));
$('hoja-detalle').previousElementSibling.addEventListener('click', cerrarDetalle);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('hoja-detalle').hidden) cerrarDetalle(); });

// ── Elige por mí: el resultado se decide ANTES de animar ───────────────────────────
const elige = hoja($('hoja-elige'));
let antojo = 'sorpresa';
let elegido = null;
for (const a of ANTOJOS) {
  if (a.id !== 'sorpresa' && !candidatos(productos, a.id).length) continue; // solo antojos con opciones
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pt-boton';
  b.dataset.antojo = a.id;
  const s = document.createElement('span');
  s.textContent = a.texto;
  b.append(s);
  b.addEventListener('click', () => { antojo = a.id; girar(); });
  $('antojos').append(b);
}
$('elige').addEventListener('click', () => {
  $('antojos').hidden = false;
  $('giro').hidden = true;
  $('g-vacio').hidden = true;
  elige.abrir();
});

function girar() {
  elegido = elegir(productos, antojo);
  $('antojos').hidden = true;
  $('g-acciones').hidden = true;
  $('g-frase').hidden = true;
  $('g-precio').textContent = '';
  if (!elegido) { $('g-vacio').hidden = false; $('antojos').hidden = false; return; }
  $('g-vacio').hidden = true;
  $('giro').hidden = false;
  evento('girar', elegido.id);
  // Rollo: nombres al azar de los candidatos y, al final, el elegido
  const c = candidatos(productos, antojo);
  const nombres = reducido ? [] : Array.from({ length: 14 }, () => c[Math.floor(Math.random() * c.length)].nombre);
  nombres.push(elegido.nombre);
  const rollo = $('rollo');
  rollo.textContent = '';
  for (const nom of nombres) { const d = document.createElement('div'); d.textContent = nom; rollo.append(d); }
  rollo.style.transition = 'none';
  rollo.style.transform = 'translateY(0)';
  const fin = () => {
    $('g-precio').textContent = pesos(elegido.precio);
    $('g-acciones').hidden = false;
    const r = document.querySelector('.pt-ruleta');
    r.classList.remove('pt-celebra'); void r.offsetWidth; r.classList.add('pt-celebra');
  };
  if (reducido) { fin(); return; }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    rollo.style.transition = 'transform 2200ms cubic-bezier(.12,.8,.2,1)';
    rollo.style.transform = `translateY(-${(nombres.length - 1) * 84}px)`;
  }));
  rollo.addEventListener('transitionend', fin, { once: true });
}
$('otra-vez').addEventListener('click', girar);
$('lo-pido').addEventListener('click', () => {
  if (!elegido) return;
  evento('ruleta_acepto', elegido.id);
  $('g-acciones').hidden = true;
  const f = $('g-frase');
  f.textContent = 'Muéstrale esto a quien te atiende.';
  f.hidden = false;
});
