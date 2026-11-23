// Exportación para el estudio (solo admin): 4 CSV limpios + LEEME.txt (diccionario de datos).
// Los ids vienen anonimizados desde la RPC exportar_estudio (md5 con sal aleatoria). Sin nombres ni teléfonos.

const COLUMNAS = {
  visitas: [
    ['cliente', 'texto', 'Id anónimo de la persona (cambia en cada exportación)'],
    ['fecha', 'fecha AAAA-MM-DD', 'Día de la visita, hora de Bogotá'],
    ['hora', 'entero 0–23', 'Hora de la visita, hora de Bogotá'],
    ['dia_semana', 'entero 0–6', '0 = domingo … 6 = sábado'],
    ['origen', 'texto', '"caja" (visita sumada en la caja) o "entrada" (registro del torniquete o NFC)'],
  ],
  clientes: [
    ['cliente', 'texto', 'Id anónimo (el mismo que en visitas.csv y canjes.csv de esta exportación)'],
    ['inscrito', 'fecha', 'Día en que se unió al club'],
    ['visitas', 'entero', 'Visitas sumadas en la caja desde que se inscribió'],
    ['saldo', 'entero', 'Monedas disponibles hoy'],
    ['total_ganado', 'entero', 'Monedas ganadas en total (canjear no lo baja)'],
    ['ultima_visita', 'fecha', 'Última visita registrada (vacío si nunca vino)'],
  ],
  canjes: [
    ['cliente', 'texto', 'Id anónimo'],
    ['fecha', 'fecha', 'Día del canje'],
    ['monedas', 'entero', 'Monedas que costó el premio'],
    ['valor_pesos', 'entero', 'Valor del premio en pesos (monedas × 100)'],
    ['premio', 'texto', 'Nombre del premio'],
  ],
  entradas: [
    ['socio', 'texto', 'Id anónimo del socio del gimnasio'],
    ['fecha', 'fecha', 'Día de la entrada, hora de Bogotá'],
    ['hora', 'entero 0–23', 'Hora de la entrada'],
    ['origen', 'texto', '"importado" (torniquete/huellero) o "nfc"'],
    ['plan', 'texto', 'Plan del socio según su sistema (si lo traía el archivo)'],
  ],
};

const celda = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (filas, cols) => [cols.map((c) => c[0]).join(','), ...filas.map((f) => cols.map((c) => celda(f[c[0]])).join(','))].join('\n') + '\n';

function descargar(nombre, texto, tipo) {
  const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportarEstudio(data, slug) {
  const n = data.negocio || {};
  const pref = `${slug}_${n.desde}_${n.hasta}`;
  const archivos = [];
  for (const nombre of ['visitas', 'clientes', 'canjes', 'entradas']) {
    const f = `${pref}_${nombre}.csv`;
    descargar(f, csv(data[nombre] || [], COLUMNAS[nombre]), 'text/csv;charset=utf-8');
    archivos.push(f);
  }
  const leeme = [
    `NEF · Datos para el estudio · ${slug}`,
    `Sector: ${n.sector} · Periodo: ${n.desde} a ${n.hasta} (clientes.csv incluye a todos los inscritos)`,
    `Exportado: ${new Date().toISOString()}`,
    '',
    'Privacidad: no hay nombres ni teléfonos. Los ids son anónimos y cambian en cada exportación;',
    'dentro de UNA exportación el mismo id es la misma persona en todos los archivos.',
    'Si el negocio importa entradas (gimnasio), visitas.csv usa las entradas; si no, las visitas de caja.',
    '',
    'Advertencia para el informe: reporta siempre el tamaño de muestra y el periodo. Sin datos suficientes no hay inferencia.',
    '',
    ...Object.entries(COLUMNAS).flatMap(([archivo, cols]) => [
      `${archivo}.csv (${(data[archivo] || []).length} filas)`,
      ...cols.map(([c, t, d]) => `  ${c.padEnd(14)} ${t.padEnd(18)} ${d}`),
      '',
    ]),
  ].join('\n');
  descargar(`${pref}_LEEME.txt`, leeme, 'text/plain;charset=utf-8');
  archivos.push(`${pref}_LEEME.txt`);
  return archivos;
}
