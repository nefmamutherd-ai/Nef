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
  const saldo = $('t-saldo');
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

// ── Camino de premios: barra hasta el saldo; la bienvenida pendiente se ve como tramo "fantasma" ──
function pintarCamino(t, base) {
  const cont = $('t-camino');
  const premios = [...(t.premios || [])].sort((a, b) => a.costo - b.costo).slice(0, 4);
  cont.textContent = '';
  cont.hidden = premios.length < 1;
  if (!premios.length) return;
  const max = premios[premios.length - 1].costo;
  const pista = document.createElement('div');
  pista.className = 'pt-pista';
  const fantasma = document.createElement('i');
  fantasma.className = 'fantasma';
  const lleno = document.createElement('i');
  pista.append(fantasma, lleno);
  cont.append(pista);
  const conRegalo = (t.saldo || 0) + (t.bienvenida_pendiente || 0);
  let marcada = false;
  premios.forEach((p, k) => {
    const logra = t.saldo >= p.costo;
    const parada = document.createElement('div');
    const siguiente = !logra && !marcada;
    if (siguiente) marcada = true;
    parada.className = 'pt-parada' + (logra ? ' lograda' : '') + (siguiente ? ' siguiente' : '') + (k % 2 ? ' abajo' : '');
    parada.style.setProperty('--v', String(p.costo / max));
    const punto = document.createElement('span');
    const txt = document.createElement('small');
    txt.textContent = `${p.nombre} · ${numero(p.costo)}`;
    parada.append(punto, txt);
    cont.append(parada);
  });
  // Arranca donde estaba (base) y corre hasta el saldo de ahora
  lleno.style.setProperty('--v', String(Math.min(1, (base || 0) / max)));
  fantasma.style.setProperty('--v', String(Math.min(1, conRegalo / max)));
  fantasma.hidden = !(t.bienvenida_pendiente > 0);
  requestAnimationFrame(() => requestAnimationFrame(() => lleno.style.setProperty('--v', String(Math.min(1, (t.saldo || 0) / max)))));
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

// Progreso del aro (0–100) hacia el premio que sigue; con todo alcanzado, lleno
function progresoAro(t, saldo) {
  const premios = [...(t.premios || [])].sort((a, b) => a.costo - b.costo);
  const meta = premios.find((p) => p.costo > saldo);
  if (!meta) return premios.length ? 100 : 0;
  return Math.min(100, Math.round((saldo / meta.costo) * 100));
}

// base = saldo desde el que corre la animación (lo último que vio el cliente)
function pintarTarjeta(t, base = 0) {
  $('t-hola').textContent = `Hola, ${String(t.nombre || '').split(' ')[0]}`;
  contar($('t-numero'), t.saldo, base, base ? 1400 : 900);
  const premios = [...(t.premios || [])].sort((a, b) => a.costo - b.costo);
  const alcanzables = premios.filter((p) => p.alcanzable);
  const regalo = Number(t.bienvenida_pendiente) || 0;

  // Aro: lleno real + tramo fantasma con la bienvenida que espera; brilla si ya alcanza para algo
  const aro = $('t-saldo');
  const meta = premios.find((p) => p.costo > t.saldo);
  aro.style.setProperty('--progreso', String(progresoAro(t, base)));
  aro.style.setProperty('--fantasma', String(regalo && meta ? Math.min(100, Math.round(((t.saldo + regalo) / meta.costo) * 100)) : 0));
  aro.classList.toggle('con-regalo', regalo > 0);
  aro.classList.toggle('listo', alcanzables.length > 0);
  requestAnimationFrame(() => requestAnimationFrame(() => aro.style.setProperty('--progreso', String(progresoAro(t, t.saldo)))));
  $('t-regalo').hidden = !regalo;
  $('t-regalo').textContent = regalo ? `+${numero(regalo)} de regalo` : '';

  // Frase: con regalo pendiente, lo que ya alcanza con él; si no, lo que falta
  if (regalo) {
    const conRegalo = premios.filter((p) => p.costo <= t.saldo + regalo).pop();
    frase($('t-frase'), conRegalo
      ? ['En tu primera compra se activan tus ', { b: monedas(regalo) }, ' de bienvenida. Con eso ya te alcanza para ', { b: conRegalo.nombre }, '.']
      : ['En tu primera compra se activan tus ', { b: monedas(regalo) }, ' de bienvenida.']);
  } else if (t.cercano) frase($('t-frase'), ['Te faltan ', { b: numero(t.cercano.faltan) }, ' para un ', { b: t.cercano.nombre }]);
  else if (alcanzables.length) frase($('t-frase'), ['Muéstrale tu código al cajero y ', { b: 'canjea tu premio' }, '.']);
  else frase($('t-frase'), [`Muestra tu código en la caja cada vez que vengas y gana ${plural}.`]);

  pintarCamino(t, base);

  // Nivel discreto junto al negocio
  if (t.nivel && t.nivel.nombre) $('t-neg').textContent = `${t.negocio} · ${t.nivel.nombre}`;

  // Un solo aviso: el servidor ya eligió cuál (bienvenida → hora dorada → premio → racha → te faltan).
  // La bienvenida ya la cuentan el aro y la frase: aquí se dice solo cuándo se activa.
  const aviso = $('t-aviso');
  const a = t.aviso;
  const veces = (m) => (Number(m) === 2 ? 'el doble' : Number(m) === 3 ? 'el triple' : `×${String(m).replace('.', ',')}`);
  const textos = {
    bienvenida: () => [`Tus ${numero(a.n)} de bienvenida se activan en tu primera visita`, 'neutro'],
    hora_dorada: () => [`Hoy hasta las ${hora12(a.hasta)} ganas ${veces(a.multiplicador)}`, ''],
    premio: () => [`¡Ya te alcanza para ${a.nombre}!`, 'ok'],
    racha: () => [`Vuelve antes del domingo para mantener tu racha de ${numero(a.semanas)} semanas`, ''],
  };
  const elegido = a && a.tipo !== 'bienvenida' && textos[a.tipo] ? textos[a.tipo]() : null; // bienvenida y "te faltan" ya los dicen el aro y la frase
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
    if (r && r.token) { guardar(CLAVE, r.token); borrar(CLAVE + '_visto'); await cargarTarjeta(r.token, 'registro'); return; }
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
const token = leer(CLAVE);
if (token) {
  cargarTarjeta(token).catch(() => {
    mostrar('registro');
    errorGeneral('No pudimos cargar tu tarjeta. Revisa tu internet y recarga.');
  });
} else {
  mostrar('registro');
}
