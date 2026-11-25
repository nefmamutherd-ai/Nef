// Carta: aparición al hacer scroll, pestañas que siguen el scroll, hoja de detalle y "Elige por mí" (tragamonedas).
// Datos → textContent. Girar NO da monedas ni premios (regla 2): solo sugiere un plato.
// El resultado se decide ANTES de animar; la animación solo lo muestra.
import { rpc, hoja } from '/assets/nef-rpc.js';
import { elegir, candidatos } from '/assets/elegir.js';

document.documentElement.classList.add('con-js');
const raiz = document.getElementById('carta');
const slug = raiz.dataset.slug;
const tag = raiz.dataset.tag || null;
const $ = (id) => document.getElementById(id);
const productos = JSON.parse($('datos-carta').textContent || '[]');
const porId = new Map(productos.map((p) => [p.id, p]));
const pesos = (n) => '$' + new Intl.NumberFormat('es-CO').format(n || 0);
const evento = (tipo, producto = null) => rpc('registrar_evento_carta', { p_slug: slug, p_tipo: tipo, p_producto: producto, p_tag: tag }).catch(() => {});

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

// ¿Tiene la realidad aumentada de Google? Se pregunta una vez al cargar (y se baja el módulo de la cámara) para que el toque sea inmediato
const xrListo = ES_ANDROID ? soportaXR() : Promise.resolve(false);
xrListo.then((si) => si && import('/assets/mesa-xr.js')).catch(() => {});

// "Verlo en tu mesa": 1) ¿el celular puede? 2) se abre la cámara y la guía va DENTRO (celular en 3D → círculo → Listo → plato)
async function verEnMesa(p, mv) {
  evento('ver_ar', p.id);
  if (ES_IPHONE) { mv.activateAR(); return; } // Quick Look trae su propia guía en la cámara
  if (await xrListo) {
    import('/assets/mesa-xr.js').then((m) => m.ponerEnMesa(p)).catch(() => avisoNoCompatible());
    return;
  }
  // Sin la realidad aumentada de Google instalada: la app de Google (guía propia); si el celular no puede, vuelve aquí
  avisoGoogle(() => {
    const glb = new URL(p.modelo_url, location.href).href;
    const regreso = `${location.origin}${location.pathname}#ra-no-compatible-${p.id}`;
    location.href = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(glb)}&mode=ar_only&title=${encodeURIComponent(p.nombre)}`
      + `#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(regreso)};end;`;
  });
}

// Aviso antes de abrir la app de Google: puede pedir instalar un servicio (lo que confundió en la primera prueba)
function avisoGoogle(seguir) {
  const capa = document.createElement('div');
  capa.className = 'pt-guia';
  capa.setAttribute('role', 'dialog');
  capa.innerHTML = `<div class="pt-guia-tarjeta"><div class="pt-guia-icono azul" aria-hidden="true">i</div>
    <h2>Lo verás con la cámara de Google</h2>
    <p class="pt-guia-texto">Puede pedirte instalar <b>"Servicios de Google Play para RA"</b>. Es gratis y solo se hace una vez.</p>
    <button type="button" class="pt-accion" data-sig>Continuar</button>
    <button type="button" class="pt-link" data-salir>Ahora no</button></div>`;
  capa.querySelector('[data-sig]').addEventListener('click', () => { capa.remove(); seguir(); });
  capa.querySelector('[data-salir]').addEventListener('click', () => capa.remove());
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
const antojo = 'sorpresa'; // gira sobre toda la carta disponible: el negocio no tiene que etiquetar nada
let elegido = null;

// Sonido de tragamonedas (WebAudio, sin archivos): palanca, clics que se frenan y melodía de premio.
// Se puede apagar con el botón de la hoja; el celular recuerda la elección.
const CLAVE_SONIDO = 'nef_sonido';
let conSonido = (() => { try { return localStorage.getItem(CLAVE_SONIDO) !== 'no'; } catch { return true; } })();
let audio = null;
function tono(frec, dur, tipo = 'square', vol = 0.06, despues = 0) {
  if (!conSonido) return;
  try {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    audio ||= new A();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime + despues;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(frec, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* sin audio: sigue en silencio */ }
}
const sonidoPalanca = () => { tono(220, 0.12, 'sawtooth', 0.05); tono(140, 0.2, 'sawtooth', 0.045, 0.07); };
const sonidoClic = () => tono(1300 + Math.random() * 250, 0.03, 'square', 0.035);
const sonidoPremio = () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tono(f, i === 5 ? 0.55 : 0.13, 'triangle', 0.09, i * 0.11));
function pintarSonido() {
  const b = $('e-sonido');
  b.setAttribute('aria-pressed', String(conSonido));
  b.querySelector('span').textContent = conSonido ? 'Con sonido' : 'Sin sonido';
  b.classList.toggle('apagado', !conSonido);
}
$('e-sonido').addEventListener('click', () => {
  conSonido = !conSonido;
  try { localStorage.setItem(CLAVE_SONIDO, conSonido ? 'si' : 'no'); } catch { /* nada */ }
  pintarSonido();
});
pintarSonido();
$('elige').addEventListener('click', () => { elige.abrir(); girar(); });

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
  $('g-acciones').hidden = true;
  $('g-resultado').hidden = true;
  $('g-frase').hidden = true;
  if (!elegido) { $('g-vacio').hidden = false; $('giro').hidden = true; return; }
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
    if (fila !== ultimo) { ultimo = fila; sonidoClic(); if (x > 0.45 && navigator.vibrate) navigator.vibrate(8); }
    if (x > 0.62) maquina.classList.add('frenando'); // sin desenfoque al frenar, para leer los platos
    if (x < 1) requestAnimationFrame(tic);
  };
  sonidoPalanca();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    rollo.style.transition = `transform ${DURA}ms cubic-bezier(.12,.75,.15,1)`;
    rollo.style.transform = `translateY(-${destino}px)`;
    requestAnimationFrame(tic);
  }));
  rollo.addEventListener('transitionend', () => {
    maquina.classList.remove('girando');
    maquina.classList.add('gano');
    confeti();
    sonidoPremio();
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

// Desde la baldosa del club: /carta#elige gira de una
if (location.hash === '#elige') { history.replaceState(history.state, '', location.pathname + location.search); $('elige').click(); }

// ── Buscador: filtra por nombre y descripción, sin tildes; esconde categorías vacías ──
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const buscador = $('buscar');
if (buscador) buscador.addEventListener('input', () => {
  const q = sinTildes(buscador.value.trim());
  let hay = 0;
  document.querySelectorAll('.pt-seccion').forEach((sec) => {
    let n = 0;
    sec.querySelectorAll('.pt-prod[data-id]').forEach((b) => {
      const p = porId.get(b.dataset.id);
      const ok = !q || (p && sinTildes(p.nombre + ' ' + (p.descripcion || '')).includes(q));
      b.hidden = !ok;
      if (ok) { n++; b.classList.add('visible'); }
    });
    sec.hidden = !n;
    hay += n;
  });
  document.querySelectorAll('.pt-populares, .pt-fija').forEach((x) => { x.hidden = !!q; });
  $('sin-resultados').hidden = hay > 0;
});
