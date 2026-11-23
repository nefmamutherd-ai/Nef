// Utilidades compartidas por las funciones del servidor (Cloudflare Pages Functions)

// Encabezados para Supabase con la llave pública. Las llaves nuevas (sb_publishable_…) no son JWT:
// van solo en "apikey". Las antiguas (anon, JWT) también en "Authorization".
export function cabecerasSupabase(llave) {
  const h = { apikey: llave, 'Content-Type': 'application/json' };
  if (!String(llave || '').startsWith('sb_')) h.Authorization = `Bearer ${llave}`;
  return h;
}

export async function rpc(env, fn, args) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: cabecerasSupabase(env.SUPABASE_ANON_KEY),
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`rpc ${fn} → ${r.status}: ${await r.text()}`);
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Solo deja pasar links http/https (evita "javascript:" y similares)
export function urlSegura(u) {
  if (!u) return null;
  try {
    const x = new URL(String(u).trim());
    return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : null;
  } catch {
    return null;
  }
}

export function waLink(num) {
  let d = String(num ?? '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('3')) d = '57' + d; // celular colombiano sin indicativo
  return d.length >= 8 ? `https://wa.me/${d}` : null;
}

export function igLink(user) {
  const u = String(user ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(u) ? `https://instagram.com/${u}` : null;
}

export function dispositivo(ua) {
  ua = ua || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'otro';
}

// A qué URL lleva cada botón / destino
export function urlDeBoton(n, boton) {
  switch (boton) {
    case 'menu': return urlSegura(n.menu_url);
    case 'resena': return urlSegura(n.resena_url);
    case 'whatsapp': return waLink(n.whatsapp);
    case 'instagram': return igLink(n.instagram);
    default: {
      const m = /^link(\d{1,2})$/.exec(boton || '');
      if (m && Array.isArray(n.links) && n.links[+m[1]]) return urlSegura(n.links[+m[1]].url);
      return null;
    }
  }
}

export const colorSeguro = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#1f1f1f');

export function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function redirigir(location) {
  return new Response(null, { status: 302, headers: { Location: location, 'cache-control': 'no-store' } });
}

export function paginaError(env) {
  return html(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>Un momento</title><body style="font-family:system-ui;padding:40px 24px;text-align:center;color:#333">
     <h2>Estamos teniendo un problema</h2><p>Intenta de nuevo en un momento 🙏</p></body>`,
    503
  );
}
