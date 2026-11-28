// /n/<slug>/app.webmanifest → la "ficha de app" del negocio para instalar su portal en el celular (27/11/2026: Jacobo,
// "para los gimnasios, por los horarios"). Solo para sectores con "instalable" en su paquete (hoy: gimnasio).
import { rpc, colorSeguro } from '../../../lib/util.js';
import { paquete } from '../../../lib/sectores.js';

export async function onRequestGet({ params, env }) {
  const slug = String(params.slug || '').toLowerCase();
  let n;
  try { n = await rpc(env, 'negocio_publico', { p_slug: slug }); } catch (e) { console.error(e); n = null; }
  if (!n || !paquete(n.sector).instalable) return new Response('No encontrado', { status: 404 });
  const base = `/n/${encodeURIComponent(n.slug)}`;
  const color = colorSeguro(n.color);
  const ficha = {
    name: n.nombre,
    short_name: n.nombre.length > 12 ? n.nombre.split(/\s+/)[0].slice(0, 12) : n.nombre,
    description: n.descripcion || `${n.nombre} en tu celular: clases, tu racha y tus premios.`,
    lang: 'es-CO',
    start_url: `${base}?app=1`,
    scope: `${base}`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: color,
    icons: [
      { src: `${base}/icono.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/assets/marca/icono-app-nef.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
  return new Response(JSON.stringify(ficha), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
