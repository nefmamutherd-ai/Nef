// Carta: aparición al hacer scroll, pestañas que siguen el scroll, hoja de detalle y "Elige por mí" (tragamonedas).
// Datos → textContent. Girar NO da monedas ni premios (regla 2): solo sugiere un plato.
// El resultado se decide ANTES de animar; la animación solo lo muestra.
import { rpc, hoja } from '/assets/nef-rpc.js';
import { ANTOJOS, elegir, candidatos } from '/assets/elegir.js';

document.documentElement.classList.add('con-js');
const raiz = document.getElementById('carta');
const slug = raiz.dataset.slug;
const tag = raiz.dataset.tag || null;
const $ = (id) => document.getElementById(id);
const productos = JSON.parse($('datos-carta').textContent || '[]');
const porId = new Map(productos.map((p) => [p.id, p]));
const pesos = (n) => '$' + new Intl.NumberFormat('es-CO').format(n || 0);
const evento = (tipo, producto = null) => rpc('registrar_evento_carta', { p_slug: slug, p_tipo: tipo, p_producto: producto, p_tag: tag }).catch(() => {});
const SVG = (d) => `<svg class="pt-icono" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICONO_ANTOJO = {
  dulce: '<path d="M4 13h16l-2 7H6z"/><path d="M6 13a6 6 0 0 1 12 0"/><path d="M12 4v3"/>',
  salado: '<path d="M3 12h18"/><path d="M5 12a7 7 0 0 0 14 0"/><path d="M9 8c0-2 1-3 3-4M14 8c0-1.5.6-2.5 2-3"/>',
  bebida: '<path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M9 3v2M13 3v2"/>',
  sorpresa: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01"/>',
};

evento('ver_carta');

// ── Aparecer al hacer scroll (escalonado dentro de cada tanda) ─────────────────────
const porRevelar = [...document.querySelectorAll('.pt-revela')];
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((ents) => {
    ents.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.transitionDelay = `${i * 70}ms`;
      e.target.classList.add('visible');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  porRevelar.forEach((el) => io.observe(el));
} else porRevelar.forEach((el) => el.classList.add('visible'));

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
  $('cat-' + b.dataset.cat).scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => (saltando = false), 800);
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
// ── Vista 3D y realidad aumentada: si el plato tiene modelo, la hoja abre directo en 3D (la foto se ve mientras carga) ──
let visor = null;
const cargarVisor = () => (visor ||= import('/assets/vendor/model-viewer/model-viewer.min.js'));
const VISTA = { inclinacion: 62, min: 35, max: 80 }; // grados desde arriba: nunca se ve el plato por debajo
async function abrir3d(p) {
  const caja = $('d-3d');
  // Pantalla de carga: la foto borrosa de fondo + "Cargando tu plato"; el 3D entra con un fundido cuando está listo
  caja.textContent = '';
  caja.classList.remove('listo');
  const carga = document.createElement('div');
  carga.className = 'pt-3d-carga';
  if (p.foto_url) carga.style.setProperty('--fondo', `url("${encodeURI(p.foto_url)}")`);
  const anim = document.createElement('i'); anim.className = 'pt-3d-giro';
  const txt = document.createElement('span'); txt.textContent = 'Cargando tu plato…';
  carga.append(anim, txt);
  caja.append(carga);
  caja.hidden = false;
  $('d-foto').hidden = true;
  const volverAFoto = () => { if (abierto !== p) return; caja.hidden = true; caja.textContent = ''; $('d-foto').hidden = !p.foto_url; };
  try { await cargarVisor(); } catch { volverAFoto(); return; } // sin red: se queda la foto
  if (abierto !== p) return; // cambiaron de plato mientras cargaba
  const mv = document.createElement('model-viewer');
  const attrs = {
    src: p.modelo_url, alt: `${p.nombre} en 3D`, 'camera-controls': '', 'auto-rotate': '',
    'auto-rotate-delay': '2500', 'rotation-per-second': '20deg', 'camera-orbit': `20deg ${VISTA.inclinacion}deg auto`,
    'min-camera-orbit': `auto ${VISTA.min}deg auto`, 'max-camera-orbit': `auto ${VISTA.max}deg auto`,
    'touch-action': 'none', 'disable-pan': '', 'interpolation-decay': '120',
    'shadow-intensity': '1', 'shadow-softness': '0.9', 'environment-image': 'neutral', exposure: '1.05', 'interaction-prompt': 'none',
  };
  // iPhone: realidad aumentada propia del teléfono (Quick Look), la abre el mismo visor
  if (ES_IPHONE) Object.assign(attrs, { ar: '', 'ar-modes': 'quick-look', 'ar-scale': 'fixed', 'ar-placement': 'floor' });
  for (const [k, v] of Object.entries(attrs)) mv.setAttribute(k, v);
  mv.addEventListener('load', () => caja.classList.add('listo'), { once: true });
  mv.addEventListener('error', volverAFoto, { once: true });
  // Al soltarlo, vuelve solo a la inclinación de siempre (conserva hacia dónde lo giraron de lado)
  let vuelta = null;
  const volver = () => {
    clearTimeout(vuelta);
    vuelta = setTimeout(() => {
      const o = mv.getCameraOrbit && mv.getCameraOrbit();
      if (o) mv.cameraOrbit = `${o.theta}rad ${VISTA.inclinacion}deg auto`;
    }, 1400);
  };
  mv.addEventListener('pointerup', volver);
  mv.addEventListener('pointercancel', volver);
  mv.addEventListener('pointerdown', () => clearTimeout(vuelta));
  caja.prepend(mv);
  if (ES_IPHONE || ES_ANDROID) {
    const ar = document.createElement('button');
    ar.type = 'button'; ar.className = 'pt-ar'; ar.textContent = 'Verlo en tu mesa';
    ar.addEventListener('click', () => verEnMesa(p, mv));
    caja.append(ar);
  }
  evento('ver_3d', p.id);
}
let abierto = null;

const ES_IPHONE = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ES_ANDROID = /Android/i.test(navigator.userAgent);
// En algunos navegadores la pregunta nunca responde: a los 2 s se toma como "no"
const soportaXR = async () => {
  if (!navigator.xr) return false;
  try {
    return !!(await Promise.race([navigator.xr.isSessionSupported('immersive-ar'), new Promise((r) => setTimeout(() => r(false), 2000))]));
  } catch { return false; }
};

// "Verlo en tu mesa": 1) ¿el celular puede? (si no, aviso) 2) paso a paso con dibujos 3) cámara con el círculo para elegir el sitio
async function verEnMesa(p, mv) {
  evento('ver_ar', p.id);
  if (ES_IPHONE) { guiaMesa(() => mv.activateAR()); return; }
  if (await soportaXR()) {
    const modulo = import('/assets/mesa-xr.js'); // se descarga mientras leen la guía
    guiaMesa(() => modulo.then((m) => m.ponerEnMesa(p)).catch(() => avisoNoCompatible()));
    return;
  }
  // Sin la realidad aumentada de Google instalada: la app de Google la ofrece (gratis); si el celular no puede, vuelve aquí
  guiaMesa(() => {
    const glb = new URL(p.modelo_url, location.href).href;
    const regreso = `${location.origin}${location.pathname}#ra-no-compatible-${p.id}`;
    location.href = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(glb)}&mode=ar_only&title=${encodeURIComponent(p.nombre)}`
      + `#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(regreso)};end;`;
  }, true);
}

// Dibujos del paso a paso: líneas azules, sencillos (no realistas). Fijos del código, no datos.
const DIBUJOS = {
  sostener: `<svg viewBox="0 0 220 150" aria-hidden="true" class="pt-guia-svg">
    <path d="M14 112 H206 M40 112 V146 M180 112 V146"/>
    <path d="M36 70 V112 M36 112 H70 V146"/>
    <circle cx="52" cy="30" r="12"/><path d="M52 42 L50 92 L74 96 L74 146"/>
    <path d="M51 56 L86 72"/>
    <g class="pt-guia-cel"><rect x="84" y="56" width="14" height="26" rx="3" transform="rotate(-50 91 69)"/></g>
    <path class="pt-guia-rayo" d="M98 72 L140 110 M96 78 L118 110"/>
    <ellipse cx="132" cy="110" rx="20" ry="4"/>
  </svg>`,
  mover: `<svg viewBox="0 0 220 150" aria-hidden="true" class="pt-guia-svg">
    <path d="M20 140 L200 140 L166 96 L54 96 Z"/>
    <g class="pt-guia-puntos-mesa"><circle cx="80" cy="118" r="1.5"/><circle cx="104" cy="108" r="1.5"/><circle cx="128" cy="124" r="1.5"/><circle cx="150" cy="112" r="1.5"/><circle cx="96" cy="130" r="1.5"/><circle cx="140" cy="132" r="1.5"/></g>
    <g class="pt-guia-vaiven"><rect x="94" y="14" width="32" height="56" rx="6"/><path d="M104 64 H116"/></g>
    <path d="M58 42 H30 M30 42 l9-8 M30 42 l9 8 M162 42 H190 M190 42 l-9-8 M190 42 l-9 8"/>
  </svg>`,
  elegir: `<svg viewBox="0 0 220 150" aria-hidden="true" class="pt-guia-svg">
    <rect x="70" y="4" width="80" height="142" rx="12"/><path d="M74 60 L146 60 M74 60 L70 146 M146 60 L150 146"/>
    <ellipse class="pt-guia-circulo" cx="110" cy="100" rx="24" ry="9"/>
    <rect x="88" y="124" width="44" height="12" rx="6"/><text x="110" y="133" text-anchor="middle">Listo</text>
  </svg>`,
};
const PASOS = [
  { d: 'sostener', t: 'Siéntate y apunta a tu mesa', x: 'Sostén el celular frente a ti, inclinado hacia la mesa, como si fueras a tomarle una foto a un plato. No apuntes al techo.' },
  { d: 'mover', t: 'Muévelo despacio de lado a lado', x: 'Así la cámara reconoce la mesa. Ayuda tener buena luz y una mesa con algo de textura.' },
  { d: 'elegir', t: 'Elige dónde va el plato', x: 'Aparece un círculo sobre la mesa. Mueve el celular hasta donde lo quieres y toca Listo: el plato aparece ahí, a tamaño real.' },
];
const CLAVE_GUIA = 'nef_guia_mesa';
function guiaMesa(abrirCamara, conGoogle = false) {
  try { if (localStorage.getItem(CLAVE_GUIA)) { abrirCamara(); return; } } catch { /* sin almacenamiento: mostrar la guía */ }
  const capa = document.createElement('div');
  capa.className = 'pt-guia';
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-label', 'Cómo ver el plato en tu mesa');
  let i = 0;
  const el = (tag, clase, texto) => { const e = document.createElement(tag); if (clase) e.className = clase; if (texto) e.textContent = texto; return e; };
  const pintar = () => {
    const p = PASOS[i];
    const ultimo = i === PASOS.length - 1;
    const t = el('div', 'pt-guia-tarjeta');
    const dibujo = el('div', 'pt-guia-dibujo');
    dibujo.innerHTML = DIBUJOS[p.d]; // SVG fijo del código, no datos
    const puntos = el('div', 'pt-guia-puntos');
    PASOS.forEach((_, k) => puntos.append(el('i', k === i ? 'activo' : '')));
    const sig = el('button', 'pt-accion', ultimo ? 'Abrir la cámara' : 'Siguiente'); sig.type = 'button'; sig.dataset.sig = '';
    const salir = el('button', 'pt-link', 'Ahora no'); salir.type = 'button'; salir.dataset.salir = '';
    t.append(el('small', 'pt-guia-paso', `Paso ${i + 1} de ${PASOS.length}`), dibujo, el('h2', '', p.t), el('p', 'pt-guia-texto', p.x));
    if (ultimo && conGoogle) {
      const nota = el('p', 'pt-guia-nota', 'Google puede pedirte instalar ');
      nota.append(el('b', '', '"Servicios de Google Play para RA"'), '. Es gratis y solo se hace una vez.');
      t.append(nota);
    }
    t.append(puntos, sig, salir);
    capa.replaceChildren(t);
    capa.querySelector('[data-sig]').addEventListener('click', () => {
      if (!ultimo) { i++; pintar(); return; }
      try { localStorage.setItem(CLAVE_GUIA, '1'); } catch { /* nada */ }
      capa.remove();
      abrirCamara();
    });
    capa.querySelector('[data-salir]').addEventListener('click', () => capa.remove());
  };
  pintar();
  document.body.append(capa);
}

function avisoNoCompatible() {
  const capa = document.createElement('div');
  capa.className = 'pt-guia';
  capa.setAttribute('role', 'alertdialog');
  capa.innerHTML = `<div class="pt-guia-tarjeta"><div class="pt-guia-icono" aria-hidden="true">!</div>
    <h2>No es compatible con tu celular</h2>
    <p class="pt-guia-texto">Tu celular no puede mostrar platos en tu mesa. Puedes seguir viéndolo en 3D: gíralo con el dedo.</p>
    <button type="button" class="pt-accion">Entendido</button></div>`;
  capa.querySelector('button').addEventListener('click', () => capa.remove());
  document.body.append(capa);
}
// Volvió de la app de Google porque el celular no puede → aviso claro, con el plato abierto en 3D
function revisarCompatible() {
  const m = /^#ra-no-compatible-(.+)$/.exec(location.hash);
  if (!m) return;
  history.replaceState(history.state, '', location.pathname + location.search);
  const p = porId.get(m[1]);
  if (p && $('hoja-detalle').hidden) abrirDetalle(p);
  avisoNoCompatible();
}
window.addEventListener('hashchange', revisarCompatible);

function abrirDetalle(p) {
  abierto = p;
  const foto = $('d-foto');
  foto.hidden = !p.foto_url;
  if (p.foto_url) { foto.src = p.foto_url; foto.alt = p.nombre; }
  $('d-3d').hidden = true;
  $('d-3d').textContent = '';
  if (p.modelo_url) abrir3d(p);
  $('d-nombre').textContent = p.nombre;
  $('d-precio').textContent = pesos(p.precio);
  $('d-agotado').hidden = !p.agotado;
  $('d-desc').textContent = p.descripcion || '';
  detalle.abrir();
  history.pushState({ hoja: 'detalle' }, '');
  conHistoria = true;
  evento('ver_producto', p.id);
}
document.querySelectorAll('.pt-prod[data-id], .pt-pop[data-id]').forEach((b) => b.addEventListener('click', () => {
  const p = porId.get(b.dataset.id);
  if (p) abrirDetalle(p);
}));
window.addEventListener('popstate', () => { if (!$('hoja-detalle').hidden) { conHistoria = false; detalle.cerrar(); } });
const cerrarDetalle = () => { if (conHistoria) { conHistoria = false; history.back(); } };
$('hoja-detalle').querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrarDetalle));
$('hoja-detalle').previousElementSibling.addEventListener('click', cerrarDetalle);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('hoja-detalle').hidden) cerrarDetalle(); });

// ── Elige por mí ─────────────────────────────────────────────────────────────────
const elige = hoja($('hoja-elige'));
let antojo = 'sorpresa';
let elegido = null;
for (const a of ANTOJOS) {
  if (a.id !== 'sorpresa' && !candidatos(productos, a.id).length) continue; // solo antojos con opciones
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pt-boton';
  b.dataset.antojo = a.id;
  const i = document.createElement('i');
  i.innerHTML = SVG(ICONO_ANTOJO[a.id]); // ícono fijo del código, no datos
  const s = document.createElement('span');
  s.textContent = a.texto;
  b.append(i, s);
  b.addEventListener('click', () => { antojo = a.id; girar(); });
  $('antojos').append(b);
}
function mostrarAntojos() {
  $('e-titulo').textContent = '¿Qué se te antoja?';
  $('antojos').hidden = false;
  $('giro').hidden = true;
  $('g-vacio').hidden = true;
}
$('elige').addEventListener('click', () => { mostrarAntojos(); elige.abrir(); });

function fila(p) {
  const d = document.createElement('div');
  if (p.foto_url) { const img = document.createElement('img'); img.src = p.foto_url; img.alt = ''; d.append(img); }
  else { const s = document.createElement('span'); s.className = 'pt-sin-foto'; d.append(s); }
  const t = document.createElement('span');
  t.textContent = p.nombre;
  d.append(t);
  d.dataset.precio = pesos(p.precio); // se pinta con CSS (::after): el texto de la fila sigue siendo solo el nombre
  return d;
}

function confeti() {
  const c = $('confeti');
  c.textContent = '';
  const colores = ['var(--marca)', 'var(--oro)', 'var(--tinta)', 'var(--ok)', 'var(--papel-hondo)'];
  for (let k = 0; k < 28; k++) {
    const i = document.createElement('i');
    const ang = (Math.PI * 2 * k) / 28 + Math.random() * 0.3;
    const dist = 90 + Math.random() * 120;
    i.style.setProperty('--x', `${Math.cos(ang) * dist}px`);
    i.style.setProperty('--y', `${Math.sin(ang) * dist - 40}px`);
    i.style.setProperty('--r', `${Math.round(Math.random() * 720 - 360)}deg`);
    i.style.background = colores[k % colores.length];
    i.style.animationDelay = `${Math.random() * 80}ms`;
    c.append(i);
  }
}

function girar() {
  elegido = elegir(productos, antojo); // ← decidido aquí, antes de animar
  $('antojos').hidden = true;
  $('g-acciones').hidden = true;
  $('g-resultado').hidden = true;
  $('g-frase').hidden = true;
  if (!elegido) { $('g-vacio').hidden = false; $('antojos').hidden = false; return; }
  $('g-vacio').hidden = true;
  $('giro').hidden = false;
  $('e-titulo').textContent = 'Girando…';
  evento('girar', elegido.id);

  // Rollo: muchos platos al azar del antojo y, al final, el elegido (queda en la ventana del centro)
  // Nunca el mismo plato en filas vecinas: si el antojo tiene pocas opciones, el rollo se rellena con el resto de la carta.
  const c = candidatos(productos, antojo);
  const pool = c.length >= 4 ? c : [...new Map([...c, ...candidatos(productos, 'sorpresa')].map((p) => [p.id, p])).values()];
  const sacar = (evitar) => {
    const ops = pool.filter((p) => !evitar.includes(p.id));
    const de = ops.length ? ops : pool;
    return de[Math.floor(Math.random() * de.length)];
  };
  const lista = [];
  for (let k = 0; k < 26; k++) lista.push(sacar([lista[k - 1]?.id, lista[k - 2]?.id, k >= 24 ? elegido.id : null]));
  lista.push(elegido, sacar([elegido.id, lista[25].id]));
  const rollo = $('rollo');
  rollo.textContent = '';
  lista.forEach((p, k) => { const f = fila(p); if (k === lista.length - 2) f.dataset.elegido = ''; rollo.append(f); });
  const maquina = $('maquina');
  maquina.classList.remove('gano', 'frenando');
  maquina.classList.add('girando');
  rollo.style.transition = 'none';
  rollo.style.transform = 'translateY(0)';
  const ALTO = 80;
  const destino = (lista.length - 2) * ALTO;
  const DURA = 3200;
  // Vibración en cada "clic" mientras frena (donde el celular lo permita)
  const inicio = performance.now();
  let ultimo = -1;
  const facil = (x) => 1 - Math.pow(1 - x, 4);
  const tic = (ahora) => {
    const x = Math.min(1, (ahora - inicio) / DURA);
    const fila = Math.floor((facil(x) * destino) / ALTO);
    if (fila !== ultimo) { ultimo = fila; if (x > 0.45 && navigator.vibrate) navigator.vibrate(8); }
    if (x > 0.62) maquina.classList.add('frenando'); // sin desenfoque al frenar, para leer los platos
    if (x < 1) requestAnimationFrame(tic);
  };
  requestAnimationFrame(() => requestAnimationFrame(() => {
    rollo.style.transition = `transform ${DURA}ms cubic-bezier(.12,.75,.15,1)`;
    rollo.style.transform = `translateY(-${destino}px)`;
    requestAnimationFrame(tic);
  }));
  rollo.addEventListener('transitionend', () => {
    maquina.classList.remove('girando');
    maquina.classList.add('gano');
    confeti();
    if (navigator.vibrate) navigator.vibrate([20, 40, 30]);
    $('e-titulo').textContent = '¡Esta es para ti!';
    $('g-precio').textContent = pesos(elegido.precio);
    $('g-resultado').hidden = false;
    $('g-acciones').hidden = false;
  }, { once: true });
}
$('otra-vez').addEventListener('click', girar);
$('lo-pido').addEventListener('click', () => {
  if (!elegido) return;
  evento('ruleta_acepto', elegido.id);
  $('g-acciones').hidden = true;
  const f = $('g-frase');
  f.textContent = `Pídele a quien te atiende: ${elegido.nombre}.`;
  f.hidden = false;
  confeti();
});

revisarCompatible();
