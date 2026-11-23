// /t/<codigo>      → lo que va grabado en el chip NFC
// /t/<codigo>?q    → lo que va en el código QR (así se distingue NFC vs QR en las estadísticas)
// Cookie anónima nef_d (uuid, sin datos personales): un toque por dispositivo y tag cada 30 min.
import { rpc, dispositivo, urlDeBoton, urlSegura, redirigir, paginaError } from '../../lib/util.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function leerCookie(request, nombre) {
  for (const parte of (request.headers.get('cookie') || '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim();
  }
  return null;
}

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const codigo = String(params.codigo || '').toLowerCase();
  const medio = url.searchParams.has('q') ? 'qr' : 'nfc';
  let disp = leerCookie(request, 'nef_d');
  if (!disp || !UUID.test(disp)) disp = crypto.randomUUID();

  let r;
  try {
    r = await rpc(env, 'resolver_toque', {
      p_codigo: codigo,
      p_medio: medio,
      p_dispositivo: dispositivo(request.headers.get('user-agent')),
      p_dispositivo_id: disp,
    });
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }

  let res;
  if (!r || r.estado !== 'ok') {
    res = redirigir(new URL('/inactivo', url).href);
  } else {
    const hub = new URL(`/n/${encodeURIComponent(r.slug)}`, url);
    hub.searchParams.set('t', codigo);

    const base = `/n/${encodeURIComponent(r.slug)}`;
    let destino = null;
    if (r.destino === 'url') destino = urlSegura(r.url);
    else if (r.destino === 'wifi') hub.hash = 'wifi';
    else if (r.destino === 'club') destino = new URL(`${base}/club`, url).href;
    else if (r.destino === 'entrada') destino = new URL(`${base}/entrada`, url).href;
    else if (r.destino === 'producto') destino = r.producto_id ? new URL(`${base}/p/${encodeURIComponent(r.producto_id)}`, url).href : null;
    else if (r.destino !== 'hub') destino = urlDeBoton(r, r.destino);

    // Si el destino directo no está configurado, cae a la página del negocio
    res = redirigir(destino || hub.href);
  }
  res = new Response(res.body, res);
  res.headers.append('Set-Cookie', `nef_d=${disp}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`);
  return res;
}
