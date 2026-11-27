// "Entrena con el tutorial" en la página de una máquina del gimnasio (Jacobo, 26/11/2026).
// Empezar → cronómetro de N minutos (15) → "Terminé" → monedas fijas. Las reglas contra trampas viven en la base
// (club_maquina_empezar / club_maquina_terminar): llegada registrada hoy en recepción, N horas entre premios, vence a las 3 h.
import { rpc, numero } from '/assets/nef-rpc.js';

const raiz = document.getElementById('entreno');
const slug = raiz.dataset.slug;
const producto = raiz.dataset.producto;
const $ = (id) => document.getElementById(id);
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
const borrar = (k) => { try { localStorage.removeItem(k); } catch { /* nada */ } };
const token = leer('nef_club_' + slug);
const CLAVE = 'nef_entreno_' + slug;
const hora = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
let reloj = null;

function estado(texto) { $('e-estado').textContent = texto; }
function mostrar(boton) {
  $('e-empezar').hidden = boton !== 'empezar';
  $('e-terminar').hidden = boton !== 'terminar';
  $('e-club').hidden = boton !== 'club';
}

function contar(sesion) {
  clearInterval(reloj);
  const inicio = new Date(sesion.inicio).getTime();
  const listo = new Date(sesion.listo).getTime();
  mostrar('terminar');
  const tic = () => {
    const falta = Math.max(0, listo - Date.now());
    const m = Math.floor(falta / 60000), s = Math.floor((falta % 60000) / 1000);
    $('e-reloj').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    $('e-barra').style.width = `${Math.min(100, ((Date.now() - inicio) / (listo - inicio)) * 100)}%`;
    $('e-terminar').disabled = falta > 0;
    if (falta > 0) estado(`Sigue el tutorial y entrena. Al terminar el tiempo ganas ${numero(sesion.monedas)} monedas.`);
    else { estado('¡Tiempo cumplido! Toca "Terminé" para ganar tus monedas.'); clearInterval(reloj); }
  };
  tic();
  reloj = setInterval(tic, 1000);
}

const ERRORES = {
  sin_llegada: 'Primero registra tu llegada: en recepción, escanea el QR de la pantalla con "Registrar mi llegada".',
  maquina: 'Esta máquina no da monedas.',
  vencida: 'Ese entrenamiento quedó abierto mucho tiempo. Empieza uno nuevo.',
  no_existe: 'Empieza un entrenamiento nuevo.',
};
function error(r) {
  if (r && r.error === 'token') { mostrarUnirse(); return; }
  if (r && r.error === 'muy_pronto' && r.desde) { estado(`Ya ganaste por entrenar con tutorial. Vuelve a ganar desde las ${hora(r.desde)}.`); return; }
  estado(ERRORES[r && r.error] || 'No pudimos registrar tu entrenamiento. Intenta otra vez.');
}
function mostrarUnirse() {
  mostrar('club');
  estado('Únete al club y gana monedas cada vez que entrenas con el tutorial.');
}

$('e-empezar').addEventListener('click', async () => {
  $('e-empezar').disabled = true;
  let r;
  try { r = await rpc('club_maquina_empezar', { p_slug: slug, p_token: token, p_producto: producto }); } catch { r = null; }
  $('e-empezar').disabled = false;
  if (!r || r.error) { error(r); return; }
  guardar(CLAVE, JSON.stringify(r));
  contar(r);
});
$('e-terminar').addEventListener('click', async () => {
  const sesion = JSON.parse(leer(CLAVE) || 'null');
  if (!sesion) { mostrar('empezar'); return; }
  $('e-terminar').disabled = true;
  let r;
  try { r = await rpc('club_maquina_terminar', { p_slug: slug, p_token: token, p_sesion: sesion.sesion }); } catch { r = null; }
  if (r && r.error === 'falta') { contar({ ...sesion, listo: r.listo }); return; }
  borrar(CLAVE);
  clearInterval(reloj);
  mostrar('empezar');
  if (!r || r.error) { error(r); return; }
  $('e-reloj').textContent = `+${numero(r.monedas)}`;
  $('e-barra').style.width = '100%';
  estado(`¡Bien hecho! Ganaste ${numero(r.monedas)} monedas. Ahora tienes ${numero(r.saldo)}.`);
  try { navigator.vibrate && navigator.vibrate([20, 40, 30]); } catch { /* nada */ }
});

// Arranque: sin club → invitar; con un entrenamiento en curso (de las últimas 3 horas) → seguir el cronómetro
raiz.hidden = false;
if (!token) mostrarUnirse();
else {
  const sesion = JSON.parse(leer(CLAVE) || 'null');
  if (sesion && Date.now() - new Date(sesion.inicio).getTime() < 3 * 3600e3) contar(sesion);
  else { borrar(CLAVE); mostrar('empezar'); }
}
