// /api/informe?k=<token del dueño>&id=<informe> → redirige a una URL firmada de 1 hora del PDF.
// Valida el token con la RPC informe_ruta (solo devuelve rutas de SU negocio) y firma con la anon key:
// la política de Storage solo deja firmar rutas registradas en public.informes. Nunca la llave de servicio.
import { rpc, html, redirigir, cabecerasSupabase } from '../../lib/util.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noDisponible = () => html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Informe</title><link rel="stylesheet" href="/assets/nef-ui.css"><body class="nef"><main class="n-contenido">
<div class="n-tarjeta n-vacio"><b>Este informe no está disponible</b>Pídele a Nef un link nuevo.</div></main></body>`, 404);

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get('k') || '').slice(0, 64);
  const id = String(url.searchParams.get('id') || '');
  if (!token || !UUID.test(id)) return noDisponible();
  try {
    const ruta = await rpc(env, 'informe_ruta', { p_token: token, p_informe: id });
    if (!ruta) return noDisponible();
    const r = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/informes/${ruta.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: cabecerasSupabase(env.SUPABASE_ANON_KEY),
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    if (!r.ok) return noDisponible();
    const { signedURL } = await r.json();
    if (!signedURL || !signedURL.startsWith('/')) return noDisponible();
    return redirigir(`${env.SUPABASE_URL}/storage/v1${signedURL}`);
  } catch (e) {
    console.error(e);
    return noDisponible();
  }
}
