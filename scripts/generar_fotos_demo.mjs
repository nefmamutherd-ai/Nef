// Genera public/assets/demo/*.svg: "fotos" ilustradas (vista cenital, tipo render) de los platos de demostración.
// Sin dependencias. Uso: node scripts/generar_fotos_demo.mjs
// Son ilustraciones para la demo; cada negocio sube sus fotos reales desde el admin.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../public/assets/demo/', import.meta.url));
fs.mkdirSync(DIR, { recursive: true });

let semilla = 7;
const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
const r = (a, b) => a + azar() * (b - a);

// ---------- Piezas comunes ----------
const defs = (madera = '#b98a5c') => `
<defs>
  <filter id="grano" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/>
    <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .16 0"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>
  <filter id="vetas" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".012 .22" numOctaves="3" seed="9"/>
    <feColorMatrix values="0 0 0 0 .25  0 0 0 0 .15  0 0 0 0 .07  0 0 0 .5 0"/>
  </filter>
  <filter id="sombra" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="14"/><feOffset dx="10" dy="16"/>
    <feComponentTransfer><feFuncA type="linear" slope=".38"/></feComponentTransfer>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="sombraChica" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="4"/><feOffset dx="3" dy="5"/>
    <feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <radialGradient id="plato" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#fffdf8"/><stop offset=".78" stop-color="#f1ebe0"/><stop offset="1" stop-color="#ddd3c4"/></radialGradient>
  <radialGradient id="platoAzul" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#eef2f2"/><stop offset=".8" stop-color="#cfdad8"/><stop offset="1" stop-color="#9fb2b0"/></radialGradient>
  <radialGradient id="platoTierra" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#e9d6c0"/><stop offset=".8" stop-color="#c99a72"/><stop offset="1" stop-color="#9c6b46"/></radialGradient>
  <radialGradient id="yema" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="#ffd35c"/><stop offset=".7" stop-color="#f6a51a"/><stop offset="1" stop-color="#d9800b"/></radialGradient>
  <radialGradient id="cafe" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#6b3a1c"/><stop offset=".85" stop-color="#3d1f0d"/><stop offset="1" stop-color="#2a1408"/></radialGradient>
  <radialGradient id="espuma" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#f6e7cf"/><stop offset=".7" stop-color="#dcb98c"/><stop offset="1" stop-color="#a8713f"/></radialGradient>
  <radialGradient id="choco" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#7a4a2e"/><stop offset="1" stop-color="#43220f"/></radialGradient>
  <radialGradient id="dorado" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#f7cf7d"/><stop offset=".6" stop-color="#d99a3e"/><stop offset="1" stop-color="#a8641e"/></radialGradient>
  <radialGradient id="crema" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#efdcb8"/></radialGradient>
  <radialGradient id="aguacate" cx="40%" cy="40%" r="70%"><stop offset="0" stop-color="#e9efa0"/><stop offset=".55" stop-color="#a9c45a"/><stop offset="1" stop-color="#4f7a2a"/></radialGradient>
  <radialGradient id="salsa" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#e0462c"/><stop offset="1" stop-color="#9c2414"/></radialGradient>
</defs>
<rect width="600" height="600" fill="${madera}"/>
<rect width="600" height="600" filter="url(#vetas)"/>`;

const fin = `<rect width="600" height="600" filter="url(#grano)" fill="#000" opacity=".55"/></svg>`;
const svg = (cuerpo, madera) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">${defs(madera)}${cuerpo}${fin}`;

const plato = (cx = 300, cy = 300, rad = 235, relleno = 'plato') => `
<g filter="url(#sombra)"><circle cx="${cx}" cy="${cy}" r="${rad}" fill="url(#${relleno})"/></g>
<circle cx="${cx}" cy="${cy}" r="${rad * 0.74}" fill="none" stroke="#000" stroke-opacity=".06" stroke-width="3"/>
<circle cx="${cx}" cy="${cy}" r="${rad * 0.72}" fill="#fff" fill-opacity=".12"/>`;

const huevo = (cx, cy, s = 1, rot = 0) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    const rr = (70 + r(-14, 14)) * s;
    return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr * 0.86).toFixed(1)}`;
  });
  return `<g transform="rotate(${rot} ${cx} ${cy})" filter="url(#sombraChica)">
    <polygon points="${pts.join(' ')}" fill="#fffdf6" stroke="#f0e6d2" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${cx + 6 * s}" cy="${cy - 4 * s}" r="${30 * s}" fill="url(#yema)"/>
    <ellipse cx="${cx - 3 * s}" cy="${cy - 14 * s}" rx="${9 * s}" ry="${5 * s}" fill="#fff" opacity=".55"/></g>`;
};
const granos = (cx, cy, rad, n, color, tam = [7, 11]) =>
  Array.from({ length: n }, () => {
    const a = r(0, Math.PI * 2), d = Math.sqrt(azar()) * rad;
    const w = r(tam[0], tam[1]);
    return `<ellipse cx="${(cx + Math.cos(a) * d).toFixed(1)}" cy="${(cy + Math.sin(a) * d).toFixed(1)}" rx="${w.toFixed(1)}" ry="${(w * 0.62).toFixed(1)}" transform="rotate(${r(0, 180).toFixed(0)} ${(cx + Math.cos(a) * d).toFixed(1)} ${(cy + Math.sin(a) * d).toFixed(1)})" fill="${color}"/>`;
  }).join('');
const hojitas = (cx, cy, rad, n, color = '#4f8a3a') =>
  Array.from({ length: n }, () => {
    const x = cx + r(-rad, rad), y = cy + r(-rad, rad);
    return `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q6 -12 14 -2 q-6 10 -14 2z" fill="${color}" transform="rotate(${r(0, 360).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
  }).join('');
const taza = (cx, cy, rad, liquido, extra = '') => `
<g filter="url(#sombra)"><circle cx="${cx}" cy="${cy}" r="${rad * 1.45}" fill="url(#plato)"/></g>
<g filter="url(#sombraChica)"><circle cx="${cx}" cy="${cy}" r="${rad + 16}" fill="#fbf7ef" stroke="#e4dacb" stroke-width="3"/>
<path d="M${cx + rad + 10} ${cy - 18} q46 4 46 26 q0 22 -46 26" fill="none" stroke="#f3ede2" stroke-width="18" stroke-linecap="round"/></g>
<circle cx="${cx}" cy="${cy}" r="${rad}" fill="url(#${liquido})"/>${extra}`;

// ---------- Platos ----------
const platos = {
  'calentado': () => svg(`${plato()}
    <g filter="url(#sombraChica)"><ellipse cx="225" cy="245" rx="95" ry="80" fill="#f8f3e6"/>${granos(225, 245, 80, 160, '#fffdf5', [4, 6])}</g>
    <g filter="url(#sombraChica)"><ellipse cx="350" cy="365" rx="90" ry="72" fill="#6a3420"/>${granos(350, 365, 70, 90, '#8a4a2c', [6, 9])}${granos(350, 365, 60, 30, '#a8613b', [3, 5])}</g>
    ${huevo(370, 225, 1, 12)}
    <g filter="url(#sombraChica)"><circle cx="215" cy="390" r="68" fill="url(#dorado)"/>
    <path d="M165 370 l100 40 M160 395 l100 40 M175 345 l90 36" stroke="#8a4f16" stroke-opacity=".45" stroke-width="7" stroke-linecap="round"/></g>
    ${hojitas(300, 300, 150, 9)}`),
  'tostada-aguacate': () => svg(`${plato(300, 300, 235, 'platoAzul')}
    <g filter="url(#sombraChica)" transform="rotate(-12 300 300)"><rect x="160" y="190" width="280" height="220" rx="46" fill="#b9773b"/>
    <rect x="174" y="204" width="252" height="192" rx="38" fill="#e8c48c"/>${granos(300, 300, 110, 60, '#d4a865', [3, 5])}</g>
    ${[0, 1, 2, 3, 4].map((i) => `<g filter="url(#sombraChica)"><path d="M${200 + i * 40} 230 q30 70 0 140 q-28 -70 0 -140z" fill="url(#aguacate)" stroke="#3f6a20" stroke-width="3"/></g>`).join('')}
    ${huevo(320, 300, 0.75, -20)}
    ${granos(300, 300, 120, 40, '#c43a1c', [2, 3])}${hojitas(300, 300, 120, 6, '#5d8f3a')}`),
  'huevos-rancheros': () => svg(`${plato(300, 300, 235, 'platoTierra')}
    <g filter="url(#sombraChica)"><circle cx="300" cy="300" r="165" fill="url(#salsa)"/>${granos(300, 300, 150, 70, '#c9361f', [6, 11])}</g>
    ${huevo(245, 270, 0.95, 20)}${huevo(360, 345, 0.95, -30)}
    ${granos(300, 300, 140, 40, '#fff6dc', [5, 8])}${hojitas(300, 300, 130, 14, '#3f7d2e')}`),
  'changua': () => svg(`<g filter="url(#sombra)"><circle cx="300" cy="300" r="230" fill="url(#platoTierra)"/></g>
    <circle cx="300" cy="300" r="190" fill="#f4ecd8"/><circle cx="300" cy="300" r="190" fill="none" stroke="#c9a27a" stroke-width="6" opacity=".6"/>
    ${huevo(290, 300, 0.85, 40)}
    ${Array.from({ length: 18 }, () => { const x = r(160, 440), y = r(160, 440); return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="9" fill="none" stroke="#5f9a3e" stroke-width="5"/>`; }).join('')}
    ${Array.from({ length: 8 }, () => { const x = r(170, 420), y = r(170, 420); return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="30" height="26" rx="6" fill="#e2b874" transform="rotate(${r(0, 90).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})" filter="url(#sombraChica)"/>`; }).join('')}`),
  'capuchino': () => svg(taza(285, 300, 120, 'espuma',
    `<path d="M285 255 c-30 -40 -90 -10 -60 40 c15 28 60 55 60 70 c0 -15 45 -42 60 -70 c30 -50 -30 -80 -60 -40z" fill="#fbf1de" opacity=".95"/>
     <circle cx="285" cy="300" r="120" fill="none" stroke="#7a4a22" stroke-width="10" opacity=".35"/>`) +
    granos(470, 470, 50, 9, '#4a2511', [11, 15]), '#a8784e'),
  'tinto': () => svg(taza(270, 290, 95, 'cafe', `<ellipse cx="245" cy="262" rx="30" ry="12" fill="#fff" opacity=".12"/>`) +
    `<g filter="url(#sombraChica)"><rect x="420" y="380" width="130" height="22" rx="11" fill="#9a5a2e" transform="rotate(-30 485 391)"/><rect x="430" y="400" width="120" height="18" rx="9" fill="#b06a38" transform="rotate(-24 490 409)"/></g>
     <g filter="url(#sombraChica)"><path d="M90 430 l70 -20 l30 60 l-80 25z" fill="#8f4a17"/></g>`, '#c09168'),
  'cafe-filtrado': () => svg(`<g filter="url(#sombra)"><circle cx="300" cy="290" r="150" fill="#e9eef0" opacity=".7"/></g>
    <circle cx="300" cy="290" r="135" fill="url(#cafe)" opacity=".92"/><circle cx="300" cy="290" r="150" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="10"/>
    <ellipse cx="255" cy="240" rx="45" ry="16" fill="#fff" opacity=".18"/>` + granos(470, 140, 60, 12, '#3d1f0d', [12, 16]) + granos(130, 480, 60, 10, '#4a2511', [12, 16]), '#b48a62'),
  'chocolate': () => svg(taza(260, 280, 105, 'choco', `<ellipse cx="235" cy="250" rx="34" ry="12" fill="#fff" opacity=".1"/>`) +
    `<g filter="url(#sombraChica)">${[0, 1, 2].map((i) => `<rect x="${400 + i * 46}" y="${380 - i * 30}" width="54" height="54" rx="8" fill="#fbf6e6" stroke="#eadfc4" stroke-width="3"/>`).join('')}</g>
     <g filter="url(#sombraChica)"><circle cx="460" cy="180" r="62" fill="url(#dorado)"/><circle cx="460" cy="180" r="62" fill="none" stroke="#a8641e" stroke-width="4" opacity=".5"/></g>`, '#a97a50'),
  'torta-chocolate': () => svg(`${plato()}
    <g filter="url(#sombra)"><path d="M190 410 L300 170 L420 400 Q300 440 190 410z" fill="#3b1d0e"/>
    <path d="M300 170 L420 400 Q300 440 190 410z" fill="#4a2512" opacity=".6"/>
    <path d="M215 360 q40 -20 80 0 q40 20 90 -10" fill="none" stroke="#d9963f" stroke-width="10" stroke-linecap="round"/>
    <path d="M240 300 q35 -16 70 0 q35 16 70 -6" fill="none" stroke="#e8a94a" stroke-width="8" stroke-linecap="round"/></g>
    ${granos(330, 470, 40, 14, '#d9963f', [4, 7])}${hojitas(420, 200, 20, 3, '#3f7d2e')}`),
  'croissant': () => svg(`${plato(300, 300, 235, 'platoAzul')}
    <g filter="url(#sombra)">${[-2, -1, 0, 1, 2].map((k) => {
      // Media luna: 5 segmentos inflados a lo largo de un arco, más grandes en el centro
      const a = ((k * 27 - 90) * Math.PI) / 180, x = 300 + Math.cos(a) * 125, y = 380 + Math.sin(a) * 125;
      const largo = 78 - Math.abs(k) * 16, ancho = 52 - Math.abs(k) * 8;
      return `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${ancho}" ry="${largo}" transform="rotate(${k * 27} ${x.toFixed(0)} ${y.toFixed(0)})" fill="url(#dorado)" stroke="#9a5418" stroke-opacity=".4" stroke-width="4"/>`;
    }).join('')}</g>
    ${granos(300, 262, 100, 16, '#f5e2b8', [4, 7])}${granos(300, 262, 90, 8, '#fbefd6', [7, 10])}`),
  'galleta-avena': () => svg(`${plato()}
    ${[[230, 250], [370, 280], [290, 390]].map(([x, y]) => `<g filter="url(#sombraChica)"><circle cx="${x}" cy="${y}" r="88" fill="#c99057"/>${granos(x, y, 78, 40, '#e2b27a', [4, 7])}${granos(x, y, 70, 12, '#3a1d0c', [6, 9])}</g>`).join('')}`),
  'natas': () => svg(`<g filter="url(#sombra)"><circle cx="300" cy="300" r="225" fill="url(#platoTierra)"/></g>
    <circle cx="300" cy="300" r="185" fill="url(#crema)"/>
    <path d="M150 300 q75 -60 150 0 q75 60 150 0" fill="none" stroke="#e6c58a" stroke-width="12" opacity=".6"/>
    ${granos(300, 300, 150, 26, '#5a2a14', [6, 9])}${granos(300, 300, 160, 30, '#f3d9a2', [3, 5])}`),
};

for (const [nombre, fn] of Object.entries(platos)) {
  semilla = nombre.length * 97 + 13;
  fs.writeFileSync(DIR + nombre + '.svg', fn());
}
console.log('Listo:', Object.keys(platos).length, 'ilustraciones en public/assets/demo/');
