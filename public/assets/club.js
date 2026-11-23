// Club del cliente: inscripción y tarjeta "Mis monedas". El servidor pinta la página; esto agrega la interacción.
// Datos de la base → siempre textContent (nunca innerHTML con datos).
import { rpc, numero, pesos, hoja } from '/assets/nef-rpc.js';

const raiz = document.getElementById('club');
const slug = raiz.dataset.slug;
const plural = raiz.dataset.plural;
const CLAVE = 'nef_club_' + slug;
const $ = (id) => document.getElementById(id);

const leerToken = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const guardarToken = (t) => { try { localStorage.setItem(CLAVE, t); } catch { /* modo privado: la tarjeta dura la sesión */ } };
const borrarToken = () => { try { localStorage.removeItem(CLAVE); } catch { /* nada */ } };

// "17:00" → "5 p. m."; "12:30" → "12:30 m."
const hora12 = (hhmm) => {
  const [h, m] = String(hhmm || '0:00').split(':').map(Number);
  const mm = m ? `:${String(m).padStart(2, '0')}` : '';
  if (h === 0) return `12${mm} a. m.`;
  if (h < 12) return `${h}${mm} a. m.`;
  if (h === 12) return `12${mm} m.`;
  return `${h - 12}${mm} p. m.`;
};
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), 3000);
}

// El número sube de 0 a su valor (900 ms); el texto final siempre es el exacto
function contar(el, hasta) {
  const fin = Number(hasta) || 0;
  if (fin <= 0) { el.textContent = numero(0); return; }
  const t0 = performance.now();
  const paso = (ahora) => {
    const x = Math.min(1, (ahora - t0) / 900);
    el.textContent = numero(Math.round(fin * (1 - Math.pow(1 - x, 3))));
    if (x < 1) requestAnimationFrame(paso); else el.textContent = numero(fin);
  };
  requestAnimationFrame(paso);
}

function pintarCamino(t) {
  const cont = $('t-camino');
  const premios = [...(t.premios || [])].sort((a, b) => a.costo - b.costo).slice(0, 4);
  cont.textContent = '';
  cont.hidden = premios.length < 1;
  if (!premios.length) return;
  const max = premios[premios.length - 1].costo;
  const pista = document.createElement('div');
  pista.className = 'pt-pista';
  const lleno = document.createElement('i');
  pista.append(lleno);
  cont.append(pista);
  premios.forEach((p, k) => {
    const parada = document.createElement('div');
    parada.className = 'pt-parada' + (t.saldo >= p.costo ? ' lograda' : '') + (k % 2 ? ' abajo' : '');
    parada.style.setProperty('--v', String(p.costo / max));
    const punto = document.createElement('span');
    const txt = document.createElement('small');
    txt.textContent = `${p.nombre} · ${numero(p.costo)}`;
    parada.append(punto, txt);
    cont.append(parada);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => lleno.style.setProperty('--v', String(Math.min(1, (t.saldo || 0) / max)))));

  // ¿Alcanzó un premio nuevo desde la última vez? Celebración una sola vez.
  try {
    const clave = CLAVE + '_alcanzados';
    const antes = JSON.parse(localStorage.getItem(clave) || 'null');
    const ahora = premios.filter((p) => t.saldo >= p.costo).map((p) => p.id);
    const nuevo = antes && premios.find((p) => ahora.includes(p.id) && !antes.includes(p.id));
    if (nuevo) { $('t-saldo').classList.add('pt-celebra'); toast(`¡Ya te alcanza para ${nuevo.nombre}!`); }
    localStorage.setItem(clave, JSON.stringify(ahora));
  } catch { /* sin almacenamiento */ }
}

let tokenActual = null;
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

function pintarTarjeta(t) {
  $('t-hola').textContent = `Hola, ${String(t.nombre || '').split(' ')[0]}`;
  contar($('t-numero'), t.saldo);
  const alcanzables = (t.premios || []).filter((p) => p.alcanzable);
  const progreso = t.cercano ? Math.min(100, Math.round((t.saldo / t.cercano.costo) * 100)) : (t.premios || []).length ? 100 : 0;
  requestAnimationFrame(() => requestAnimationFrame(() => $('t-saldo').style.setProperty('--progreso', String(progreso))));

  if (t.cercano) frase($('t-frase'), ['Te faltan ', { b: numero(t.cercano.faltan) }, ' para un ', { b: t.cercano.nombre }]);
  else if (alcanzables.length) frase($('t-frase'), ['Muéstrale tu código al cajero y ', { b: 'canjea tu premio' }, '.']);
  else frase($('t-frase'), [`Muestra tu código en la caja cada vez que vengas y gana ${plural}.`]);

  // Camino de premios (como Starbucks): cada premio es una parada; la barra se llena hasta el saldo
  pintarCamino(t);

  // Nivel discreto junto al negocio
  if (t.nivel && t.nivel.nombre) $('t-neg').textContent = `${t.negocio} · ${t.nivel.nombre}`;

  // Un solo aviso: el servidor ya eligió cuál (bienvenida → hora dorada → premio → racha → te faltan)
  const aviso = $('t-aviso');
  const a = t.aviso;
  const veces = (m) => (Number(m) === 2 ? 'el doble' : Number(m) === 3 ? 'el triple' : `×${String(m).replace('.', ',')}`);
  const textos = {
    bienvenida: () => [`Tus ${numero(a.n)} de bienvenida se activan en tu primera visita`, 'neutro'],
    hora_dorada: () => [`Hoy hasta las ${hora12(a.hasta)} ganas ${veces(a.multiplicador)}`, ''],
    premio: () => [`¡Ya te alcanza para ${a.nombre}!`, 'ok'],
    racha: () => [`Vuelve antes del domingo para mantener tu racha de ${numero(a.semanas)} semanas`, ''],
  };
  const elegido = a && textos[a.tipo] ? textos[a.tipo]() : null; // "te faltan" ya lo dice la frase
  aviso.hidden = !elegido;
  if (elegido) { aviso.textContent = elegido[0]; aviso.className = 'pt-aviso' + (elegido[1] ? ' ' + elegido[1] : ''); }

  // ¿Subió de nivel desde la última vez que abrió la tarjeta? Celebración una sola vez.
  try {
    const clave = CLAVE + '_nivel';
    const antes = localStorage.getItem(clave);
    if (t.nivel && t.nivel.nombre && antes && antes !== t.nivel.nombre && t.nivel.desde > 0) {
      $('t-saldo').classList.add('pt-celebra');
      toast(`¡Subiste a ${t.nivel.nombre}!`);
    }
    if (t.nivel && t.nivel.nombre) localStorage.setItem(clave, t.nivel.nombre);
  } catch { /* sin almacenamiento */ }

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
  if (!(t.premios || []).length) {
    const v = document.createElement('div');
    v.className = 'pt-vacio';
    v.textContent = 'Este negocio aún no tiene premios.';
    lista.append(v);
  }
  for (const p of t.premios || []) {
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

async function cargarTarjeta(token) {
  const t = await rpc('club_tarjeta', { p_slug: slug, p_token: token });
  if (!t || t.error) { borrarToken(); mostrar('registro'); return; }
  tokenActual = token;
  pintarTarjeta(t);
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
    if (r && r.token) { guardarToken(r.token); await cargarTarjeta(r.token); return; }
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
});
$('t-premios').addEventListener('click', () => hojaPremios.abrir());

// ── Arranque ─────────────────────────────────────────────────────────
const token = leerToken();
if (token) {
  cargarTarjeta(token).catch(() => {
    mostrar('registro');
    errorGeneral('No pudimos cargar tu tarjeta. Revisa tu internet y recarga.');
  });
} else {
  mostrar('registro');
}
