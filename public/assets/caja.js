// Caja del negocio: PIN → sesión → buscar cliente → Sumar / Canjear.
// SIN CONEXIÓN: cada operación lleva un op_id (uuid). Si la red falla, se guarda en IndexedDB (base nef_caja,
// almacén cola) y se reenvía en orden al volver la señal. Las RPC son idempotentes: reenviar nunca suma doble.
import { rpc, numero, pesos, hora, hoja } from '/assets/nef-rpc.js';

const raiz = document.getElementById('caja');
const slug = raiz.dataset.slug;
const CLAVE = 'nef_caja_' + slug;
const $ = (id) => document.getElementById(id);

let caja = null;      // { sesion, expira, negocio, modo, moneda_plural, … }
let cliente = null;   // ficha actual (de caja_buscar)
let premioElegido = null;

// ── Sesión guardada ──────────────────────────────────────────────────
function leerSesion() {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    return s && s.sesion && new Date(s.expira) > new Date() ? s : null;
  } catch { return null; }
}
function guardarSesion(s) { try { localStorage.setItem(CLAVE, JSON.stringify(s)); } catch { /* sin almacenamiento */ } }
function cerrarSesion() { try { localStorage.removeItem(CLAVE); } catch { /* nada */ } caja = null; pantalla('pin'); }

function pantalla(cual) {
  $('pantalla-pin').hidden = cual !== 'pin';
  $('pantalla-buscar').hidden = cual !== 'buscar';
  if (cual === 'pin') setTimeout(() => $('pin').focus(), 50);
  if (cual === 'buscar') setTimeout(() => $('dato').focus(), 50);
  // "Cobrar con QR" solo si el negocio tiene carta (se consulta después de que cargue todo el módulo)
  if (cual === 'buscar') setTimeout(() => cargarCarta().then((c) => ($('cobrar-qr').hidden = !c.length)).catch(() => {}), 80);
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('visible'), 3000);
}

// ── Cola sin conexión (IndexedDB) ────────────────────────────────────
function abrirBase() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open('nef_caja', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('cola', { keyPath: 'op_id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function cola(modo, fn) {
  const db = await abrirBase();
  return new Promise((ok, mal) => {
    const tx = db.transaction('cola', modo);
    const res = fn(tx.objectStore('cola'));
    tx.oncomplete = () => ok(res && 'result' in res ? res.result : undefined);
    tx.onerror = () => mal(tx.error);
  });
}
const encolar = (op) => cola('readwrite', (s) => s.put(op));
const quitar = (opId) => cola('readwrite', (s) => s.delete(opId));
const pendientes = async () => ((await cola('readonly', (s) => s.getAll())) || []).filter((o) => o.slug === slug).sort((a, b) => a.creado - b.creado);

async function pintarPendientes() {
  const n = (await pendientes()).length;
  $('sin-conexion').hidden = n === 0;
  $('sin-conexion').textContent = `Sin conexión · ${n} ${n === 1 ? 'operación guardada' : 'operaciones guardadas'}`;
}

// Envía una operación. Devuelve el resultado, o lanza si no hay red.
function enviar(op) {
  if (op.tipo === 'visita') return rpc('caja_visita', { p_sesion: caja.sesion, p_token: op.token, p_op_id: op.op_id, p_valor: op.valor ?? null });
  return rpc('caja_canje', { p_sesion: caja.sesion, p_token: op.token, p_premio: op.premio, p_op_id: op.op_id });
}

let enviando = false;
async function vaciarCola() {
  if (enviando || !caja) return;
  enviando = true;
  try {
    for (const op of await pendientes()) {
      let r;
      try { r = await enviar(op); } catch (e) { if (e.sinRed) break; r = { error: 'servidor' }; }
      if (r && r.error === 'sesion') { cerrarSesion(); break; }
      await quitar(op.op_id); // respondió (bien o con un error definitivo): ya no se reintenta
      if (r && r.ok) toast(`Enviado: ${op.nombre} · saldo ${numero(r.saldo)}`);
      else toast(`No se pudo registrar lo de ${op.nombre}: ${mensajeError(r)}`);
      if (cliente && cliente.token === op.token && r && r.ok) { cliente.saldo = r.saldo; pintarFicha(); }
    }
  } finally {
    enviando = false;
    await pintarPendientes();
  }
}
window.addEventListener('online', vaciarCola);
setInterval(vaciarCola, 15000);

function mensajeError(r) {
  const e = r && r.error;
  if (e === 'muy_pronto') return `ya sumó hoy. Puede volver a sumar a las ${hora(r.desde)}`;
  if (e === 'saldo') return `le faltan ${numero(r.faltan)} ${caja.moneda_plural}`;
  if (e === 'valor') return 'escribe el valor de la compra';
  if (e === 'no_existe') return 'no encontramos a ese cliente';
  if (e === 'premio') return 'ese premio ya no está activo';
  return 'intenta de nuevo';
}

// Ejecuta una operación con la cola como respaldo
async function operar(op) {
  op.op_id = crypto.randomUUID();
  op.creado = Date.now();
  op.slug = slug;
  try {
    const r = await enviar(op);
    if (r && r.error === 'sesion') { cerrarSesion(); return null; }
    return r;
  } catch (e) {
    if (!e.sinRed) throw e;
    await encolar(op);
    await pintarPendientes();
    toast('Guardado, se enviará al volver la conexión');
    return { encolada: true };
  }
}

// ── PIN ──────────────────────────────────────────────────────────────
$('form-pin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('pin-error');
  err.hidden = true;
  const pin = $('pin').value.trim();
  if (!/^\d{4,6}$/.test(pin)) { err.textContent = 'El PIN tiene de 4 a 6 números.'; err.hidden = false; return; }
  try {
    const r = await rpc('caja_entrar', { p_slug: slug, p_pin: pin });
    if (r && r.sesion) {
      caja = r;
      guardarSesion(r);
      $('pin').value = '';
      pantalla('buscar');
      vaciarCola();
      return;
    }
    if (r && r.error === 'pin') err.textContent = `PIN incorrecto. Te ${r.quedan === 1 ? 'queda 1 intento' : `quedan ${r.quedan} intentos`}.`;
    else if (r && r.error === 'bloqueado') err.textContent = 'Demasiados intentos. La caja se desbloquea en una hora.';
    else err.textContent = 'Esta caja aún no tiene PIN. Pídeselo a quien administra Nef.';
  } catch {
    err.textContent = 'No hay conexión. Para entrar la primera vez necesitas internet.';
  }
  err.hidden = false;
  $('pin').select();
});

// ── Buscar cliente ───────────────────────────────────────────────────
async function buscar(dato) {
  $('ficha').hidden = true;
  $('buscar-vacio').hidden = true;
  if (!dato) return;
  let r;
  try { r = await rpc('caja_buscar', { p_sesion: caja.sesion, p_dato: dato }); } catch {
    mostrarVacio('Sin conexión', 'No se puede buscar sin internet. Las operaciones que ya hiciste quedan guardadas.');
    return;
  }
  if (r && r.error === 'sesion') { cerrarSesion(); return; }
  if (!r || r.error) { mostrarVacio('No encontramos ese número', 'Revisa los 10 dígitos o pídele que se inscriba desde el portal.'); return; }
  cliente = r;
  pintarFicha();
}
function mostrarVacio(titulo, texto) {
  const v = $('buscar-vacio');
  v.textContent = '';
  const b = document.createElement('b');
  b.textContent = titulo;
  v.append(b, texto);
  v.hidden = false;
}
$('form-buscar').addEventListener('submit', (e) => { e.preventDefault(); buscar($('dato').value.trim()); });

function pintarFicha() {
  $('f-nombre').textContent = cliente.nombre;
  $('f-saldo').textContent = numero(cliente.saldo);
  $('f-plural').textContent = caja.moneda_plural;
  const aviso = $('f-aviso');
  const alcanza = (cliente.premios || []).filter((p) => p.costo <= cliente.saldo);
  aviso.className = 'pt-aviso';
  aviso.hidden = false;
  if (cliente.desde) { aviso.classList.add('alerta'); aviso.textContent = `Ya sumó. Puede volver a sumar a las ${hora(cliente.desde)}`; }
  else if (cliente.bienvenida_pendiente > 0) { aviso.classList.add('neutro'); aviso.textContent = `Primera visita: se activan sus ${numero(cliente.bienvenida_pendiente)} de bienvenida`; }
  else if (alcanza.length) { aviso.classList.add('ok'); aviso.textContent = `Ya puede canjear ${alcanza[alcanza.length - 1].nombre}`; }
  else if (cliente.nivel && cliente.nivel.nombre) {
    const r = cliente.racha && cliente.racha.semanas > 0 ? ` · racha de ${numero(cliente.racha.semanas)} ${cliente.racha.semanas === 1 ? 'semana' : 'semanas'}` : '';
    aviso.classList.add('neutro');
    aviso.textContent = `Nivel ${cliente.nivel.nombre}${r}`;
  } else aviso.hidden = true;
  $('f-valor-campo').hidden = caja.modo !== 'valor';
  $('canjear').disabled = !(cliente.premios || []).length;
  $('ficha').hidden = false;
}

// ── Sumar ────────────────────────────────────────────────────────────
$('f-valor').addEventListener('input', (e) => {
  const d = e.target.value.replace(/\D/g, '').slice(0, 9);
  e.target.value = d ? pesos(+d) : '';
});
$('sumar').addEventListener('click', async () => {
  if (!cliente) return;
  const op = { tipo: 'visita', token: cliente.token, nombre: cliente.nombre };
  if (caja.modo === 'valor') {
    op.valor = +$('f-valor').value.replace(/\D/g, '');
    if (!op.valor) { $('f-valor-campo').classList.add('error'); $('f-valor').focus(); return; }
    $('f-valor-campo').classList.remove('error');
  }
  $('sumar').disabled = true;
  try {
    const r = await operar(op);
    if (!r) return;
    if (r.encolada) return;
    if (r.ok) {
      cliente.saldo = r.saldo;
      cliente.bienvenida_pendiente = 0;
      cliente.desde = null;
      if (r.nivel) cliente.nivel = r.nivel;
      if (r.racha) cliente.racha = { semanas: r.racha };
      $('f-valor').value = '';
      pintarFicha();
      const mon = $('f-mon');
      mon.classList.remove('pt-celebra'); void mon.offsetWidth; mon.classList.add('pt-celebra');
      // Desglose: "+40 monedas (10 visita + 10 hora dorada + 20 de bienvenida)"; la racha se celebra aparte
      const partes = [`${numero(r.monedas)} visita`];
      if (r.hora_dorada) partes.push(`${numero(r.hora_dorada)} hora dorada`);
      if (r.bienvenida) partes.push(`${numero(r.bienvenida)} de bienvenida`);
      if (r.bono_racha) partes.push(`${numero(r.bono_racha)} por ${numero(r.racha)} semanas seguidas`);
      const total = r.monedas + (r.hora_dorada || 0) + (r.bienvenida || 0) + (r.bono_racha || 0);
      toast(`+${numero(total)} ${caja.moneda_plural}${partes.length > 1 ? ` (${partes.join(' + ')})` : ''}${r.bono_racha ? ' ¡Racha!' : ''}`);
    } else {
      if (r.error === 'muy_pronto') { cliente.desde = r.desde; pintarFicha(); }
      toast('No se sumó: ' + mensajeError(r));
    }
  } finally {
    $('sumar').disabled = false;
  }
});

// ── Canjear ──────────────────────────────────────────────────────────
const hojaCanje = hoja($('hoja-canje'));
$('canjear').addEventListener('click', () => {
  premioElegido = null;
  $('confirmar-canje').hidden = true;
  const lista = $('lista-canje');
  lista.textContent = '';
  for (const p of cliente.premios || []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pt-prod' + (p.costo > cliente.saldo ? ' agotado' : '');
    b.disabled = p.costo > cliente.saldo;
    const tx = document.createElement('div');
    tx.className = 'pt-tx';
    const nom = document.createElement('b');
    nom.textContent = p.nombre;
    const costo = document.createElement('span');
    costo.className = 'pt-precio';
    costo.textContent = `${numero(p.costo)} ${caja.moneda_plural}`;
    tx.append(nom, costo);
    if (p.costo > cliente.saldo) {
      const f = document.createElement('small');
      f.textContent = `Le faltan ${numero(p.costo - cliente.saldo)}`;
      tx.append(f);
    }
    b.append(tx);
    b.addEventListener('click', () => {
      premioElegido = p;
      $('confirmar-canje').textContent = `Canjear ${p.nombre} por ${numero(p.costo)}`;
      $('confirmar-canje').hidden = false;
    });
    lista.append(b);
  }
  hojaCanje.abrir();
});
$('confirmar-canje').addEventListener('click', async () => {
  if (!premioElegido) return;
  $('confirmar-canje').disabled = true;
  try {
    const r = await operar({ tipo: 'canje', token: cliente.token, premio: premioElegido.id, nombre: cliente.nombre });
    hojaCanje.cerrar();
    if (!r || r.encolada) return;
    if (r.ok) {
      cliente.saldo = r.saldo;
      cliente.premios = (cliente.premios || []).map((p) => ({ ...p, alcanzable: p.costo <= r.saldo }));
      pintarFicha();
      toast(`Canjeado: ${r.premio}. Nuevo saldo ${numero(r.saldo)}`);
    } else toast('No se canjeó: ' + mensajeError(r));
  } finally {
    $('confirmar-canje').disabled = false;
  }
});

// ── Escanear (solo si el navegador sabe leer QR) ─────────────────────
if ('BarcodeDetector' in window && navigator.mediaDevices) {
  $('escanear-bloque').hidden = false;
  const hojaEscaner = hoja($('hoja-escaner'));
  let flujo = null;
  const parar = () => { if (flujo) flujo.getTracks().forEach((t) => t.stop()); flujo = null; };
  $('hoja-escaner').querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', parar));
  $('escanear').addEventListener('click', async () => {
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch { toast('No pudimos abrir la cámara. Escribe el número.'); return; }
    const video = $('video');
    video.srcObject = flujo;
    await video.play();
    hojaEscaner.abrir();
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const mirar = async () => {
      if (!flujo) return;
      try {
        const [c] = await detector.detect(video);
        if (c && /^[0-9a-f]{32}$/.test(c.rawValue)) { parar(); hojaEscaner.cerrar(); buscar(c.rawValue); return; }
      } catch { /* sigue intentando */ }
      setTimeout(mirar, 250);
    };
    mirar();
  });
}

$('salir').addEventListener('click', cerrarSesion);

// ── Arranque ─────────────────────────────────────────────────────────
caja = leerSesion();
pantalla(caja ? 'buscar' : 'pin');
pintarPendientes();
if (caja) vaciarCola();

// ── Cobrar con QR: el cajero marca lo que compró; el cliente escanea y gana sus monedas en su celular ──
// La lista sale de la carta pública; el valor lo recalcula la base (caja_crear_compra) con los precios reales.
const hojaCompra = hoja($('hoja-compra'));
let carta = null;
const elegidos = new Map(); // producto_id → cantidad
let vigiaCompra = null;

async function cargarCarta() {
  if (carta) return carta;
  const c = await rpc('carta_publica', { p_slug: slug });
  carta = (c && c.categorias ? c.categorias.flatMap((k) => k.productos || []) : []).filter((p) => !p.agotado);
  return carta;
}
function pintarCompra() {
  const lista = $('compra-lista');
  lista.textContent = '';
  let total = 0;
  for (const p of carta) {
    const cant = elegidos.get(p.id) || 0;
    total += cant * (p.precio || 0);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pt-compra-item' + (cant ? ' elegido' : '');
    const nom = document.createElement('span'); nom.textContent = p.nombre;
    const pr = document.createElement('small'); pr.textContent = pesos(p.precio || 0);
    b.append(nom, pr);
    if (cant) { const c = document.createElement('b'); c.className = 'pt-compra-cant'; c.textContent = '×' + cant; b.append(c); }
    b.addEventListener('click', () => { elegidos.set(p.id, Math.min(20, cant + 1)); pintarCompra(); });
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (cant > 1) elegidos.set(p.id, cant - 1); else elegidos.delete(p.id); pintarCompra(); });
    lista.append(b);
  }
  $('compra-total').textContent = pesos(total);
  $('compra-generar').disabled = !elegidos.size;
}
function reiniciarCompra() {
  clearInterval(vigiaCompra);
  elegidos.clear();
  $('compra-elegir').hidden = false;
  $('compra-qr').hidden = true;
  if (carta) pintarCompra();
}
$('cobrar-qr').addEventListener('click', async () => {
  reiniciarCompra();
  hojaCompra.abrir();
  try { await cargarCarta(); } catch { toast('Sin conexión: el QR necesita internet'); return; }
  if (!carta.length) { toast('Este negocio aún no tiene carta'); hojaCompra.cerrar(); return; }
  pintarCompra();
});
$('compra-limpiar').addEventListener('click', reiniciarCompra);
$('compra-otra').addEventListener('click', reiniciarCompra);
$('compra-generar').addEventListener('click', async () => {
  const items = [...elegidos].map(([producto_id, cantidad]) => ({ producto_id, cantidad }));
  $('compra-generar').disabled = true;
  let r;
  try { r = await rpc('caja_crear_compra', { p_sesion: caja.sesion, p_items: items }); } catch { toast('Sin conexión: el QR necesita internet'); $('compra-generar').disabled = false; return; }
  if (!r || r.error) {
    if (r && r.error === 'sesion') { cerrarSesion(); hojaCompra.cerrar(); return; }
    toast(r && r.error === 'valor' ? 'La compra no tiene valor' : 'No se pudo crear el QR');
    $('compra-generar').disabled = false;
    return;
  }
  const qr = window.qrcode(0, 'M');
  qr.addData(`${location.origin}/n/${slug}/club?c=${r.codigo}`);
  qr.make();
  $('compra-codigo').textContent = '';
  // El SVG lo genera la librería a partir de una URL propia (código hexadecimal), no de texto del usuario
  $('compra-codigo').insertAdjacentHTML('afterbegin', qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true }));
  $('compra-titulo').textContent = 'Que lo escanee con su celular';
  $('compra-resumen').textContent = `${pesos(r.valor)} · gana ${numero(r.monedas)} ${caja.moneda_plural || 'monedas'}`;
  $('compra-elegir').hidden = true;
  $('compra-qr').hidden = false;
  $('compra-otra').hidden = true;
  const fin = new Date(r.expira).getTime();
  const tic = async (n) => {
    const s = Math.max(0, Math.round((fin - Date.now()) / 1000));
    $('compra-vence').textContent = s ? `Vence en ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'Este QR venció';
    if (!s) { clearInterval(vigiaCompra); $('compra-otra').hidden = false; return; }
    if (n % 3) return; // pregunta a la base cada 3 s
    try {
      const e = await rpc('caja_estado_compra', { p_sesion: caja.sesion, p_codigo: r.codigo });
      if (e && e.usado) {
        clearInterval(vigiaCompra);
        $('compra-titulo').textContent = '¡Listo! Ya se sumaron';
        $('compra-codigo').textContent = '';
        $('compra-vence').textContent = '';
        $('compra-otra').hidden = false;
        try { navigator.vibrate && navigator.vibrate(60); } catch { /* nada */ }
      }
    } catch { /* sin señal: sigue intentando */ }
  };
  let n = 0;
  tic(n);
  vigiaCompra = setInterval(() => tic(++n), 1000);
});

// ── Modo rápido (hora pico): la cajera voltea la pantalla y el cliente escanea; el QR cambia cada 30 s ──
const hojaRapido = hoja($('hoja-rapido'));
let vigiaRapido = null;
let codigoMostrado = '';
async function pintarRapido() {
  let r;
  try { r = await rpc('caja_rapido_codigo', { p_sesion: caja.sesion }); } catch { $('rapido-resumen').textContent = 'Sin conexión: el modo rápido necesita internet'; return false; }
  if (!r || r.error) {
    if (r && r.error === 'sesion') { cerrarSesion(); return false; }
    const motivo = r && r.error === 'fuera_de_horario' ? `El modo rápido funciona de ${r.desde} a ${r.hasta}` : 'El modo rápido está apagado: actívalo en el panel del negocio';
    toast(motivo);
    return false;
  }
  if (r.codigo !== codigoMostrado) {
    codigoMostrado = r.codigo;
    const qr = window.qrcode(0, 'M');
    qr.addData(`${location.origin}/n/${slug}/club?r=${r.codigo}`);
    qr.make();
    $('rapido-codigo').textContent = '';
    // El SVG lo genera la librería a partir de una URL propia (código hexadecimal), no de texto del usuario
    $('rapido-codigo').insertAdjacentHTML('afterbegin', qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true }));
    $('rapido-resumen').textContent = `Gana ${numero(r.monedas)} ${caja.moneda_plural || 'monedas'}`;
  }
  return true;
}
const pararRapido = () => { clearInterval(vigiaRapido); vigiaRapido = null; codigoMostrado = ''; };
$('hoja-rapido').querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', pararRapido));
$('modo-rapido').addEventListener('click', async () => {
  pararRapido();
  if (!(await pintarRapido())) return;
  hojaRapido.abrir();
  vigiaRapido = setInterval(pintarRapido, 5000);
});
