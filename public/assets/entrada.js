// Entrada por NFC (gimnasio sin torniquete): usa el token del club guardado en este celular.
import { rpc, hora } from '/assets/nef-rpc.js';

const raiz = document.getElementById('entrada');
const slug = raiz.dataset.slug;
const $ = (id) => document.getElementById(id);
let token = null;
try { token = localStorage.getItem('nef_club_' + slug); } catch { /* sin almacenamiento */ }
// Respaldo: la cookie que deja el club (en iPhone a veces se pierde el almacenamiento)
if (!token) { try { const m = document.cookie.match(new RegExp('(?:^|; )nef_club_' + slug + '=([^;]*)')); token = m ? decodeURIComponent(m[1]) : null; } catch { /* nada */ } }

function listo(r) {
  $('cargando').hidden = true;
  $('e-titulo').textContent = r.repetida ? 'Ya registraste tu entrada hoy' : '¡Entrada registrada!';
  $('e-hora').textContent = `Hoy, ${hora(r.hora)}${r.sede ? ' · ' + r.sede : ''}`;
  $('e-racha').textContent = String(r.racha);
  $('e-racha-txt').textContent = r.racha === 1 ? 'semana seguida viniendo' : 'semanas seguidas viniendo';
  const sem = $('e-semanas');
  sem.textContent = '';
  for (const on of r.semanas || []) { const i = document.createElement('i'); if (on) i.className = 'on'; sem.append(i); }
  $('hecho').hidden = false;
  if (!r.repetida) document.querySelector('.pt-check').classList.add('pt-celebra');
}

if (!token) {
  $('cargando').hidden = true;
  $('sin-club').hidden = false;
} else {
  rpc('registrar_entrada_nfc', { p_slug: slug, p_token: token })
    .then((r) => {
      if (r && r.ok) return listo(r);
      $('cargando').hidden = true;
      if (r && r.error === 'token') { try { localStorage.removeItem('nef_club_' + slug); } catch { /* nada */ } $('sin-club').hidden = false; }
      else $('e-error').hidden = false;
    })
    .catch(() => { $('cargando').hidden = true; $('e-error').hidden = false; });
}
