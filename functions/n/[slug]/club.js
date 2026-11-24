// /n/<slug>/club → inscripción al club y tarjeta "Mis monedas" (SSR + public/assets/club.js).
// La tarjeta se abre con el token propio del cliente guardado en su celular (localStorage), nunca con el slug.
import { rpc, esc, html, redirigir, paginaError } from '../../../lib/util.js';
import { inicioPagina, firma, icono } from '../../../lib/portal.js';

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const slug = String(params.slug || '').toLowerCase();
  let n, c;
  try {
    [n, c] = await Promise.all([rpc(env, 'negocio_publico', { p_slug: slug }), rpc(env, 'club_publico', { p_slug: slug })]);
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }
  if (!n) return redirigir(new URL('/inactivo', url).href);
  if (!c || !c.club) return redirigir(new URL(`/n/${encodeURIComponent(n.slug)}`, url).href);

  const plural = esc(c.moneda_plural);
  const datos = `/n/${encodeURIComponent(n.slug)}/datos`;

  return html(`${inicioPagina(n, { titulo: `Club · ${n.nombre}`, extraHead: '<meta name="robots" content="noindex"><script src="/api/config"></script><script src="/assets/qrcode.js"></script>' })}
<main class="pt-pagina" id="club" data-slug="${esc(n.slug)}" data-plural="${plural}" data-singular="${esc(c.moneda_singular)}">

  <div id="cargando"><div class="pt-cargando"></div><div class="pt-cargando"></div></div>

  <section id="registro" class="pt-club pt-entra" hidden>
    <div class="pt-neg pt-versalitas">${esc(n.nombre)}</div>
    <h1>Únete al club de ${esc(n.nombre)}</h1>
    <p class="pt-frase">${c.bienvenida > 0 ? `Recibe <b>${esc(c.bienvenida)} ${plural}</b> de bienvenida en tu primera visita.` : `Gana ${plural} cada vez que vengas.`}</p>
    <form class="pt-form" id="form-registro" novalidate>
      <div class="pt-campo" id="campo-nombre"><label for="r-nombre">Tu nombre</label>
        <input id="r-nombre" name="nombre" autocomplete="given-name" maxlength="60" required>
        <div class="pt-error" hidden>Escribe tu nombre.</div></div>
      <div class="pt-campo" id="campo-celular"><label for="r-celular">Tu celular</label>
        <input id="r-celular" name="celular" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="14" placeholder="300 123 4567" required>
        <div class="pt-error" hidden>Escribe los 10 números.</div></div>
      <label class="pt-casilla"><input type="checkbox" id="r-acepto"><span>Autorizo el uso de mis datos para el club. <a href="${datos}">Cómo se usan</a></span></label>
      <div class="pt-aviso alerta" id="r-error" hidden></div>
      <button type="submit" class="pt-accion marca" id="r-unirme" disabled>Unirme</button>
    </form>
  </section>

  <section id="tarjeta" class="pt-club pt-entra" hidden>
    <div class="pt-neg pt-versalitas" id="t-neg">${esc(n.nombre)}</div>
    <h1 id="t-hola">Hola</h1>
    <div class="pt-filete" aria-hidden="true"><i></i></div>
    <div class="pt-saldo" id="t-saldo"><div><b id="t-numero">0</b><span>${plural}</span><em class="pt-regalo" id="t-regalo" hidden></em></div></div>
    <p class="pt-frase" id="t-frase"></p>
    <div class="pt-camino" id="t-camino" aria-hidden="true" hidden></div>
    <span class="pt-aviso neutro" id="t-aviso" hidden></span>
    <button type="button" class="pt-accion" id="t-codigo">${icono('qr')}Mostrar mi código</button>
    <button type="button" class="pt-link" id="t-premios">Ver todos los premios</button>
    <a class="pt-link" href="${datos}">Condiciones del club</a>
  </section>

  <div class="pt-fondo" hidden></div>
  <div class="pt-hoja" id="hoja-codigo" role="dialog" aria-label="Mi código" hidden>
    <h2>Mi código</h2>
    <div class="pt-qr" id="qr"></div>
    <p>Muéstraselo al cajero</p>
    <p class="pt-espera" id="t-espera"><i aria-hidden="true"></i>Tus ${plural} aparecen aquí apenas te las sume</p>
    <button type="button" class="pt-link" data-cerrar>Cerrar</button>
  </div>
  <div class="pt-fondo" hidden></div>
  <div class="pt-hoja" id="hoja-premios" role="dialog" aria-label="Premios" hidden>
    <h2>Premios</h2>
    <div id="lista-premios"></div>
    <button type="button" class="pt-link" data-cerrar>Cerrar</button>
  </div>
  <div class="pt-toast" id="toast" role="status"></div>

  ${firma()}
</main>
<script type="module" src="/assets/club.js"></script>
</body></html>`);
}
