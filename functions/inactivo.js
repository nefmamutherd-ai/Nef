// Se muestra cuando un tag no está asignado, está apagado o el negocio no está activo.
// Ojo: esto también es publicidad gratis — quien toque un tag sin activar ve cómo contactarte.
import { esc, html, waLink } from '../lib/util.js';

export function onRequestGet({ env }) {
  const marca = esc(env.MARCA || 'Nef');
  const wa = waLink(env.CONTACTO_WHATSAPP);
  const msg = encodeURIComponent(`Hola, vi ${env.MARCA || 'Nef'} en un negocio y quiero información para el mío`);
  return html(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${marca}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,sans-serif;background:#f4f3ef;color:#1b1b1b;text-align:center;padding:24px;box-sizing:border-box}
  .k{max-width:360px} .ico{font-size:46px} h1{font-size:22px;margin:12px 0 8px} p{color:#5b5b5b;line-height:1.5}
  a{display:inline-block;margin-top:14px;padding:15px 20px;border-radius:14px;background:#1f1f1f;color:#fff;text-decoration:none;font-weight:600}
</style></head><body><div class="k">
  <div class="ico">📲</div>
  <h1>Este código aún no está activo</h1>
  <p>Si eres el dueño, pronto quedará listo.<br>¿Quieres uno para tu negocio? Tus clientes ven tu menú, te dejan reseñas y se conectan al WiFi solo con acercar el celular.</p>
  ${wa ? `<a href="${wa}?text=${msg}">Quiero uno para mi negocio</a>` : ''}
</div></body></html>`);
}
