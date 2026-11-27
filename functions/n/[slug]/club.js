// /n/<slug>/club → inscripción al club y tarjeta "Mis monedas" (SSR + public/assets/club.js).
// La tarjeta se abre con el token propio del cliente guardado en su celular (localStorage), nunca con el slug.
import { rpc, esc, html, redirigir, paginaError } from '../../../lib/util.js';
import { inicioPagina, firma, icono, fondoVivo } from '../../../lib/portal.js';

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
  const portal = `/n/${encodeURIComponent(n.slug)}`;
  const gym = n.sector === 'gimnasio';

  return html(`${inicioPagina(n, { titulo: `Club · ${n.nombre}`, extraHead: '<meta name="robots" content="noindex"><script src="/api/config"></script><script src="/assets/qrcode.js"></script>' })}
${fondoVivo(n.sector)}
<main class="pt-pagina" id="club" data-slug="${esc(n.slug)}" data-plural="${plural}" data-singular="${esc(c.moneda_singular)}" data-modo="${esc(c.modo)}" data-por-visita="${esc(c.monedas_por_visita)}">

  <div id="cargando"><div class="pt-cargando"></div><div class="pt-cargando"></div></div>

  <section id="registro" class="pt-club pt-club2 pt-entra" hidden>
    <div class="pt-club-top"><a class="pt-volver" href="${portal}">${icono('volver')}${esc(n.nombre)}</a></div>
    <div class="pt-pase muestra">
      <div class="pt-pase-fondo" aria-hidden="true"><span class="pt-ojo"><i></i></span></div>
      <p class="pt-pase-hola">Club ${esc(n.nombre)}</p>
      <div class="pt-pase-saldo"><span class="pt-moneda-g" aria-hidden="true"></span><b>${c.bienvenida > 0 ? esc(c.bienvenida) : '0'}</b></div>
      <p class="pt-pase-unidad">${c.bienvenida > 0 ? `${plural} de regalo al unirte` : `${plural} en cada visita`}</p>
    </div>
    <h1>Únete y gana en cada visita</h1>
    <p class="pt-frase">${c.bienvenida > 0 ? `Tus <b>${esc(c.bienvenida)} ${plural}</b> de regalo se activan en tu primera compra.` : `Gana ${plural} cada vez que vengas y cámbialas por premios.`}</p>
    <form class="pt-form" id="form-registro" novalidate>
      <div class="pt-campo" id="campo-nombre"><label for="r-nombre">Tu nombre</label>
        <input id="r-nombre" name="nombre" autocomplete="given-name" maxlength="60" required>
        <div class="pt-error" hidden>Escribe tu nombre.</div></div>
      <div class="pt-campo" id="campo-celular"><label for="r-celular">Tu celular</label>
        <input id="r-celular" name="celular" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="14" placeholder="300 123 4567" required>
        <div class="pt-error" hidden>Escribe los 10 números.</div></div>
      <label class="pt-casilla"><input type="checkbox" id="r-acepto"><span>Autorizo a ${esc(n.nombre)} a usar mi nombre y mi celular para el club y a escribirme por WhatsApp sobre él, según su <a href="${datos}">política de datos</a>.</span></label>
      <div class="pt-aviso alerta" id="r-error" hidden></div>
      <button type="submit" class="pt-accion marca" id="r-unirme" disabled>Unirme</button>
    </form>
  </section>

  <section id="tarjeta" class="pt-club pt-club2 pt-entra" hidden>
    <div class="pt-club-top"><a class="pt-volver" href="${portal}">${icono('volver')}${esc(n.nombre)}</a><span class="pt-nivel" id="t-neg"></span><span class="pt-chip-racha" id="t-racha" hidden>${icono('racha')}<b id="t-racha-n"></b></span></div>
    <div class="pt-pase" id="t-saldo">
      <div class="pt-pase-fondo" aria-hidden="true"><span class="pt-ojo"><i></i></span></div>
      <p class="pt-pase-hola" id="t-hola">Hola</p>
      <div class="pt-pase-saldo"><span class="pt-moneda-g" id="t-moneda" aria-hidden="true"></span><b id="t-numero">0</b></div>
      <p class="pt-pase-unidad">${plural}</p>
      <div class="pt-boleto" id="t-boleto" hidden>
        <span class="pt-lazo" aria-hidden="true"><i></i><i></i></span>
        <div><b id="t-regalo"></b><small>Se activan en tu primera compra</small></div>
      </div>
    </div>
    <span class="pt-aviso neutro" id="t-aviso" hidden></span>
    <!-- Lo primero después de la tarjeta: cómo sumar (la acción de todos los días) -->
    <div class="pt-sumar-bloque">
      <button type="button" class="pt-accion marca pt-accion-doble" id="t-escanear" hidden>${icono('qr')}<span><b>${gym ? 'Registrar mi llegada' : 'Sumar mis ' + plural}</b><small>${gym ? 'Escanea el QR de la recepción' : 'Escanea el QR que te muestra la caja'}</small></span></button>
      <button type="button" class="pt-accion" id="t-codigo">${icono('qr')}Mostrar mi código</button>
    </div>
    <div class="pt-meta pt-meta-mes" id="t-mes" hidden>
      <div class="pt-meta-fila"><div><small>Este mes</small><b id="t-mes-n"></b></div><span class="pt-meta-cuesta" id="t-mes-bono"></span></div>
      <div class="pt-entreno-barra" aria-hidden="true"><i id="t-mes-barra"></i></div>
      <p class="pt-frase" id="t-mes-frase"></p>
    </div>
    <div class="pt-meta" id="t-meta" hidden>
      <div class="pt-meta-fila"><div><small id="t-meta-titulo">Tu próximo premio</small><b id="t-meta-nombre"></b></div><span class="pt-meta-cuesta" id="t-meta-cuesta"></span></div>
      <div class="pt-ola" id="t-ola" aria-hidden="true"><div class="pt-ola-fantasma"></div><div class="pt-ola-lleno"><svg viewBox="0 0 960 16" preserveAspectRatio="none"><path d="M0 8 Q 12 5.5 24 8 T 48 8 T 72 8 T 96 8 T 120 8 T 144 8 T 168 8 T 192 8 T 216 8 T 240 8 T 264 8 T 288 8 T 312 8 T 336 8 T 360 8 T 384 8 T 408 8 T 432 8 T 456 8 T 480 8 T 504 8 T 528 8 T 552 8 T 576 8 T 600 8 T 624 8 T 648 8 T 672 8 T 696 8 T 720 8 T 744 8 T 768 8 T 792 8 T 816 8 T 840 8 T 864 8 T 888 8 T 912 8 T 936 8 T 960 8"/></svg></div></div>
      <p class="pt-frase" id="t-frase"></p>
    </div>
    <h2 class="pt-versalitas pt-sub">Tus premios</h2>
    <div class="pt-premios-fila" id="t-camino" hidden></div>
    <button type="button" class="pt-link" id="t-premios">Ver todos los premios</button>
    <details class="pt-como">
      <summary>¿Cómo gano ${plural}?</summary>
      <ol><li><i>${icono('carta')}</i><b>Compra</b><span>Pide lo que quieras</span></li>
      <li><i>${icono('qr')}</i><b>Escanea</b><span>el QR que te muestra la caja</span></li>
      <li><i>${icono('estrella')}</i><b>Canjea</b><span>tu premio cuando te alcance</span></li></ol>
    </details>
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
  <div class="pt-fondo" hidden></div>
  <div class="pt-hoja" id="hoja-lector" role="dialog" aria-label="Escanear el QR de la caja" hidden>
    <h2>Escanea el QR de la caja</h2>
    <video id="lector-video" playsinline muted class="pt-foto-grande"></video>
    <p>Pídele al cajero el QR de tu compra y apúntale con la cámara.</p>
    <button type="button" class="pt-link" data-cerrar>Cerrar</button>
  </div>
  <div class="pt-toast" id="toast" role="status"></div>

  ${firma()}
</main>
<script type="module" src="/assets/club.js"></script>
</body></html>`);
}
