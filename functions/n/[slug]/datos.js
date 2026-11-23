// /n/<slug>/datos → política de tratamiento de datos (Ley 1581) + condiciones del club (Ley 1480).
// PLANTILLA: revisar con un abogado antes de usarla con clientes reales.
import { rpc, esc, html, redirigir, paginaError, waLink } from '../../../lib/util.js';
import { inicioPagina, firma, icono } from '../../../lib/portal.js';

const pesos = (n) => '$' + new Intl.NumberFormat('es-CO').format(n || 0);

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
  if (!n || !c) return redirigir(new URL('/inactivo', url).href);

  const nombre = esc(n.nombre);
  const plural = esc(c.moneda_plural);
  const contacto = waLink(n.whatsapp);
  const comoGana = c.modo === 'valor'
    ? `Por cada compra registrada en la caja recibes el <b>${esc(c.devolucion_pct)} %</b> de su valor en ${plural} (cada ${esc(c.moneda_singular)} vale ${pesos(c.valor_moneda)} en premios). Ejemplo: una compra de ${pesos(100000)} te da ${esc(Math.floor((100000 * c.devolucion_pct) / 100 / c.valor_moneda))} ${plural}.`
    : `Cada visita registrada en la caja te da <b>${esc(c.monedas_por_visita)} ${plural}</b>.`;
  const premios = (c.premios || []).length
    ? `<ul>${c.premios.map((p) => `<li><b>${esc(p.nombre)}</b>: ${esc(p.costo)} ${plural} (valor ${pesos(p.valor_pesos)})</li>`).join('')}</ul>`
    : '<p>Por ahora no hay premios publicados.</p>';

  return html(`${inicioPagina(n, { titulo: `Datos y condiciones · ${n.nombre}`, extraHead: '<meta name="robots" content="noindex">' })}
<main class="pt-pagina pt-texto">
  <a class="pt-volver" href="/n/${encodeURIComponent(n.slug)}/club">${icono('volver')}Volver</a>
  <p><span class="pt-aviso neutro">Plantilla — revisar con abogado</span></p>
  <h1>Tus datos y las condiciones del club</h1>

  <h2>Quién es responsable de tus datos</h2>
  <p><b>${nombre}</b> es el responsable del tratamiento de tus datos personales. <b>Mamut Herd</b> (Nef) es el encargado:
  guarda y procesa los datos por cuenta de ${nombre}, bajo un contrato de transmisión de datos.</p>

  <h2>Qué datos guardamos y para qué</h2>
  <ul>
    <li>Tu <b>nombre</b> y tu <b>celular</b>: para identificarte en la caja y llevar tus ${plural}.</li>
    <li>Tus <b>visitas y canjes</b>: para calcular tu saldo y mejorar el servicio con estadísticas sin tu nombre.</li>
  </ul>
  <p>Solo te escribiremos por el canal que autorices, de lunes a viernes de 7 a. m. a 7 p. m. y los sábados de 8 a. m. a 3 p. m.
  Nunca domingos ni festivos (Ley 2300 de 2023). No vendemos ni compartimos tus datos con terceros.</p>

  <h2>Tus derechos</h2>
  <p>Puedes conocer, actualizar, corregir y pedir que borremos tus datos, y revocar esta autorización cuando quieras
  (Ley 1581 de 2012). ${contacto ? `Escríbele a ${nombre} por <a href="${esc(contacto)}">WhatsApp</a> o pídelo en la caja.` : `Pídelo en la caja de ${nombre}.`}
  Responderemos en máximo 15 días hábiles. También puedes acudir a la Superintendencia de Industria y Comercio.</p>

  <h2>Condiciones del club</h2>
  <ul>
    <li>${comoGana}</li>
    <li>Las ${plural} solo se suman en la caja, con la persona presente. Dejar una reseña no da ${plural}.</li>
    ${c.bienvenida > 0 ? `<li>Al inscribirte recibes <b>${esc(c.bienvenida)} ${plural}</b> de bienvenida, que se activan en tu primera visita.</li>` : ''}
    <li>Entre una visita que suma y la siguiente deben pasar al menos ${esc(c.horas_entre_visitas)} horas.</li>
    <li>Tus ${plural} <b>vencen si pasas 12 meses sin visitas</b>. Te avisaremos un mes antes si autorizaste mensajes.</li>
    <li>Las ${plural} no se cambian por dinero ni se transfieren a otra persona.</li>
  </ul>
  <h2>Premios</h2>
  ${premios}
  ${firma()}
</main>
</body></html>`);
}
