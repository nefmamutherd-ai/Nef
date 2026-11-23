// Piezas compartidas de las páginas de los portales (portal, club, datos, caja). SSR en las Functions.
import { esc, colorSeguro } from './util.js';
import { paquete } from './sectores.js';

const COLOR_POR_DEFECTO = '#1f1f1f'; // el negocio no eligió color: se usa el acento del tema del sector

// Texto blanco o negro según qué tan claro sea el color de la marca
export function textoSobre(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? '#111111' : '#ffffff';
}

// <!doctype> … <body class="pt"> con el tema del sector y el color del negocio (docs/UI.md §3)
export function inicioPagina(n, { titulo, extraHead = '' } = {}) {
  const pq = paquete(n && n.sector);
  const color = colorSeguro(n && n.color);
  const propio = color.toLowerCase() !== COLOR_POR_DEFECTO;
  return `<!doctype html><html lang="es" data-tema="${esc(pq.tema)}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo || (n && n.nombre) || '')}</title>
${propio ? `<meta name="theme-color" content="${color}">` : ''}
<link rel="stylesheet" href="/assets/tokens.css"><link rel="stylesheet" href="/assets/portal.css">
${propio ? `<style>:root{--marca:${color};--sobre-marca:${textoSobre(color)}}</style>` : ''}
${extraHead}
</head><body class="pt">`;
}

export const firma = () =>
  `<footer class="pt-firma"><a href="/">Hecho con <img src="/assets/marca/logo-nef-una-tinta.svg" alt="nef" width="38" height="14"></a></footer>`;

// Íconos de trazo (docs/UI.md §5)
const ICONOS = {
  lista: '<path d="M4 5h16M4 12h16M4 19h10"/>',
  monedas: '<circle cx="12" cy="12" r="8"/>',
  estrella: '<path d="m12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/>',
  calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16"/>',
  reproducir: '<path d="m8 5 11 7-11 7z"/>',
  flecha: '<path d="m9 6 6 6-6 6"/>',
  volver: '<path d="m15 6-6 6 6 6"/>',
  buscar: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/>',
  qr: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2v2h-2zM18 18h2v2h-2z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
};
export const icono = (k, clase = '') =>
  `<svg class="pt-icono${clase}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[k] || ''}</svg>`;
