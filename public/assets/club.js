// Club del cliente: inscripción y tarjeta "Mis monedas". El servidor pinta la página; esto agrega la interacción.
// Datos de la base → siempre textContent (nunca innerHTML con datos).
// Las monedas solo las da la caja: aquí se MUESTRAN (bienvenida pendiente, lo que ganó) y se celebran; nunca se suman.
import { rpc, numero, pesos, hoja } from '/assets/nef-rpc.js';

const raiz = document.getElementById('club');
const slug = raiz.dataset.slug;
const plural = raiz.dataset.plural;
const singular = raiz.dataset.singular || plural;
const CLAVE = 'nef_club_' + slug;
const $ = (id) => document.getElementById(id);
const quieto = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const monedas = (n) => `${numero(n)} ${Number(n) === 1 ? singular : plural}`;

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* modo privado: la tarjeta dura la sesión */ } };
const borrar = (k) => { try { localStorage.removeItem(k); } catch { /* nada */ } };

// "17:00" → "5 p. m."; "12:30" → "12:30 m."
const hora12 = (hhmm) => {
  const [h, m] = String(hhmm || '0:00').split(':').map(Number);
  const mm = m ? `:${String(m).padStart(2, '0')}` : '';
  if (h === 0) return `12${mm} a. m.`;
  if (h < 12) return `${h}${mm} a. m.`;
  if (h === 12) return `12${mm} m.`;
  return `${h - 12}${mm} p. m.`;
};

// Avisos en fila: uno a la vez, cada uno 2,8 s (si llegan dos celebraciones juntas no se pisan)
const fila = [];
let mostrando = false;
function toast(msg) {
  fila.push(msg);
  if (!mostrando) siguienteToast();
}
function siguienteToast() {
  const t = $('toast');
  const msg = fila.shift();
  if (!msg) { mostrando = false; return; }
  mostrando = true;
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => { t.classList.remove('visible'); setTimeout(siguienteToast, 320); }, 2800);
}

// El número corre de "desde" a "hasta"; el texto final siempre es el exacto
function contar(el, hasta, desde = 0, ms = 900) {
  const fin = Number(hasta) || 0;
  const ini = Number(desde) || 0;
  if (fin === ini || quieto()) { el.textContent = numero(fin); return; }
  const t0 = performance.now();
  const paso = (ahora) => {
    const x = Math.min(1, (ahora - t0) / ms);
    el.textContent = numero(Math.round(ini + (fin - ini) * (1 - Math.pow(1 - x, 3))));
    if (x < 1) requestAnimationFrame(paso); else el.textContent = numero(fin);
  };
  requestAnimationFrame(paso);
}

// ── Efectos de celebración (solo transform/opacity; nada con "reducir movimiento") ──────────
// Posiciones fijas (no al azar): la animación es decorado, siempre igual
const CAIDA = [[-64, 0], [52, 60], [-18, 120], [80, 180], [-90, 240], [22, 300], [-46, 360], [66, 420], [-6, 480], [96, 540], [-80, 600], [38, 660]];
function lluvia(cuantas) {
  if (quieto()) return;
  const saldo = $('t-moneda').parentElement; // la lluvia cae hacia la moneda grande
  const capa = document.createElement('div');
  capa.className = 'pt-lluvia';
  capa.setAttribute('aria-hidden', 'true');
  CAIDA.slice(0, cuantas).forEach(([x, d]) => {
    const m = document.createElement('i');
    m.style.setProperty('--x', x + 'px');
    m.style.animationDelay = d + 'ms';
    capa.append(m);
  });
  saldo.append(capa);
  setTimeout(() => capa.remove(), 1900);
}
function flotante(texto) {
  const saldo = $('t-saldo');
  const f = document.createElement('div');
  f.className = 'pt-mas';
  f.textContent = texto;
  saldo.append(f);
  setTimeout(() => f.remove(), 2200);
}
function onda() {
  if (quieto()) return;
  const saldo = $('t-saldo');
  const o = document.createElement('div');
  o.className = 'pt-onda';
  o.setAttribute('aria-hidden', 'true');
  saldo.append(o);
  setTimeout(() => o.remove(), 900);
  saldo.classList.remove('pt-celebra');
  void saldo.offsetWidth; // reinicia la animación si ya estaba
  saldo.classList.add('pt-celebra');
}
const vibrar = (patron) => { try { if (!quieto() && navigator.vibrate) navigator.vibrate(patron); } catch { /* sin vibración */ } };

// ── Premios en fila (se deslizan): logrados con ✓, el siguiente resaltado, cada uno con su barrita ──
function pintarCamino(t) {
  const cont = $('t-camino');
  const premios = [...(t.premios || [])].sort((a, b) => a.costo - b.costo);
  cont.textContent = '';
  cont.hidden = premios.length < 2; // con uno solo, ya está en "Tu próximo premio"
  if (cont.hidden) return;
  const regalo = Number(t.bienvenida_pendiente) || 0;
  let marcada = false;
  for (const p of premios) {
    const logra = t.saldo >= p.costo;
    const siguiente = !logra && !marcada;
    if (siguiente) marcada = true;
    const d = document.createElement('div');
    d.className = 'pt-pr' + (logra ? ' lograda' : '') + (siguiente ? ' siguiente' : '');
    const b = document.createElement('b'); b.textContent = p.nombre;
    const c = document.createElement('span'); c.className = 'pt-pr-cuesta';
    const m = document.createElement('i'); m.className = 'pt-moneda-p'; m.setAttribute('aria-hidden', 'true');
    c.append(m, numero(p.costo));
    const barra = document.createElement('div'); barra.className = 'pt-pr-barra';
    const lleno = document.createElement('i'); lleno.style.setProperty('--v', String(Math.min(1, (t.saldo || 0) / p.costo)));
    barra.append(lleno);
    const s = document.createElement('small');
    s.textContent = logra ? '¡Ya te alcanza!' : regalo && t.saldo + regalo >= p.costo ? 'Con tu regalo, ¡ya!' : `Te faltan ${numero(p.costo - t.saldo)}`;
    d.append(b, c, barra, s);
    cont.append(d);
  }
}

let tokenActual = null;
let ultima = null; // última tarjeta pintada (para comparar en vivo)
const hojaCodigo = hoja($('hoja-codigo'));
const hojaPremios = hoja($('hoja-premios'));

function mostrar(seccion) {
  $('cargando').hidden = true;
  $('registro').hidden = seccion !== 'registro';
  $('tarjeta').hidden = seccion !== 'tarjeta';
}

// Arma "Te faltan <b>70</b> para un Capuchino" con nodos (sin innerHTML)
function frase(el, partes) {
  el.textContent = '';
  for (const p of partes) {
    if (typeof p === 'string') el.append(p);
    else { const b = document.createElement('b'); b.textContent = p.b; el.append(b); }
  }
}

// Monedas por visita (modo "visita"): para decir "2 visitas más" en vez de "70 monedas" (más concreto, más cerca)
const POR_VISITA = raiz.dataset.modo === 'visita' ? Number(raiz.dataset.porVisita) || 0 : 0;
const visitas = (n) => `${numero(n)} ${n === 1 ? 'visita' : 'visitas'}`;

// base = saldo desde el que corre la animación (lo último que vio el cliente)
function pintarTarjeta(t, base = 0) {
  $('t-hola').textContent = `Hola, ${String(t.nombre || '').split(' ')[0]}`;
  contar($('t-numero'), t.saldo, base, base ? 1400 : 900);
  const premios = [...(t.premios || [])].sort((a, b) => a.costo - b.costo);
  const alcanzables = premios.filter((p) => p.alcanzable);
  const regalo = Number(t.bienvenida_pendiente) || 0;
  $('t-saldo').classList.toggle('listo', alcanzables.length > 0);

  // Boleto de regalo pegado al pase (progreso regalado: ya cuenta en la barra)
  $('t-boleto').hidden = !regalo;
  $('t-regalo').textContent = regalo ? `+${numero(regalo)} de regalo` : '';

  // Tu próximo premio: barra ondulada desde lo que vio la última vez hasta hoy; el regalo, como tramo punteado
  const meta = premios.find((p) => p.costo > t.saldo) || alcanzables[alcanzables.length - 1];
  $('t-meta').hidden = !meta;
  if (meta) {
    const ola = $('t-ola');
    const fr = (x) => String(Math.max(0, Math.min(1, x / meta.costo)));
    ola.style.setProperty('--p', fr(base));
    ola.style.setProperty('--g', regalo ? fr(t.saldo + regalo) : '0'); // tramo punteado solo si hay regalo
    requestAnimationFrame(() => requestAnimationFrame(() => ola.style.setProperty('--p', fr(t.saldo))));
    $('t-meta-nombre').textContent = meta.nombre;
    const cuesta = $('t-meta-cuesta');
    cuesta.textContent = '';
    const m = document.createElement('i'); m.className = 'pt-moneda-p'; m.setAttribute('aria-hidden', 'true');
    cuesta.append(m, numero(meta.costo));
    const faltan = meta.costo - t.saldo;
    $('t-meta-titulo').textContent = faltan <= 0 ? 'Ya puedes canjear' : 'Tu próximo premio';
    const conRegalo = premios.filter((p) => p.costo <= t.saldo + regalo).pop();
    if (faltan <= 0) frase($('t-frase'), ['¡Ya te alcanza! Muéstrale tu código al cajero y ', { b: 'canjéalo' }, '.']);
    else if (regalo && conRegalo) frase($('t-frase'), ['Con tus ', { b: `${numero(regalo)} ${plural} de regalo` }, ' ya te alcanza para ', { b: conRegalo.nombre }, '. Se activan en tu primera compra.']);
    else if (POR_VISITA) {
      const v = Math.ceil(Math.max(0, faltan - regalo) / POR_VISITA);
      frase($('t-frase'), ['Te faltan ', { b: visitas(v) }, ' para ', { b: meta.nombre }, '.']);
    } else frase($('t-frase'), ['Te faltan ', { b: `${numero(faltan)} ${plural}` }, ' para ', { b: meta.nombre }, '.']);
  } else frase($('t-frase'), [`Muestra tu código en la caja cada vez que vengas y gana ${plural}.`]);

  pintarCamino(t);

  // Nivel discreto arriba a la derecha
  $('t-neg').textContent = t.nivel && t.nivel.nombre ? t.nivel.nombre : '';
  // Meta del mes (gimnasios): "Este mes: 9 de 12 llegadas" con su barra
  $('t-mes').hidden = !t.meta_mes;
  if (t.meta_mes) {
    const hechas = Math.min(t.llegadas_mes || 0, t.meta_mes.llegadas);
    const faltan = t.meta_mes.llegadas - hechas;
    $('t-mes-n').textContent = `${numero(hechas)} de ${numero(t.meta_mes.llegadas)} llegadas`;
    $('t-mes-bono').textContent = `+${numero(t.meta_mes.bono)}`;
    $('t-mes-barra').style.width = `${(hechas / t.meta_mes.llegadas) * 100}%`;
    $('t-mes-frase').textContent = faltan > 0
      ? `Te faltan ${numero(faltan)} ${faltan === 1 ? 'llegada' : 'llegadas'} para ganar ${numero(t.meta_mes.bono)} de bono este mes.`
      : '¡Cumpliste la meta del mes! Tu bono ya está en tu saldo.';
  }
  // Racha semanal arriba, con llama (si la hay, reemplaza al nivel para que haya un solo sello)
  const semanas = t.racha && t.racha.semanas > 0 ? t.racha.semanas : 0;
  $('t-racha').hidden = !semanas;
  $('t-neg').hidden = !!semanas;
  if (semanas) $('t-racha-n').textContent = `${numero(semanas)} ${semanas === 1 ? 'semana' : 'semanas'}`;

  // Un solo aviso: el servidor ya eligió cuál (bienvenida → hora dorada → premio → racha → te faltan).
  // Bienvenida, premio alcanzado y "te faltan" ya los dicen el pase y la barra: aquí solo hora dorada y racha.
  const aviso = $('t-aviso');
  const a = t.aviso;
  const veces = (m) => (Number(m) === 2 ? 'el doble' : Number(m) === 3 ? 'el triple' : `×${String(m).replace('.', ',')}`);
  const textos = {
    hora_dorada: () => [`Hoy hasta las ${hora12(a.hasta)} ganas ${veces(a.multiplicador)}`, ''],
    racha: () => [`Vuelve antes del domingo para mantener tu racha de ${numero(a.semanas)} semanas`, ''],
  };
  const elegido = a && textos[a.tipo] ? textos[a.tipo]() : null;
  aviso.hidden = !elegido;
  if (elegido) { aviso.textContent = elegido[0]; aviso.className = 'pt-aviso' + (elegido[1] ? ' ' + elegido[1] : ''); }

  // Lista de premios (hoja) + nivel y racha
  const lista = $('lista-premios');
  lista.textContent = '';
  const dato = (titulo, valor) => {
    const d = document.createElement('div');
    d.className = 'pt-dato';
    const s = document.createElement('small'); s.textContent = titulo;
    const b = document.createElement('b'); b.textContent = valor;
    d.append(s, b);
    lista.append(d);
  };
  if (t.nivel && t.nivel.nombre) {
    dato('Tu nivel', t.nivel.siguiente ? `${t.nivel.nombre} · te faltan ${numero(t.nivel.siguiente.faltan)} para ${t.nivel.siguiente.nombre}` : t.nivel.nombre);
  }
  if (t.racha && t.racha.semanas > 0) dato('Tu racha', `${numero(t.racha.semanas)} ${t.racha.semanas === 1 ? 'semana seguida' : 'semanas seguidas'}`);
  if (t.hora_dorada) dato('Hora dorada ahora', `${veces(t.hora_dorada.multiplicador)} hasta las ${hora12(t.hora_dorada.hasta)}`);
  else if (t.proxima_hora_dorada) {
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const p = t.proxima_hora_dorada;
    dato('Próxima hora dorada', `${dias[p.dia]} de ${hora12(p.desde)} a ${hora12(p.hasta)}: ganas ${veces(p.multiplicador)}`);
  }
  if (!premios.length) {
    const v = document.createElement('div');
    v.className = 'pt-vacio';
    v.textContent = 'Este negocio aún no tiene premios.';
    lista.append(v);
  }
  for (const p of premios) {
    const d = document.createElement('div');
    d.className = 'pt-premio' + (p.alcanzable ? ' listo' : '');
    const b = document.createElement('b');
    b.textContent = p.nombre;
    const s = document.createElement('small');
    s.textContent = p.alcanzable ? '¡Ya te alcanza!' : `${numero(p.costo)} ${plural}`;
    const barra = document.createElement('div');
    barra.className = 'pt-barrita';
    const i = document.createElement('i');
    i.style.setProperty('--v', String(Math.min(1, (t.saldo || 0) / p.costo)));
    barra.append(i);
    const v = document.createElement('small');
    v.textContent = `${numero(p.costo)} ${plural} · vale ${pesos(p.valor_pesos)}`;
    d.append(b, s, barra, v);
    lista.append(d);
  }
  mostrar('tarjeta');
}

// ── Qué cambió desde la última vez que el cliente vio su tarjeta → celebración ──────────────
const RAZON = { bienvenida: 'de bienvenida', visita: 'por tu visita', bono_hora_dorada: 'de hora dorada', bono_racha: 'por tu racha' };
const foto = (t) => ({ saldo: t.saldo, visitas: t.visitas, regalo: t.bienvenida_pendiente, ultimo: (t.movimientos && t.movimientos[0] && t.movimientos[0].creado) || '', nivel: t.nivel && t.nivel.nombre, premios: (t.premios || []).filter((p) => p.alcanzable).map((p) => p.id) });
const leerFoto = () => { try { return JSON.parse(leer(CLAVE + '_visto') || 'null'); } catch { return null; } };

function celebrar(t, antes) {
  const nuevos = (t.movimientos || []).filter((m) => m.creado > (antes.ultimo || '') && m.monedas > 0);
  const ganado = t.saldo - antes.saldo;
  if (ganado > 0) {
    setTimeout(() => {
      flotante('+' + numero(ganado));
      lluvia(Math.min(12, 5 + Math.floor(ganado / 15)));
      ojoFeliz();
      setTimeout(onda, 900);
      vibrar([30, 50, 30]);
    }, 350);
    const partes = nuevos.map((m) => `${numero(m.monedas)} ${RAZON[m.tipo] || ''}`.trim());
    toast(partes.length > 1 ? `¡Ganaste ${monedas(ganado)}! ${partes.join(' + ')}` : `¡Ganaste ${monedas(ganado)}${partes[0] && RAZON[nuevos[0].tipo] ? ' ' + RAZON[nuevos[0].tipo] : ''}!`);
  } else if (ganado < 0 && (t.movimientos || []).some((m) => m.creado > (antes.ultimo || '') && m.tipo === 'canje')) {
    toast('¡Que disfrutes tu premio!');
  }
  // Premio que se acaba de alcanzar y nivel nuevo: después de la cuenta
  const nuevoPremio = (t.premios || []).find((p) => p.alcanzable && !(antes.premios || []).includes(p.id));
  if (nuevoPremio) toast(`¡Ya te alcanza para ${nuevoPremio.nombre}!`);
  if (t.nivel && t.nivel.nombre && antes.nivel && antes.nivel !== t.nivel.nombre && t.nivel.desde > 0) toast(`¡Subiste a ${t.nivel.nombre}!`);
}

function bienvenidaRecienInscrito(t) {
  const regalo = Number(t.bienvenida_pendiente) || 0;
  if (!regalo) { toast('¡Listo, ya estás en el club!'); return; }
  setTimeout(() => {
    flotante('+' + numero(regalo));
    lluvia(10);
    ojoFeliz();
    setTimeout(onda, 900);
    vibrar([30, 50, 30]);
  }, 450);
  toast(`¡Bienvenida! Tus ${monedas(regalo)} te esperan en tu primera compra`);
}

async function cargarTarjeta(token, origen = '') {
  const t = await rpc('club_tarjeta', { p_slug: slug, p_token: token });
  if (!t || t.error) { borrar(CLAVE); mostrar('registro'); return; }
  tokenActual = token;
  const antes = leerFoto();
  // Si cambió el saldo, el número corre desde lo que vio la última vez; si no, sube desde 0 como siempre
  const base = antes && origen !== 'registro' && antes.saldo !== t.saldo ? Math.max(0, antes.saldo) : 0;
  pintarTarjeta(t, base);
  if (origen === 'registro') bienvenidaRecienInscrito(t);
  else if (antes) celebrar(t, antes);
  guardar(CLAVE + '_visto', JSON.stringify(foto(t)));
  ultima = t;
}

// ── En vivo en la caja: mientras el código está abierto, mira cada 3 s si el cajero ya sumó ───
let vigia = null;
function vigilar() {
  clearInterval(vigia);
  let vueltas = 0;
  vigia = setInterval(async () => {
    const abierta = !$('hoja-codigo').hidden && $('hoja-codigo').classList.contains('abierta');
    if (!abierta || ++vueltas > 100) { clearInterval(vigia); return; } // 5 minutos como máximo
    if (document.hidden) return;
    let t;
    try { t = await rpc('club_tarjeta', { p_slug: slug, p_token: tokenActual }); } catch { return; } // sin señal: reintenta
    if (!t || t.error || !ultima) return;
    if (t.saldo !== ultima.saldo || t.visitas !== ultima.visitas || t.bienvenida_pendiente !== ultima.bienvenida_pendiente) {
      clearInterval(vigia);
      hojaCodigo.cerrar();
      setTimeout(() => {
        const antes = leerFoto() || foto(ultima);
        pintarTarjeta(t, antes.saldo);
        celebrar(t, antes);
        guardar(CLAVE + '_visto', JSON.stringify(foto(t)));
        ultima = t;
      }, 320);
    }
  }, 3000);
}

// ── El ojo de Nef (símbolo anillo + punto) asomado en el pase: sigue el dedo o el mouse; si nadie lo toca,
//    mira por su cuenta (al número, a ti, a los premios) y parpadea. Recorrido fijo, nada al azar. ──
const ojos = [...document.querySelectorAll('.pt-ojo')];
function mirar(dx, dy) {
  const m = Math.hypot(dx, dy);
  if (m > 1) { dx /= m; dy /= m; }
  for (const o of ojos) o.firstElementChild.style.transform = `translate(${dx * o.offsetWidth * 0.17}px, ${dy * o.offsetWidth * 0.17}px)`;
}
function ojoFeliz() {
  for (const o of ojos) { o.classList.add('feliz'); setTimeout(() => o.classList.remove('feliz'), 1600); }
  mirar(-1, 0.1); // mira al número que acaba de subir
}
if (ojos.length && !quieto()) {
  let tocado = 0;
  const hacia = (x, y) => {
    tocado = Date.now();
    const o = ojos.find((e) => e.offsetWidth) || ojos[0];
    const r = o.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 160);
    mirar((dx / d) * k, (dy / d) * k);
  };
  addEventListener('pointermove', (e) => hacia(e.clientX, e.clientY), { passive: true });
  addEventListener('pointerdown', (e) => hacia(e.clientX, e.clientY), { passive: true });
  const RUTINA = [[-1, 0.05], [-0.2, 0.1], [-0.7, 0.9], [-0.2, 0.1], [-0.5, -0.7], [-0.2, 0.1]];
  let paso = 0;
  setInterval(() => { if (Date.now() - tocado > 2500 && !document.hidden) { const [x, y] = RUTINA[paso++ % RUTINA.length]; mirar(x, y); } }, 2300);
  setInterval(() => {
    if (document.hidden) return;
    for (const o of ojos) { o.classList.remove('parpadea'); void o.offsetWidth; o.classList.add('parpadea'); }
  }, 5300);
}

// ── Registro ─────────────────────────────────────────────────────────
const form = $('form-registro');
const acepto = $('r-acepto');
const errorCampo = (id, mal) => { $(id).classList.toggle('error', mal); $(id).querySelector('.pt-error').hidden = !mal; };
const errorGeneral = (msg) => { $('r-error').textContent = msg || ''; $('r-error').hidden = !msg; };
acepto.addEventListener('change', () => ($('r-unirme').disabled = !acepto.checked));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorGeneral();
  const nombre = $('r-nombre').value.trim();
  const celular = $('r-celular').value.replace(/\D/g, '');
  const nombreMal = nombre.length < 2;
  const celularMal = !/^3\d{9}$/.test(celular);
  errorCampo('campo-nombre', nombreMal);
  errorCampo('campo-celular', celularMal);
  if (nombreMal || celularMal || !acepto.checked) return;
  $('r-unirme').disabled = true;
  try {
    const r = await rpc('club_registrar', { p_slug: slug, p_nombre: nombre, p_telefono: celular, p_acepta: true });
    if (r && r.token) { guardar(CLAVE, r.token); borrar(CLAVE + '_visto'); await cargarTarjeta(r.token, 'registro'); setTimeout(() => reclamarCompra(), 2500); return; }
    const err = r && r.error;
    if (err === 'telefono') errorCampo('campo-celular', true);
    else if (err === 'nombre') errorCampo('campo-nombre', true);
    else if (err === 'ya_registrado') errorGeneral('Ese celular ya está en el club con otro nombre. Escribe el nombre con el que te inscribiste.');
    else errorGeneral('No pudimos inscribirte. Intenta de nuevo.');
  } catch {
    errorGeneral('No pudimos conectarnos. Revisa tu internet e intenta de nuevo.');
  } finally {
    $('r-unirme').disabled = !acepto.checked;
  }
});

// ── Tarjeta ──────────────────────────────────────────────────────────
$('t-codigo').addEventListener('click', () => {
  const qr = window.qrcode(0, 'M');
  qr.addData(tokenActual);
  qr.make();
  const cont = $('qr');
  cont.textContent = '';
  // El SVG lo genera la librería a partir del token (hexadecimal), no de texto del usuario
  cont.insertAdjacentHTML('afterbegin', qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true }));
  hojaCodigo.abrir();
  vigilar();
});
$('t-premios').addEventListener('click', () => hojaPremios.abrir());

// Al volver a la pestaña (p. ej. después de pagar), revisa si hay algo nuevo que celebrar
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && tokenActual && $('hoja-codigo').hidden) cargarTarjeta(tokenActual).catch(() => {});
});

// ── Arranque ─────────────────────────────────────────────────────────
// ── QR de compra: la caja muestra /n/<slug>/club?c=<código>; al abrirlo, se suma esa compra (una sola vez) ──
let compraPendiente = new URLSearchParams(location.search).get('c');
let rapidoPendiente = new URLSearchParams(location.search).get('r');
if (compraPendiente || rapidoPendiente) history.replaceState(null, '', location.pathname); // recargar no lo reintenta
async function reclamarCompra() {
  if (rapidoPendiente) return reclamarRapido();
  const codigo = compraPendiente;
  compraPendiente = null;
  if (!codigo || !/^[0-9a-f]{32}$/.test(codigo) || !tokenActual) return;
  let r;
  try { r = await rpc('club_reclamar_compra', { p_slug: slug, p_token: tokenActual, p_codigo: codigo }); } catch {
    toast('Sin conexión: vuelve a escanear el código del cajero');
    return;
  }
  if (r && r.ok) { await cargarTarjeta(tokenActual); return; } // compara con lo que vio antes y celebra lo ganado
  const MENSAJES = {
    vencido: 'Este código ya venció: pídele uno nuevo al cajero',
    usado: 'Este código ya se usó',
    muy_pronto: 'Ya sumaste hace poco: vuelve en tu próxima visita',
    no_existe: 'Ese código no es de este negocio',
  };
  toast(MENSAJES[r && r.error] || 'No se pudo sumar esta compra');
}

const token = leer(CLAVE);
if (token) {
  cargarTarjeta(token).then(() => reclamarCompra()).catch(() => {
    mostrar('registro');
    errorGeneral('No pudimos cargar tu tarjeta. Revisa tu internet y recarga.');
  });
} else {
  mostrar('registro');
  if (compraPendiente) toast('Únete al club y esta compra se suma a tus monedas');
}

// Modo rápido (hora pico): QR de la caja que cambia cada 30 s → monedas fijas
async function reclamarRapido() {
  const codigo = rapidoPendiente;
  rapidoPendiente = null;
  if (!codigo || !/^[0-9a-f]{32}$/.test(codigo) || !tokenActual) return;
  let r;
  try { r = await rpc('club_rapido', { p_slug: slug, p_token: tokenActual, p_codigo: codigo }); } catch {
    toast('Sin conexión: vuelve a escanear el código de la caja');
    return;
  }
  if (r && r.ok) { await cargarTarjeta(tokenActual); return; }
  const MENSAJES = {
    vencido: 'Ese código ya cambió: escanéalo otra vez',
    muy_pronto: 'Ya sumaste hace poco: vuelve en tu próxima visita',
    fuera_de_horario: 'El modo rápido no está activo a esta hora',
    inactivo: 'El modo rápido no está activo',
  };
  toast(MENSAJES[r && r.error] || 'No se pudo sumar');
}

// ── Lector del QR de la caja (la caja MUESTRA un QR; el cliente LEE) ──
// Lee con el lector del navegador si existe (Chrome Android) y si no con jsQR (iPhone, computador), que se baja solo al tocar.
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  $('t-escanear').hidden = false;
  $('t-codigo').className = 'pt-link pt-link-chico'; // alternativa: que el cajero escanee al cliente
  $('t-codigo').textContent = 'o muestra tu código al cajero';
  const hojaLector = hoja($('hoja-lector'));
  let flujo = null;
  const parar = () => { if (flujo) flujo.getTracks().forEach((t) => t.stop()); flujo = null; };
  $('hoja-lector').querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', parar));
  const cargarJsQR = () => (window.jsQR ? Promise.resolve() : new Promise((ok, mal) => {
    const sc = document.createElement('script'); sc.src = '/assets/vendor/jsqr/jsQR.js'; sc.onload = ok; sc.onerror = mal; document.head.append(sc);
  }));
  $('t-escanear').addEventListener('click', async () => {
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      toast('No pudimos abrir la cámara. Escanea el QR con la cámara de tu celular.');
      return;
    }
    const video = $('lector-video');
    video.srcObject = flujo;
    await video.play();
    hojaLector.abrir();
    let leer;
    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      leer = async () => { const [c] = await detector.detect(video); return c && c.rawValue; };
    } else {
      try { await cargarJsQR(); } catch { parar(); hojaLector.cerrar(); toast('Sin conexión: escanea el QR con la cámara de tu celular.'); return; }
      const lienzo = document.createElement('canvas');
      const ctx = lienzo.getContext('2d', { willReadFrequently: true });
      leer = async () => {
        if (!video.videoWidth) return null;
        const w = 480, h = Math.round((480 * video.videoHeight) / video.videoWidth);
        lienzo.width = w; lienzo.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        const r = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        return r && r.data;
      };
    }
    const mirar = async () => {
      if (!flujo) return;
      try {
        const texto = await leer();
        let u = null;
        try { u = texto && new URL(texto); } catch { u = null; }
        const codigo = u && (u.searchParams.get('c') || u.searchParams.get('r'));
        if (codigo && /^[0-9a-f]{32}$/.test(codigo)) {
          parar();
          hojaLector.cerrar();
          if (u.pathname !== '/n/' + slug + '/club') { toast('Ese QR es de otro negocio'); return; }
          if (u.searchParams.get('r')) rapidoPendiente = codigo; else compraPendiente = codigo;
          reclamarCompra();
          return;
        }
      } catch { /* sigue intentando */ }
      setTimeout(mirar, 250);
    };
    mirar();
  });
}
