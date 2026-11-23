// Lectura de CSV y fechas para el importador de entradas. Funciones puras (sin DOM): las usan el navegador
// (public/assets/importar.js) y las pruebas (tests/test_sql.mjs).

// Detecta el separador (";" o ",") mirando la primera línea, fuera de comillas
export function separador(texto) {
  const linea = String(texto).split(/\r?\n/, 1)[0] || '';
  let dentro = false, pc = 0, c = 0;
  for (const ch of linea) {
    if (ch === '"') dentro = !dentro;
    else if (!dentro && ch === ';') pc++;
    else if (!dentro && ch === ',') c++;
  }
  return pc >= c && pc > 0 ? ';' : ',';
}

// CSV → { cabecera: [...], filas: [[...], ...] }. Respeta comillas dobles ("" = comilla dentro de un campo).
export function leerCSV(texto) {
  const t = String(texto).replace(/^﻿/, '');
  const sep = separador(t);
  const filas = [];
  let fila = [], campo = '', dentro = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (dentro) {
      if (ch === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else dentro = false; }
      else campo += ch;
    } else if (ch === '"') dentro = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((x) => x.trim() !== '')) filas.push(fila.map((x) => x.trim()));
      fila = [];
    } else campo += ch;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim() !== '')) filas.push(fila.map((x) => x.trim()));
  return { separador: sep, cabecera: filas[0] || [], filas: filas.slice(1) };
}

const dos = (n) => String(n).padStart(2, '0');
const valida = (y, m, d, h, mi) => {
  if (m < 1 || m > 12 || d < 1 || h > 23 || mi > 59) return false;
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
};

// Texto de fecha y hora (hora local de Bogotá) → "AAAA-MM-DD HH:MM", o null si no se entiende. Nunca adivina.
// Acepta: "2026-09-02 18:05", "02/09/2026 18:05", "02/09/2026 6:05 p. m." (también "pm", "a.m.").
export function fechaHora(texto) {
  const s = String(texto || '').trim().toLowerCase().replace(/\s+/g, ' ');
  let y, m, d, resto;
  let k = /^(\d{4})-(\d{2})-(\d{2})[ t](.+)$/.exec(s);
  if (k) { y = +k[1]; m = +k[2]; d = +k[3]; resto = k[4]; }
  else if ((k = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (.+)$/.exec(s))) { d = +k[1]; m = +k[2]; y = +k[3]; resto = k[4]; }
  else return null;
  const h = /^(\d{1,2}):(\d{2})(?::\d{2})?(?: ?([ap])\.? ?m\.?)?$/.exec(resto.trim());
  if (!h) return null;
  let hora = +h[1];
  const min = +h[2];
  if (h[3]) {
    if (hora < 1 || hora > 12) return null;
    if (h[3] === 'a' && hora === 12) hora = 0;
    if (h[3] === 'p' && hora !== 12) hora += 12;
  }
  if (!valida(y, m, d, hora, min)) return null;
  return `${y}-${dos(m)}-${dos(d)} ${dos(hora)}:${dos(min)}`;
}

// Columnas que puede mapear el usuario
export const CAMPOS = [
  { id: 'codigo', texto: 'Código del socio', obligatorio: true, pistas: ['documento', 'cedula', 'cédula', 'codigo', 'código', 'id', 'socio'] },
  { id: 'fecha_hora', texto: 'Fecha y hora', pistas: ['fecha y hora', 'fecha_hora', 'fechahora', 'datetime', 'momento'] },
  { id: 'fecha', texto: 'Fecha (si la hora va aparte)', pistas: ['fecha', 'dia', 'día', 'date'] },
  { id: 'hora', texto: 'Hora (si va aparte)', pistas: ['hora', 'time'] },
  { id: 'nombre', texto: 'Nombre', pistas: ['nombre', 'name', 'socio nombre'] },
  { id: 'telefono', texto: 'Celular', pistas: ['celular', 'telefono', 'teléfono', 'movil', 'móvil', 'whatsapp'] },
  { id: 'plan', texto: 'Plan', pistas: ['plan', 'membresia', 'membresía'] },
];

// Propone un mapeo { campo: índice de columna } a partir de los nombres de la cabecera
export function mapeoSugerido(cabecera) {
  const norm = (x) => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const cab = cabecera.map(norm);
  const m = {};
  for (const c of CAMPOS) {
    const i = cab.findIndex((x, j) => !Object.values(m).includes(j) && c.pistas.some((p) => x === norm(p)));
    if (i >= 0) m[c.id] = i;
  }
  return m;
}

// Filas del CSV + mapeo → filas para importar_entradas ({codigo, fecha_hora, nombre, telefono, plan})
export function mapearFilas(filas, mapeo) {
  const col = (f, k) => (mapeo[k] === undefined || mapeo[k] === null || mapeo[k] === '' ? '' : f[+mapeo[k]] ?? '');
  return filas.map((f) => {
    const texto = mapeo.fecha_hora !== undefined && mapeo.fecha_hora !== '' ? col(f, 'fecha_hora') : `${col(f, 'fecha')} ${col(f, 'hora')}`;
    return {
      codigo: col(f, 'codigo'),
      fecha_hora: fechaHora(texto),
      nombre: col(f, 'nombre') || null,
      telefono: col(f, 'telefono') || null,
      plan: col(f, 'plan') || null,
    };
  });
}
