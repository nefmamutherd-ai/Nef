// Genera tests/fixtures/entradas.csv: 200 socios × 3 meses (sep–nov 2026) con patrones CONOCIDOS.
// Determinista: generador LCG con semilla 42 (sin Math.random). Correrlo dos veces da el mismo archivo.
// Uso: node tests/fixtures/generar_entradas.mjs
//
// Formato (como lo exporta un huellero típico): separador ";", fecha DD/MM/AAAA y hora HH:MM en columnas aparte,
// hora local de Bogotá. Columnas: Documento;Nombre;Celular;Plan;Fecha;Hora
//
// Grupos (horarios: lunes 6:xx, miércoles 18:xx, viernes 7:xx; los minutos los pone el LCG):
//   R · 120 regulares (doc 1001–1120): lunes, miércoles y viernes del 1 sep al 30 nov → 39 entradas c/u = 4.680
//   A ·  40 abandonan en octubre (doc 2001–2040): l/m/v solo en septiembre (última: mié 30 sep) → 13 c/u = 520
//   V ·  20 vuelven en noviembre (doc 3001–3020): l/m/v en septiembre y en noviembre, nada en octubre → 26 c/u = 520
//   E ·  20 esporádicos (doc 4001–4020): jueves 10 sep, 15 oct y 26 nov a las 12:xx → 3 c/u = 60
//   Total: 200 socios, 5.780 entradas.
//
// RESULTADOS ESPERADOS (gimnasio, umbral en riesgo 10 días):
//   Al 30 nov 2026:
//     activos (≥ 1 entrada del 17 al 30 nov)          = 160  (R 120 + V 20 + E 20)
//     en riesgo (≥ 4 entradas y ≥ 10 días sin venir)  = 40   (A, 61 días sin venir; E tiene solo 3 entradas)
//     abandono de noviembre: activos al 1 nov (entradas 18–31 oct) = 120 (solo R); abandonaron 0 → tasa 0
//     racha (semanas seguidas, lunes a domingo): R = 14, V = 5, E = 1 (semana del 23 nov), A = 0
//     horas pico (90 días hasta el 30 nov): lunes 6 h = 1.900 · miércoles 18 h = 1.940 · viernes 7 h = 1.880 ·
//       jueves 12 h = 60 · resto 0 · total 5.780 · la hora pico es el miércoles a las 18 h
//   Al 31 oct 2026:
//     abandono de octubre: activos al 1 oct (entradas 17–30 sep) = 180 (R + A + V); abandonaron 60 (A + V) → tasa 0,3333
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

let semilla = 42;
const lcg = () => Math.floor((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 65536); // bits altos

const NOMBRES = ['Laura', 'Andrés', 'Camila', 'Juan', 'Valentina', 'Santiago', 'Daniela', 'Mateo', 'Sofía', 'Sebastián'];
const APELLIDOS = ['Gómez', 'Rodríguez', 'Martínez', 'López', 'García', 'Pérez', 'Ramírez', 'Torres', 'Díaz', 'Rojas'];
const PLANES = ['Mensual', 'Trimestral', 'Anual'];

const dias = [];
for (let d = new Date(Date.UTC(2026, 8, 1)); d <= new Date(Date.UTC(2026, 10, 30)); d = new Date(d.getTime() + 86400000)) dias.push(d);
const iso = (d) => d.toISOString().slice(0, 10);
const HORA = { 1: 6, 3: 18, 5: 7, 4: 12 }; // día de la semana (0 = domingo) → hora

const socios = [];
const grupo = (n, desde, prefijo, fechas) => {
  for (let i = 0; i < n; i++) socios.push({ doc: String(desde + i), grupo: prefijo, fechas });
};
const lmv = (d) => [1, 3, 5].includes(d.getUTCDay());
const sep = (d) => d.getUTCMonth() === 8;
const nov = (d) => d.getUTCMonth() === 10;
grupo(120, 1001, 'R', dias.filter(lmv));
grupo(40, 2001, 'A', dias.filter((d) => lmv(d) && sep(d)));
grupo(20, 3001, 'V', dias.filter((d) => lmv(d) && (sep(d) || nov(d))));
grupo(20, 4001, 'E', ['2026-09-10', '2026-10-15', '2026-11-26'].map((s) => new Date(s + 'T00:00:00Z')));

const filas = [];
socios.forEach((s, i) => {
  const nombre = `${NOMBRES[lcg() % 10]} ${APELLIDOS[lcg() % 10]}`;
  const celular = '300' + String(1000000 + i).padStart(7, '0');
  const plan = PLANES[lcg() % 3];
  for (const d of s.fechas) {
    const [y, m, dd] = iso(d).split('-');
    const hh = String(HORA[d.getUTCDay()]).padStart(2, '0');
    const mm = String(lcg() % 60).padStart(2, '0');
    filas.push({ orden: `${iso(d)} ${hh}:${mm} ${s.doc}`, linea: `${s.doc};${nombre};${celular};${plan};${dd}/${m}/${y};${hh}:${mm}` });
  }
});
filas.sort((a, b) => (a.orden < b.orden ? -1 : a.orden > b.orden ? 1 : 0));

const salida = fileURLToPath(new URL('./entradas.csv', import.meta.url));
fs.writeFileSync(salida, ['Documento;Nombre;Celular;Plan;Fecha;Hora', ...filas.map((f) => f.linea)].join('\n') + '\n');
console.log(`entradas.csv: ${socios.length} socios, ${filas.length} entradas`);
