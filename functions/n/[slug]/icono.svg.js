// /n/<slug>/icono.svg → ícono de la app instalada: las iniciales del negocio sobre su color (sin subir imágenes).
import { rpc, esc, colorSeguro } from '../../../lib/util.js';
import { textoSobre } from '../../../lib/portal.js';

const iniciales = (nombre) =>
  String(nombre || '?').trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase() || '?';

export async function onRequestGet({ params, env }) {
  const slug = String(params.slug || '').toLowerCase();
  let n;
  try { n = await rpc(env, 'negocio_publico', { p_slug: slug }); } catch (e) { console.error(e); n = null; }
  if (!n) return new Response('No encontrado', { status: 404 });
  const fondo = colorSeguro(n.color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="112" fill="${fondo}"/>
<text x="256" y="300" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="800" font-size="200" letter-spacing="-6" fill="${textoSobre(fondo)}">${esc(iniciales(n.nombre))}</text>
</svg>`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
