// /caja/<slug> → caja del negocio (PIN → sesión de 12 h → buscar cliente → Sumar / Canjear).
// SSR mínimo con el tema del negocio; public/assets/caja.js hace el resto (también sin conexión).
import { rpc, esc, html, redirigir, paginaError } from '../../lib/util.js';
import { inicioPagina, icono } from '../../lib/portal.js';

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const slug = String(params.slug || '').toLowerCase();
  let n;
  try {
    n = await rpc(env, 'negocio_publico', { p_slug: slug });
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }
  if (!n) return redirigir(new URL('/inactivo', url).href);
  const nombre = esc(n.nombre);

  return html(`${inicioPagina(n, { titulo: `Caja · ${n.nombre}`, extraHead: '<meta name="robots" content="noindex"><script src="/api/config"></script>' })}
<main class="pt-pagina" id="caja" data-slug="${esc(n.slug)}">
  <div class="pt-sin-conexion" id="sin-conexion" hidden></div>

  <section id="pantalla-pin" hidden>
    <div class="pt-caja-titulo"><small>Caja · ${nombre}</small><h1>PIN de la caja</h1></div>
    <form class="pt-form" id="form-pin" novalidate>
      <div class="pt-campo"><label for="pin">Escribe el PIN</label>
        <input id="pin" type="password" inputmode="numeric" autocomplete="off" pattern="[0-9]*" minlength="4" maxlength="6" required></div>
      <div class="pt-aviso alerta" id="pin-error" hidden></div>
      <button type="submit" class="pt-accion">Entrar</button>
    </form>
  </section>

  <section id="pantalla-buscar" hidden>
    <div class="pt-caja-titulo"><small>Caja · ${nombre}</small><h1>¿Cuál es tu número?</h1></div>
    <form id="form-buscar" novalidate>
      <label class="pt-caja-numero">${icono('buscar')}
        <input id="dato" type="tel" inputmode="tel" autocomplete="off" placeholder="300 123 4567" aria-label="Celular del cliente">
      </label>
    </form>
    <div id="escanear-bloque" hidden>
      <div class="pt-o">o</div>
      <button type="button" class="pt-escanear" id="escanear">${icono('qr')}Escanear su código</button>
    </div>
    <div class="pt-vacio" id="buscar-vacio" hidden></div>

    <div class="pt-cliente" id="ficha" hidden>
      <b id="f-nombre"></b>
      <div class="pt-mon" id="f-mon"><data id="f-saldo">0</data> <span id="f-plural"></span></div>
      <span class="pt-aviso" id="f-aviso" hidden></span>
      <div class="pt-campo" id="f-valor-campo" hidden><label for="f-valor">Valor de la compra</label>
        <input id="f-valor" type="text" inputmode="numeric" autocomplete="off" placeholder="$ 0"></div>
      <div class="pt-dos">
        <button type="button" class="pt-sumar" id="sumar">+ Sumar</button>
        <button type="button" class="pt-canjear" id="canjear">Canjear</button>
      </div>
    </div>
    <button type="button" class="pt-link" id="salir">Cerrar la caja</button>
  </section>

  <div class="pt-fondo" hidden></div>
  <div class="pt-hoja" id="hoja-canje" role="dialog" aria-label="Canjear" hidden>
    <h2>Canjear</h2>
    <div id="lista-canje"></div>
    <button type="button" class="pt-accion" id="confirmar-canje" hidden></button>
    <button type="button" class="pt-link" data-cerrar>Cancelar</button>
  </div>
  <div class="pt-fondo" hidden></div>
  <div class="pt-hoja" id="hoja-escaner" role="dialog" aria-label="Escanear" hidden>
    <h2>Escanear su código</h2>
    <video id="video" playsinline muted class="pt-foto-grande"></video>
    <button type="button" class="pt-link" data-cerrar>Cancelar</button>
  </div>
  <div class="pt-toast" id="toast" role="status"></div>
</main>
<script type="module" src="/assets/caja.js"></script>
</body></html>`);
}
