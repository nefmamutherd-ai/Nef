// /n/<slug>/datos → política de tratamiento de datos (Ley 1581) + condiciones del club (Ley 1480).
// Contenido según el Decreto 1377 de 2013, art. 13 (qué debe decir una política). Publicada sin revisión de abogado por
// decisión de Jacobo (ver docs/DECISIONES.md).
import { rpc, esc, html, redirigir, paginaError, waLink } from '../../../lib/util.js';
import { inicioPagina, firma, icono } from '../../../lib/portal.js';
import { ENCARGADO, VIGENCIA } from '../../../lib/legal.js';

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

  // Responsable = el negocio (datos legales que llena el admin); si faltan, su nombre comercial y su WhatsApp
  const L = n.legal || {};
  const responsable = esc(L.nombre || n.nombre);
  const idResp = [L.documento, L.direccion].filter(Boolean).map(esc).join(' · ');
  const canales = [
    L.correo ? `el correo <a href="mailto:${esc(L.correo)}">${esc(L.correo)}</a>` : '',
    contacto ? `<a href="${esc(contacto)}">WhatsApp</a>` : '',
  ].filter(Boolean).join(' o ');
  const correoNef = `<a href="mailto:${esc(ENCARGADO.correo)}">${esc(ENCARGADO.correo)}</a>`;
  const valorCompra = c.modo === 'valor' ? ', el valor de tus compras registradas' : '';

  return html(`${inicioPagina(n, { titulo: `Datos y condiciones · ${n.nombre}`, extraHead: '<meta name="robots" content="noindex">' })}
<main class="pt-pagina pt-texto">
  <a class="pt-volver" href="/n/${encodeURIComponent(n.slug)}/club">${icono('volver')}Volver</a>
  <h1>Tus datos y las condiciones del club</h1>
  <p>Política de tratamiento de datos personales del club de ${nombre}. Vigente desde el ${VIGENCIA}.</p>

  <h2>Quién es responsable de tus datos</h2>
  <p><b>${responsable}</b>${idResp ? ` (${idResp})` : ''} es el <b>responsable</b> del tratamiento: decide para qué se usan tus datos.
  Contacto: ${canales || `en la caja de ${nombre}`}.</p>
  <p><b>${esc(ENCARGADO.nombre)}</b>, ${esc(ENCARGADO.documento)}, con el nombre comercial ${esc(ENCARGADO.comercial)}, es el <b>encargado</b>:
  guarda y procesa los datos por cuenta de ${nombre}, solo para lo que dice esta política y bajo un contrato de transmisión de datos.
  Correo: ${correoNef}.</p>

  <h2>Qué datos guardamos</h2>
  <ul>
    <li>Tu <b>nombre</b> y tu <b>celular</b>, que nos das al inscribirte.</li>
    <li>Tus <b>visitas, ${plural} y canjes</b> registrados en la caja${valorCompra}, y la fecha en que autorizaste.</li>
  </ul>
  <p>No pedimos datos sensibles (salud, religión, política, huellas o fotos). Cuando tocas el chip o escaneas el QR de ${nombre},
  la visita se cuenta sin saber quién eres.</p>

  <h2>Para qué los usamos</h2>
  <ul>
    <li>Identificarte en la caja, llevar tus ${plural} y entregarte los premios.</li>
    <li>Escribirte por <b>WhatsApp</b> sobre el club (premios, ${plural} por vencer, te extrañamos), porque lo autorizaste al inscribirte,
    solo de lunes a viernes de 7 a. m. a 7 p. m. y los sábados de 8 a. m. a 3 p. m. Nunca domingos ni festivos (Ley 2300 de 2023).
    Si no quieres más mensajes, dilo en el mismo chat o por los canales de abajo.</li>
    <li>Hacer estadísticas <b>sin tu nombre ni tu celular</b> para que ${nombre} mejore su servicio.</li>
  </ul>
  <p>No vendemos ni prestamos tus datos. Solo los ven ${nombre} y el encargado.</p>

  <h2>Tus derechos</h2>
  <p>Según la Ley 1581 de 2012 puedes, gratis y cuando quieras: conocer, actualizar y corregir tus datos; pedir prueba de que autorizaste;
  saber cómo se han usado; revocar la autorización y pedir que los borremos (salvo que una ley obligue a guardarlos);
  y quejarte ante la Superintendencia de Industria y Comercio después de hacer tu reclamo aquí.</p>

  <h2>Cómo pedir algo sobre tus datos</h2>
  <p>Escribe a ${canales || `la caja de ${nombre}`} o a ${correoNef} con tu nombre, tu celular y lo que necesitas.
  Respondemos las <b>consultas en máximo 10 días hábiles</b> y los <b>reclamos (corregir, borrar, revocar) en máximo 15 días hábiles</b>.
  Si necesitamos más tiempo te avisamos antes de que se cumpla el plazo, como permite la ley.</p>

  <h2>Dónde y cuánto tiempo se guardan</h2>
  <p>En servidores de proveedores de nube (Supabase y Cloudflare) que pueden estar fuera de Colombia, con acceso restringido y
  conexión cifrada. Los guardamos mientras seas parte del club o hasta que pidas borrarlos.</p>
  <p>Si eres menor de 18 años, tu mamá, tu papá o tu acudiente debe autorizar por ti.</p>
  <p>Si esta política cambia, la publicamos aquí con su nueva fecha. Política general de Nef: <a href="/privacidad">privacidad</a>.</p>

  <h2>Condiciones del club</h2>
  <ul>
    <li>${comoGana}</li>
    <li>Las ${plural} solo se suman en la caja, con la persona presente. Dejar una reseña no da ${plural}.</li>
    ${c.bienvenida > 0 ? `<li>Al inscribirte recibes <b>${esc(c.bienvenida)} ${plural}</b> de bienvenida, que se activan en tu primera visita.</li>` : ''}
    <li>Entre una visita que suma y la siguiente deben pasar al menos ${esc(c.horas_entre_visitas)} horas.</li>
    <li>Tus ${plural} <b>vencen si pasas 12 meses sin visitas</b>. Si autorizaste mensajes, podemos avisarte antes.</li>
    <li>Las ${plural} no se cambian por dinero ni se transfieren a otra persona. Ningún premio se decide al azar.</li>
    <li>${nombre} puede cambiar los premios y estas condiciones publicándolo aquí; las ${plural} que ya tengas se respetan.</li>
  </ul>
  <h2>Premios</h2>
  ${premios}
  ${firma()}
</main>
</body></html>`);
}
