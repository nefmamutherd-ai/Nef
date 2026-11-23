// /n/<slug>/entrada → registrar la entrada al gimnasio con el chip de la puerta.
// SOLO para gimnasios sin torniquete (servicios.entrada_nfc). Suma asistencia, nunca monedas.
import { rpc, esc, html, redirigir, paginaError } from '../../../lib/util.js';
import { inicioPagina, firma, icono } from '../../../lib/portal.js';

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
  if (!(n.servicios && n.servicios.entrada_nfc)) return redirigir(new URL(`/n/${encodeURIComponent(n.slug)}`, url).href);

  return html(`${inicioPagina(n, { titulo: `Entrada · ${n.nombre}`, extraHead: '<meta name="robots" content="noindex"><script src="/api/config"></script>' })}
<main class="pt-pagina" id="entrada" data-slug="${esc(n.slug)}">
  <div id="cargando"><div class="pt-cargando"></div></div>
  <section class="pt-hecho" id="hecho" hidden>
    <div class="pt-check">${icono('check')}</div>
    <h1 id="e-titulo">¡Entrada registrada!</h1>
    <div class="pt-hora" id="e-hora"></div>
    <div class="pt-racha"><b id="e-racha">1</b><span id="e-racha-txt">semana seguida viniendo</span><div class="pt-semanas" id="e-semanas"></div></div>
  </section>
  <section class="pt-vacio" id="sin-club" hidden>
    <b>Únete para registrar tu entrada</b>
    <p>Inscríbete una vez con tu celular y luego solo acercas el tuyo a este punto.</p>
    <a class="pt-accion marca" href="/n/${encodeURIComponent(n.slug)}/club">Unirme</a>
  </section>
  <div class="pt-aviso alerta" id="e-error" hidden>No pudimos registrar tu entrada. Revisa tu internet e inténtalo otra vez.</div>
  ${firma()}
</main>
<script type="module" src="/assets/entrada.js"></script>
</body></html>`);
}
