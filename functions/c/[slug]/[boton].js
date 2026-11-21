// /c/<slug>/<boton>?t=<codigo> → registra el clic en un botón de la página del negocio y redirige
import { rpc, urlDeBoton, redirigir } from '../../../lib/util.js';

export async function onRequest({ params, request, env }) {
  const url = new URL(request.url);
  const slug = String(params.slug || '');
  const boton = String(params.boton || '');
  const codigo = url.searchParams.get('t') || null;
  const volver = new URL(`/n/${encodeURIComponent(slug)}`, url).href;

  let n = null;
  try {
    n = await rpc(env, 'registrar_click', { p_slug: slug, p_boton: boton, p_codigo: codigo });
  } catch (e) {
    console.error(e);
  }
  if (boton === 'wifi') return new Response(null, { status: 204 });
  if (!n) return redirigir(volver);
  return redirigir(urlDeBoton(n, boton) || volver);
}
