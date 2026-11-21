// /t/<codigo>      → lo que va grabado en el chip NFC
// /t/<codigo>?q    → lo que va en el código QR (así se distingue NFC vs QR en las estadísticas)
import { rpc, dispositivo, urlDeBoton, urlSegura, redirigir, paginaError } from '../../lib/util.js';

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const codigo = String(params.codigo || '').toLowerCase();
  const medio = url.searchParams.has('q') ? 'qr' : 'nfc';

  let r;
  try {
    r = await rpc(env, 'resolver_toque', {
      p_codigo: codigo,
      p_medio: medio,
      p_dispositivo: dispositivo(request.headers.get('user-agent')),
    });
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }

  if (!r || r.estado !== 'ok') return redirigir(new URL('/inactivo', url).href);

  const hub = new URL(`/n/${encodeURIComponent(r.slug)}`, url);
  hub.searchParams.set('t', codigo);

  let destino = null;
  if (r.destino === 'url') destino = urlSegura(r.url);
  else if (r.destino === 'wifi') hub.hash = 'wifi';
  else if (r.destino !== 'hub') destino = urlDeBoton(r, r.destino);

  // Si el destino directo no está configurado, cae a la página del negocio
  return redirigir(destino || hub.href);
}
