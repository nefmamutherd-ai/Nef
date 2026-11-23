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
  $('t-numero').textContent = numero(t.saldo);
  const alcanzables = (t.premios || []).filter((p) => p.alcanzable);
  const progreso = t.cercano ? Math.min(100, Math.round((t.saldo / t.cercano.costo) * 100)) : (t.premios || []).length ? 100 : 0;
  $('t-saldo').style.setProperty('--progreso', String(progreso));

  if (t.cercano && !alcanzables.length) frase($('t-frase'), ['Te faltan ', { b: numero(t.cercano.faltan) }, ' para un ', { b: t.cercano.nombre }]);
  else if (alcanzables.length) frase($('t-frase'), ['¡Ya puedes canjear ', { b: alcanzables[alcanzables.length - 1].nombre }, '!']);
  else frase($('t-frase'), [`Muestra tu código en la caja cada vez que vengas y gana ${plural}.`]);

  // Un solo aviso: la bienvenida pendiente
  const aviso = $('t-aviso');
  aviso.hidden = !(t.bienvenida_pendiente > 0);
  if (t.bienvenida_pendiente > 0) aviso.textContent = `Tus ${numero(t.bienvenida_pendiente)} de bienvenida se activan en tu primera visita`;

  // Lista de premios (hoja)
  const lista = $('lista-premios');
  lista.textContent = '';
  if (!(t.premios || []).length) {
    const v = document.createElement('div');
    v.className = 'pt-vacio';
    v.textContent = 'Este negocio aún no tiene premios.';
    lista.append(v);
  }
  for (const p of t.premios || []) {
    const d = document.createElement('div');
    d.className = 'pt-dato';
    const s = document.createElement('small');
    s.textContent = `${numero(p.costo)} ${plural} · ${pesos(p.valor_pesos)}${p.alcanzable ? ' · ¡Ya te alcanza!' : ''}`;
    const b = document.createElement('b');
    b.textContent = p.nombre;
    d.append(s, b);
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
