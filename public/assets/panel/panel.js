// /panel — el dueño entra con su correo y ve SOLO su empresa (RLS por `accesos`, Fase 8).
// Los datos del negocio llegan por panel_negocios() (sin notas, token ni PIN) y las estadísticas por stats_dueno().
// Catálogo e importador: los mismos módulos del admin. Datos → textContent / esc().
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { renderStats } from '/assets/stats.js';
import { montarCatalogo } from '/assets/admin-catalogo.js';
import { montarImportador } from '/assets/importar.js';
import { pintarEnRiesgo } from '/assets/panel/en-riesgo.js';
import { montarClub } from '/assets/panel/club.js';
import { montarTutorial } from '/assets/panel/tutorial.js';

const cfg = window.TOQUE || {};
const sb = createClient(cfg.url, cfg.anon);
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const SECCIONES = {
  resumen: ['Resumen', 'Cómo te fue. Pasa el dedo o el mouse por cada "?" para ver qué significa.'],
  clientes: ['Clientes', 'Quién dejó de venir, para escribirle a tiempo.'],
  catalogo: ['Catálogo', 'Tu carta o tus máquinas y clases. Lo que cambies se ve en el portal al instante.'],
  club: ['Club', 'Premios, cuánto devuelves de verdad y el PIN de la caja.'],
  informes: ['Informes', 'El análisis trimestral de Nef.'],
};
const GUARDA = 'nef.panel.sede';

let negocios = [];
let actual = null;
let pestana = 'resumen';

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('visible'), 2600);
}
const aviso = (clase, msg) => { const a = $('#l-aviso'); a.className = 'n-aviso ' + clase; a.textContent = msg || ''; a.hidden = !msg; };
const mostrar = (id) => ['login', 'sin-acceso', 'app'].forEach((x) => ($('#' + x).hidden = x !== id));
const guardar = (v) => { try { localStorage.setItem(GUARDA, v); } catch { /* sin almacenamiento: no pasa nada */ } };
const leer = () => { try { return localStorage.getItem(GUARDA); } catch { return null; } };

// ---------------- Entrar / crear cuenta ----------------
let creando = false;
function modo(crear) {
  creando = crear;
  $('#l-titulo').textContent = crear ? 'Crea tu cuenta' : 'Tu panel';
  $('#l-sub').textContent = crear ? 'Usa el correo que le diste a Nef. La contraseña, de 8 o más caracteres.' : 'Entra con el correo que le diste a Nef.';
  $('#l-enviar').textContent = crear ? 'Crear cuenta' : 'Entrar';
  $('#l-modo').textContent = crear ? 'Ya tengo cuenta: entrar' : '¿Primera vez? Crea tu cuenta';
  $('#l-clave').autocomplete = crear ? 'new-password' : 'current-password';
  $('#l-acepta-caja').hidden = !crear;
  aviso('', '');
}
$('#l-modo').addEventListener('click', () => modo(!creando));
$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  aviso('', '');
  const email = $('#l-email').value.trim();
  const password = $('#l-clave').value;
  $('#l-enviar').disabled = true;
  try {
    if (creando) {
      if (!$('#l-acepta').checked) return aviso('alerta', 'Para crear tu cuenta, acepta los términos y la política de privacidad.');
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + '/panel' } });
      if (error) return aviso('alerta', /already|registered|exists/i.test(error.message) ? 'Ese correo ya tiene cuenta: entra con tu contraseña.' : 'No se pudo crear la cuenta: ' + error.message);
      if (!data.session) return aviso('ok', `Te enviamos un correo a ${email}. Ábrelo, confirma tu cuenta y vuelve a entrar aquí.`);
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return aviso('alerta', /confirm/i.test(error.message) ? 'Primero confirma tu cuenta con el link que te llegó al correo.' : 'Correo o contraseña incorrectos.');
    }
    await iniciar();
  } finally { $('#l-enviar').disabled = false; }
});
const salir = async () => { await sb.auth.signOut(); location.reload(); };
$('#salir').addEventListener('click', salir);
$('#sa-salir').addEventListener('click', salir);

// ---------------- Sesión y sedes ----------------
async function iniciar() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { mostrar('login'); return; }
  const { data, error } = await sb.rpc('panel_negocios');
  if (error) { mostrar('login'); aviso('alerta', 'No pudimos cargar tu panel. Intenta de nuevo.'); return; }
  negocios = data || [];
  if (!negocios.length) {
    $('#sa-email').textContent = session.user.email || '';
    const { data: admin } = await sb.rpc('es_admin');
    $('#sa-admin').hidden = !admin;
    mostrar('sin-acceso');
    return;
  }
  const sel = $('#sede');
  sel.textContent = '';
  negocios.forEach((n) => sel.append(new Option(n.ubicacion ? `${n.nombre} · ${n.ubicacion}` : n.nombre, n.id)));
  $('#sede-caja').hidden = negocios.length < 2;
  const recordada = leer();
  elegir(negocios.find((n) => n.id === recordada) || negocios[0]);
  mostrar('app');
  // Admin (Jacobo) revisando: aviso arriba; puede elegir cualquier negocio en el selector
  if (negocios.some((n) => n.rol === 'admin') && !document.getElementById('aviso-admin')) {
    const a = document.createElement('div');
    a.className = 'n-aviso n-aviso-admin';
    a.id = 'aviso-admin';
    a.textContent = 'Estás viendo el panel tal como lo ve el dueño del negocio. Cambia de negocio arriba.';
    const barra = document.querySelector('#app .n-barra');
    barra.after(a);
    $('#sede-caja').hidden = false;
  }
  guia.primeraVez();
}
$('#sede').addEventListener('change', () => elegir(negocios.find((n) => n.id === $('#sede').value)));

function elegir(n) {
  actual = n;
  guardar(n.id);
  $('#sede').value = n.id;
  $('#sede-nombre').textContent = negocios.length < 2 ? n.nombre : '';
  $('#empresa').textContent = n.empresa === n.nombre ? 'Tu negocio' : n.empresa;
  document.title = `${n.nombre} · Tu panel`;
  $('#apagado').hidden = n.habilitado;
  const sv = n.servicios || {};
  const visibles = { resumen: true, clientes: true, catalogo: !!sv.catalogo, club: !!sv.club, informes: true };
  document.querySelectorAll('.tab').forEach((b) => (b.hidden = !visibles[b.dataset.tab]));
  $('#c-entradas').hidden = n.sector !== 'gimnasio';
  ir(visibles[pestana] ? pestana : 'resumen');
}

// ---------------- Pestañas ----------------
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => ir(b.dataset.tab)));
function ir(tab) {
  pestana = tab;
  document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === tab)));
  Object.keys(SECCIONES).forEach((t) => ($(`#tab-${t}`).hidden = t !== tab));
  $('#titulo-seccion').textContent = tab === 'resumen' ? actual.nombre : SECCIONES[tab][0];
  $('#sub-seccion').textContent = SECCIONES[tab][1];
  $('#periodo-caja').hidden = tab !== 'resumen';
  if (tab === 'resumen' || tab === 'clientes') cargarStats();
  if (tab === 'catalogo') catalogo.cargar();
  if (tab === 'club') club.cargar();
  if (tab === 'informes') cargarInformes();
}

// ---------------- Resumen y clientes ----------------
async function cargarStats() {
  const id = actual.id;
  const { data, error } = await sb.rpc('stats_dueno', { p_negocio: id, p_dias: +$('#dias').value });
  if (id !== actual.id) return; // cambiaron de sede mientras cargaba
  if (error || !data) { toast('No pudimos cargar las estadísticas'); return; }
  await renderStats($('#r-stats'), data.stats);
  const g = data.stats.gimnasio;
  pintarEnRiesgo($('#r-riesgo'), g, actual.nombre, { limite: 5 });
  pintarEnRiesgo($('#c-riesgo'), g, actual.nombre, { limite: 200 });
  club.devolucion(data.stats.nivel1 && data.stats.nivel1.devolucion_real);
}
$('#dias').addEventListener('change', cargarStats);

// ---------------- Catálogo, club e importador (módulos compartidos) ----------------
// Guía paso a paso: sola la primera vez; el botón "Guía" la repite
const guia = montarTutorial({
  ir,
  pestanaVisible: (tab) => (tab === 'entradas' ? !!actual && actual.sector === 'gimnasio' : !document.querySelector(`.tab[data-tab="${tab}"]`).hidden),
});
$('#guia').addEventListener('click', () => guia.abrir());

const catalogo = montarCatalogo({ sb, toast, esc, negocioActual: () => actual && actual.id, alCambiar: () => {} });
const club = montarClub({ sb, toast, esc, negocio: () => actual, alCambiarPin: (n) => { n.tiene_pin = true; } });
montarImportador({ sb, toast, negocioActual: () => actual && actual.id, negocios: () => negocios, alTerminar: cargarStats });

// ---------------- Informes (URL firmada de 1 hora; el PDF es privado) ----------------
async function cargarInformes() {
  const ul = $('#lista-informes');
  ul.textContent = '';
  const { data, error } = await sb.from('informes').select('id, periodo, ruta, creado').eq('negocio_id', actual.id).order('creado', { ascending: false });
  if (error) { toast('No se cargaron los informes'); return; }
  if (!data.length) {
    const li = document.createElement('li');
    const v = document.createElement('div'); v.className = 'n-vacio n-principal';
    const b = document.createElement('b'); b.textContent = 'Aún no hay informes';
    v.append(b, 'El primero llega al cerrar el trimestre.');
    li.append(v); ul.append(li);
    return;
  }
  for (const i of data) {
    const li = document.createElement('li');
    const p = document.createElement('div'); p.className = 'n-principal';
    const b = document.createElement('b'); b.textContent = i.periodo;
    const s = document.createElement('span'); s.textContent = 'Publicado el ' + new Date(i.creado).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    p.append(b, s);
    const a = document.createElement('button'); a.type = 'button'; a.className = 'n-btn chico secundario'; a.textContent = 'Abrir';
    a.addEventListener('click', async () => {
      const ventana = window.open('', '_blank'); // se abre ya (si no, el navegador la bloquea) y luego recibe la URL
      const { data: f, error: e2 } = await sb.storage.from('informes').createSignedUrl(i.ruta, 3600);
      if (e2 || !f) { if (ventana) ventana.close(); toast('No se pudo abrir el informe'); return; }
      if (ventana) ventana.location = f.signedUrl; else location.href = f.signedUrl;
    });
    li.append(p, a);
    ul.append(li);
  }
}

iniciar().catch(() => { mostrar('login'); aviso('alerta', 'Revisa tu internet e intenta de nuevo.'); });
