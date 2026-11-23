// Llamar una RPC pública de Supabase desde el navegador (portales, club y caja).
// Requiere <script src="/api/config"></script> antes (define window.TOQUE con url y anon).
// Si no hay red, lanza un Error con .sinRed = true (la caja lo usa para guardar en la cola).
export function cabecerasSupabase(llave) {
  const h = { apikey: llave, 'Content-Type': 'application/json' };
  if (!String(llave || '').startsWith('sb_')) h.Authorization = `Bearer ${llave}`;
  return h;
}

export async function rpc(fn, args) {
  const cfg = window.TOQUE || {};
  let r;
  try {
    r = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: cabecerasSupabase(cfg.anon),
      body: JSON.stringify(args || {}),
    });
  } catch (e) {
    const err = new Error('Sin conexión');
    err.sinRed = true;
    throw err;
  }
  if (r.status >= 500) {
    const err = new Error('Servidor no disponible');
    err.sinRed = true;
    throw err;
  }
  const txt = await r.text();
  if (!r.ok) throw new Error(txt || 'Error ' + r.status);
  return txt ? JSON.parse(txt) : null;
}

export const numero = (n) => new Intl.NumberFormat('es-CO').format(n || 0);
export const pesos = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
export const hora = (iso) =>
  new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso));

// Hoja inferior: abre/cierra con animación, cierra con el fondo, Escape o [data-cerrar]
export function hoja(el) {
  const fondo = el.previousElementSibling && el.previousElementSibling.classList.contains('pt-fondo') ? el.previousElementSibling : null;
  const cerrar = () => {
    el.classList.remove('abierta');
    if (fondo) fondo.classList.remove('abierta');
    setTimeout(() => { el.hidden = true; if (fondo) fondo.hidden = true; }, 300);
  };
  const abrir = () => {
    el.hidden = false;
    if (fondo) fondo.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('abierta'); if (fondo) fondo.classList.add('abierta'); }));
  };
  if (fondo) fondo.addEventListener('click', cerrar);
  el.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrar));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) cerrar(); });
  return { abrir, cerrar };
}
