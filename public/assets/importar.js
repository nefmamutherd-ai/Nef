// Importador de entradas del torniquete/huellero (admin). Lee el CSV en el navegador, el usuario dice qué es
// cada columna y se envía en lotes de 2.000 a la RPC importar_entradas (que no duplica).
// Datos del archivo → siempre textContent.
import { leerCSV, mapeoSugerido, mapearFilas, CAMPOS } from '/assets/csv.js';

const LOTE = 2000;
const fmt = new Intl.NumberFormat('es-CO');

export function montarImportador({ sb, toast, negocioActual, negocios, alTerminar }) {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  let csv = null;
  let archivo = '';

  function aviso(clase, texto) {
    const r = $('#i-resultado');
    r.textContent = '';
    if (texto) r.append(el('div', 'n-aviso ' + clase, texto));
  }

  function reiniciar() {
    csv = null;
    $('#i-paso2').hidden = true;
    $('#i-archivo').value = '';
    aviso('', '');
  }

  function pintarVistaPrevia() {
    const tabla = $('#i-previa');
    tabla.textContent = '';
    const thead = el('thead'), tr = el('tr');
    csv.cabecera.forEach((c) => tr.append(el('th', '', c)));
    thead.append(tr);
    const tbody = el('tbody');
    csv.filas.slice(0, 10).forEach((f) => {
      const r = el('tr');
      csv.cabecera.forEach((_, i) => r.append(el('td', '', f[i] ?? '')));
      tbody.append(r);
    });
    tabla.append(thead, tbody);
    $('#i-resumen').textContent = `${archivo} · ${fmt.format(csv.filas.length)} filas · separador "${csv.separador}". Estas son las primeras 10.`;
  }

  function pintarMapeo() {
    const caja = $('#i-mapeo');
    caja.querySelectorAll('.n-campo, .n-fila, .n-ayuda').forEach((x) => x.remove());
    const neg = negocios().find((n) => n.id === negocioActual());
    const guardado = neg && neg.mapeo_csv;
    // El mapeo guardado se usa solo si sus columnas existen en este archivo
    const usar = guardado && Object.values(guardado).every((i) => i === '' || +i < csv.cabecera.length) ? guardado : mapeoSugerido(csv.cabecera);
    const fila = el('div', 'n-fila');
    for (const c of CAMPOS) {
      const campo = el('div', 'n-campo');
      const lab = el('label', '', c.texto + (c.obligatorio ? ' *' : ''));
      lab.htmlFor = 'map-' + c.id;
      const sel = el('select');
      sel.id = 'map-' + c.id;
      sel.dataset.campo = c.id;
      sel.append(new Option('— No está —', ''));
      csv.cabecera.forEach((h, i) => sel.append(new Option(h || `Columna ${i + 1}`, String(i))));
      sel.value = usar[c.id] !== undefined ? String(usar[c.id]) : '';
      campo.append(lab, sel);
      fila.append(campo);
    }
    caja.append(fila, el('div', 'n-ayuda', 'Usa "Fecha y hora" si vienen juntas, o "Fecha" + "Hora" si vienen aparte. Formatos: 2026-09-02 18:05 · 02/09/2026 18:05 · 02/09/2026 6:05 p. m.'));
  }

  function mapeoElegido() {
    const m = {};
    document.querySelectorAll('#i-mapeo select[data-campo]').forEach((s) => { if (s.value !== '') m[s.dataset.campo] = +s.value; });
    return m;
  }

  async function leer(file) {
    if (!file) return;
    if (!negocioActual()) { aviso('alerta', 'Primero elige el negocio.'); return; }
    if (file.size > 10 * 1024 * 1024) { aviso('alerta', 'El archivo pesa más de 10 MB. Expórtalo por meses.'); return; }
    archivo = file.name;
    csv = leerCSV(await file.text());
    if (!csv.filas.length) { aviso('alerta', 'El archivo no tiene filas.'); return; }
    aviso('', '');
    pintarVistaPrevia();
    pintarMapeo();
    $('#i-paso2').hidden = false;
  }

  $('#i-archivo').addEventListener('change', (e) => leer(e.target.files[0]));
  const zona = $('#i-subir');
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('encima'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('encima'));
  zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('encima'); leer(e.dataTransfer.files[0]); });

  $('#i-importar').addEventListener('click', async () => {
    const mapeo = mapeoElegido();
    if (mapeo.codigo === undefined) { aviso('alerta', 'El archivo no tiene columna de socio. Elige cuál es.'); return; }
    if (mapeo.fecha_hora === undefined && (mapeo.fecha === undefined || mapeo.hora === undefined)) {
      aviso('alerta', 'Elige la columna de fecha y hora (o la de fecha y la de hora).'); return;
    }
    const filas = mapearFilas(csv.filas, mapeo);
    const tot = { filas: 0, nuevas: 0, repetidas: 0, invalidas: 0 };
    const boton = $('#i-importar');
    boton.disabled = true;
    try {
      for (let i = 0; i < filas.length; i += LOTE) {
        aviso('', `Importando ${fmt.format(Math.min(i + LOTE, filas.length))} de ${fmt.format(filas.length)}…`);
        const { data, error } = await sb.rpc('importar_entradas', {
          p_negocio: negocioActual(), p_filas: filas.slice(i, i + LOTE), p_mapeo: mapeo, p_archivo: archivo,
        });
        if (error) throw error;
        for (const k in tot) tot[k] += data[k];
      }
      const validas = filas.filter((f) => f.codigo && f.fecha_hora);
      const socios = new Set(validas.map((f) => f.codigo)).size;
      // Recalcular las estadísticas guardadas desde el día más antiguo del archivo
      if (tot.nuevas > 0 && validas.length) {
        aviso('', 'Actualizando las estadísticas…');
        const desde = validas.reduce((m, f) => (f.fecha_hora < m ? f.fecha_hora : m), validas[0].fecha_hora).slice(0, 10);
        await sb.rpc('admin_recalcular', { p_negocio: negocioActual(), p_desde: desde });
      }
      aviso('ok', `Importamos ${fmt.format(tot.nuevas)} entradas nuevas de ${fmt.format(socios)} socios. ${fmt.format(tot.repetidas)} repetidas.`);
      if (tot.invalidas) {
        $('#i-resultado').append(el('div', 'n-aviso aviso', `Hay ${fmt.format(tot.invalidas)} filas sin código o con una fecha que no entendimos. Las saltamos.`));
      }
      $('#i-resultado').firstChild.dataset.nuevas = String(tot.nuevas);
      $('#i-paso2').hidden = true;
      $('#i-archivo').value = ''; // permite volver a subir el mismo archivo
      toast('Entradas importadas');
      if (alTerminar) alTerminar();
    } catch (e) {
      aviso('alerta', 'No se pudo importar: ' + (e.message || e));
    } finally {
      boton.disabled = false;
    }
  });

  return { reiniciar };
}
