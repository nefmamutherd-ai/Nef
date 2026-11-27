// /n/<slug>/clases → clases de la semana (hora Bogotá): un día por pestaña, abre en hoy (Jacobo, 27/11/2026: "que haya
// más eventos"). Antes solo mostraba las de hoy.
import { rpc, esc, html, redirigir, paginaError } from '../../../lib/util.js';
import { inicioPagina, firma, icono } from '../../../lib/portal.js';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const slug = String(params.slug || '').toLowerCase();
  let n, clases;
  try {
    [n, clases] = await Promise.all([rpc(env, 'negocio_publico', { p_slug: slug }), rpc(env, 'clases_semana', { p_slug: slug })]);
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }
  if (!n) return redirigir(new URL('/inactivo', url).href);

  // Hoy en Bogotá (0 = domingo) y su fecha, para poner el número del día en cada pestaña
  const ahora = new Date();
  const hoy = CORTO.indexOf({ Sun: 'Dom', Mon: 'Lun', Tue: 'Mar', Wed: 'Mié', Thu: 'Jue', Fri: 'Vie', Sat: 'Sáb' }[
    ahora.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Bogota' })]);
  const fechaDe = (k) => new Date(ahora.getTime() + k * 864e5).toLocaleDateString('es-CO', { day: 'numeric', timeZone: 'America/Bogota' });
  const semana = [0, 1, 2, 3, 4, 5, 6].map((k) => ({ k, dia: (hoy + k) % 7 }));
  const porDia = (d) => (clases || []).filter((c) => c.dia === d);

  const pestanas = semana.map(({ k, dia }) =>
    `<button type="button" class="pt-dia-btn" role="tab" aria-selected="${k === 0}" aria-controls="dia-${dia}" data-dia="${dia}">` +
    `<small>${k === 0 ? 'Hoy' : k === 1 ? 'Mañana' : CORTO[dia]}</small><b>${esc(fechaDe(k))}</b>${porDia(dia).length ? `<i>${porDia(dia).length}</i>` : ''}</button>`).join('');
  const paneles = semana.map(({ k, dia }) => {
    const lista = porDia(dia).map((c) =>
      `<div class="pt-prod pt-clase"><span class="pt-clase-hora">${esc(c.hora)}</span><div class="pt-tx"><b>${esc(c.nombre)}</b>${c.descripcion ? `<small>${esc(c.descripcion)}</small>` : ''}` +
      `<span class="pt-precio">${c.duracion ? `${esc(c.duracion)} min` : ''}${c.cupo ? `${c.duracion ? ' · ' : ''}cupo ${esc(c.cupo)}` : ''}</span></div></div>`).join('');
    return `<div class="pt-dia" id="dia-${dia}" role="tabpanel"${k === 0 ? '' : ' hidden'}>
      <h2 class="pt-versalitas">${k === 0 ? 'Hoy, ' : k === 1 ? 'Mañana, ' : ''}${DIAS[dia].toLowerCase()}</h2>
      ${lista || `<div class="pt-vacio"><b>${k === 0 ? 'Hoy no hay clases' : 'Este día no hay clases'}</b>Mira otro día o pregunta en recepción.</div>`}
    </div>`;
  }).join('');

  return html(`${inicioPagina(n, { titulo: `Clases · ${n.nombre}` })}
<main class="pt-pagina">
  <div class="pt-barra"><a class="pt-volver" href="/n/${encodeURIComponent(n.slug)}" aria-label="Volver">${icono('volver')}</a><h1>Clases</h1><span></span></div>
  <div class="pt-dias" role="tablist" aria-label="Días de la semana">${pestanas}</div>
  ${paneles}
  ${firma()}
</main>
<script>
  (function () {
    var btns = Array.prototype.slice.call(document.querySelectorAll('.pt-dia-btn'));
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (o) {
          var si = o === b;
          o.setAttribute('aria-selected', si ? 'true' : 'false');
          document.getElementById(o.getAttribute('aria-controls')).hidden = !si;
        });
      });
    });
  })();
</script>
</body></html>`);
}
