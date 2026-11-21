// Se muestra cuando un tag no está asignado, está apagado o el negocio no está activo.
// Ojo: esto también es publicidad gratis — quien toque un tag sin activar ve cómo conocer Nef.
import { esc, html, waLink } from '../lib/util.js';

export function onRequestGet({ env }) {
  const marca = esc(env.MARCA || 'Nef');
  const wa = waLink(env.CONTACTO_WHATSAPP);
  const msg = encodeURIComponent(`Hola, vi ${env.MARCA || 'Nef'} en un negocio y quiero información`);
  return html(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${marca}</title>
<link rel="stylesheet" href="/assets/nef-ui.css">
</head><body class="nef">
<main class="n-contenido">
  <div class="n-tarjeta n-vacio">
    <p><img class="n-logo" src="/assets/marca/logo-nef.svg" alt="${marca}" width="96" height="36"></p>
    <b>Este punto no está activo</b>
    Si eres el dueño del negocio, escríbenos para activarlo.
    <div><a class="n-btn principal" href="/">Conoce ${marca}</a></div>
    ${wa ? `<div><a class="n-btn fantasma" href="${esc(wa)}?text=${msg}">Escríbenos por WhatsApp</a></div>` : ''}
  </div>
</main>
</body></html>`);
}
