// /n/<slug>/clases → clases de hoy (hora Bogotá), en orden de hora.
import { rpc, esc, html, redirigir, paginaError } from '../../../lib/util.js';
import { inicioPagina, firma, icono } from '../../../lib/portal.js';

export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url);
  const slug = String(params.slug || '').toLowerCase();
  let n, clases;
  try {
    [n, clases] = await Promise.all([rpc(env, 'negocio_publico', { p_slug: slug }), rpc(env, 'clases_hoy', { p_slug: slug })]);
  } catch (e) {
    console.error(e);
    return paginaError(env);
  }
  if (!n) return redirigir(new URL('/inactivo', url).href);
  const lista = (clases || []).map((c) =>
    `<div class="pt-prod"><div class="pt-tx"><b>${esc(c.nombre)}</b>${c.descripcion ? `<small>${esc(c.descripcion)}</small>` : ''}` +
    `<span class="pt-precio">${esc(c.hora)}${c.duracion ? ` · ${esc(c.duracion)} min` : ''}${c.cupo ? ` · cupo ${esc(c.cupo)}` : ''}</span></div></div>`
  ).join('');

  return html(`${inicioPagina(n, { titulo: `Clases de hoy · ${n.nombre}` })}
<main class="pt-pagina">
  <div class="pt-barra"><a class="pt-volver" href="/n/${encodeURIComponent(n.slug)}" aria-label="Volver">${icono('volver')}</a><h1>Clases de hoy</h1><span></span></div>
  ${lista || '<div class="pt-vacio"><b>Hoy no hay clases</b>Mira mañana o pregunta en recepción.</div>'}
  ${firma()}
</main>
</body></html>`);
}
