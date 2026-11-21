// Genera las piezas imprimibles del kit físico (HTML a tamaño real) en esta carpeta.
// Uso: node docs/kit/fuentes/generar_kit.mjs  (luego abrir cada HTML en Chrome → Imprimir → Guardar como PDF, márgenes: ninguno)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const qrcode = require('qrcode-generator');

const OUT = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
fs.mkdirSync(OUT, { recursive: true });

const qr = (url, color = '#1F1B17', fondo = '#FFFFFF') => {
  const q = qrcode(0, 'M'); q.addData(url); q.make();
  const n = q.getModuleCount(); let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="width:100%;height:100%;display:block"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="${fondo}"/><path d="${d}" fill="${color}"/></svg>`;
};
// El "punto": anillo + centro. Significa "acerca tu celular aquí" en todas las piezas.
const punto = (c, grosor = 7) =>
  `<svg viewBox="0 0 100 100" style="width:100%;height:100%;display:block"><circle cx="50" cy="50" r="${46 - grosor / 2}" fill="none" stroke="${c}" stroke-width="${grosor}"/><circle cx="50" cy="50" r="19" fill="${c}"/></svg>`;

const MUESTRA = 'https://tudominio.co/t/muestra?q';
const SERIF = `ui-serif, "New York", Georgia, "Noto Serif", serif`;
const SANS = `system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
const base = (w, h, css, body, sangria = 3) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@page { size: ${w + 2 * sangria}mm ${h + 2 * sangria}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${w + 2 * sangria}mm; height: ${h + 2 * sangria}mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.hoja { position: relative; width: ${w + 2 * sangria}mm; height: ${h + 2 * sangria}mm; overflow: hidden; page-break-after: always; }
.corte { position: absolute; left: ${sangria}mm; top: ${sangria}mm; width: ${w}mm; height: ${h}mm; }
.aviso { position: absolute; left: 0; right: 0; bottom: .6mm; text-align: center; font: 4.5pt ${SANS}; color: rgba(128,128,128,.8); letter-spacing: .05em; }
${css}
</style></head><body>${body}</body></html>`;

const piezas = {};

// 1 · Sticker de mesa (café) · redondo 70 mm
piezas['sticker-mesa-cafe'] = { w: 70, h: 70, html: base(70, 70, `
.hoja { background: #B4532A; }
.corte { border-radius: 50%; color: #fff; font-family: ${SANS}; display: flex; flex-direction: column; align-items: center; padding-top: 8mm; text-align: center; }
.p { width: 12mm; height: 12mm; }
.t1 { font-weight: 700; font-size: 8.5pt; margin-top: 1.6mm; }
.q { width: 25mm; height: 25mm; margin-top: 2.2mm; border-radius: 2mm; overflow: hidden; }
.t2 { font-size: 6.4pt; margin-top: 1.8mm; opacity: .9; }`,
`<div class="hoja"><div class="corte"><div class="p">${punto('#fff')}</div><div class="t1">Acerca tu celular</div><div class="q">${qr(MUESTRA, '#1F1B17')}</div><div class="t2">o escanea · carta y monedas</div></div><div class="aviso">QR DE MUESTRA · cada sticker lleva el suyo · corte redondo 70 mm</div></div>`) };

// 2 · Sticker de máquina (gimnasio) · redondo 70 mm
piezas['sticker-maquina-gym'] = { w: 70, h: 70, html: base(70, 70, `
.hoja { background: #121314; }
.corte { border-radius: 50%; color: #F4F4F2; font-family: ${SANS}; display: flex; flex-direction: column; align-items: center; padding-top: 7.5mm; text-align: center; }
.n { font-size: 6pt; letter-spacing: .14em; color: #C8F03C; font-weight: 800; }
.p { width: 11mm; height: 11mm; margin-top: 1.4mm; }
.t1 { font-weight: 800; font-size: 8.6pt; margin-top: 1.4mm; text-transform: uppercase; letter-spacing: .02em; }
.q { width: 23mm; height: 23mm; margin-top: 1.8mm; border-radius: 2mm; overflow: hidden; }
.t2 { font-size: 6.2pt; margin-top: 1.6mm; color: #B9BBB5; }`,
`<div class="hoja"><div class="corte"><div class="n">MÁQUINA 04</div><div class="p">${punto('#C8F03C')}</div><div class="t1">Mira cómo se usa</div><div class="q">${qr(MUESTRA, '#121314')}</div><div class="t2">Acerca tu celular o escanea</div></div><div class="aviso">QR DE MUESTRA · sobre metal usar chip antimetal · corte redondo 70 mm</div></div>`) };

// 3 · Placa de caja / recepción · 105 × 148 mm (acrílico)
piezas['placa-caja-cafe'] = { w: 105, h: 148, html: base(105, 148, `
.hoja { background: #F5F1EA; }
.corte { font-family: ${SANS}; color: #1F1B17; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 11mm 9mm 8mm; }
.logo { width: 16mm; height: 16mm; border-radius: 50%; background: #B4532A; color: #fff; display: grid; place-items: center; font: 500 20pt ${SERIF}; }
h1 { font: 500 21pt ${SERIF}; margin-top: 3mm; letter-spacing: -.01em; }
.s { font-size: 8.5pt; color: #5C554D; margin-top: 1.2mm; }
.zona { margin-top: 6mm; width: 44mm; height: 44mm; border-radius: 50%; background: #fff; display: grid; place-items: center; box-shadow: 0 0 0 .5mm #E4DCCF; }
.zona .p { width: 22mm; height: 22mm; }
.t1 { font-weight: 700; font-size: 12pt; margin-top: 3.5mm; }
.linea { width: 100%; display: flex; align-items: center; gap: 3mm; margin: 4mm 0 3mm; color: #8F877C; font-size: 7.5pt; }
.linea::before, .linea::after { content: ""; flex: 1; height: .3mm; background: #E4DCCF; }
.q { width: 26mm; height: 26mm; }
.pie { margin-top: auto; font-size: 6.5pt; color: #8F877C; letter-spacing: .04em; }`,
`<div class="hoja"><div class="corte"><div class="logo">CL</div><h1>Café Luna</h1><div class="s">Carta · Mis monedas · Reseña</div>
<div class="zona"><div class="p">${punto('#B4532A')}</div></div><div class="t1">Acerca tu celular aquí</div>
<div class="linea">o escanea</div><div class="q">${qr(MUESTRA)}</div><div class="pie">MAMUT HERD</div></div>
<div class="aviso">QR DE MUESTRA · chip pegado detrás del centro del círculo · acrílico máx. 3 mm</div></div>`) };

// 4 · QR gigante de entrada (gimnasio) · 600 × 900 mm (vinilo o pendón)
piezas['qr-gigante-entrada-gym'] = { w: 600, h: 900, html: base(600, 900, `
.hoja { background: #121314; }
.corte { font-family: ${SANS}; color: #F4F4F2; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 60mm 45mm 55mm; }
.n { font-size: 90pt; letter-spacing: .2em; font-weight: 800; color: #C8F03C; }
h1 { font-size: 210pt; line-height: .92; font-weight: 900; text-transform: uppercase; margin-top: 16mm; letter-spacing: -.01em; }
.s { font-size: 88pt; color: #B9BBB5; margin-top: 16mm; }
.q { width: 330mm; height: 330mm; margin-top: 26mm; border-radius: 16mm; overflow: hidden; flex: none; }
.fila { display: flex; align-items: center; gap: 14mm; margin-top: auto; font-size: 64pt; font-weight: 700; text-align: left; line-height: 1.15; }
.fila .p { width: 80mm; height: 80mm; flex: none; }`,
`<div class="hoja"><div class="corte"><div class="n">GIMNASIO</div><h1>Registra<br>tu entrada</h1><div class="s">Escanea al llegar y suma a tu racha</div>
<div class="q">${qr(MUESTRA, '#121314', '#F4F4F2')}</div><div class="fila"><div class="p">${punto('#C8F03C')}</div><span>¿Tienes NFC?<br>Toca la placa de la recepción</span></div></div>
<div class="aviso" style="font-size:18pt;bottom:2mm">QR DE MUESTRA · se genera uno por gimnasio desde el panel · sangría 3 mm</div></div>`) };

// 5 · Tarjeta NFC de Mamut Herd · 85 × 55 mm, frente y respaldo
const tarjetaCss = `
.hoja { background: #1F1B17; }
.corte { font-family: ${SANS}; color: #F5F1EA; padding: 6mm 6.5mm; display: flex; flex-direction: column; }
.marca { font: 500 17pt ${SERIF}; letter-spacing: -.01em; }
.sub { font-size: 6.5pt; color: #B5AC9F; letter-spacing: .14em; margin-top: 1mm; }
.quien { margin-top: auto; font-size: 9pt; font-weight: 700; }
.quien span { display: block; font-size: 7pt; font-weight: 400; color: #B5AC9F; margin-top: .6mm; }
.dorso { flex-direction: row; align-items: center; gap: 4mm; }
.dorso .p { width: 15mm; height: 15mm; flex: none; }
.dorso .tx { flex: 1; font-size: 8pt; line-height: 1.35; }
.dorso .tx b { display: block; font-size: 10pt; margin-bottom: 1mm; }
.dorso .q { width: 20mm; height: 20mm; flex: none; border-radius: 1.5mm; overflow: hidden; }`;
piezas['tarjeta-mamut-herd'] = { w: 85, h: 55, html: base(85, 55, tarjetaCss,
`<div class="hoja"><div class="corte"><div class="marca">Mamut Herd</div><div class="sub">PRODUCTOS DIGITALES</div>
<div class="quien">Jacobo López<span>Fundador · +57 300 000 0000</span></div></div><div class="aviso">FRENTE · reemplaza tu número antes de imprimir</div></div>
<div class="hoja"><div class="corte dorso"><div class="p">${punto('#D9A23A', 8)}</div><div class="tx"><b>Acerca tu celular</b>Mira todo lo que hacemos, sin apps.</div><div class="q">${qr(MUESTRA)}</div></div>
<div class="aviso">RESPALDO · chip NFC dentro de la tarjeta (tarjeta PVC NFC)</div></div>`) };

// Símbolo suelto en SVG para usar en cualquier lado
fs.writeFileSync(OUT + '/punto.svg', punto('#1F1B17').replace('style="width:100%;height:100%;display:block"', 'xmlns="http://www.w3.org/2000/svg" width="400" height="400"'));
for (const [nombre, p] of Object.entries(piezas)) fs.writeFileSync(`${OUT}/${nombre}.html`, p.html);
fs.writeFileSync(OUT + '/piezas.json', JSON.stringify(Object.fromEntries(Object.entries(piezas).map(([k, v]) => [k, { w: v.w, h: v.h }])), null, 1));
console.log(Object.keys(piezas).join('\n'));
