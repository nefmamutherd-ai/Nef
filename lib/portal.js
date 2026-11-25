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
  // La piel del portal: la que eligió el negocio o, si no eligió, la de su sector
  const tema = ['calido', 'limpio', 'noche', 'energia'].includes(n && n.tema) ? n.tema : pq.tema;
  const color = colorSeguro(n && n.color);
  const propio = color.toLowerCase() !== COLOR_POR_DEFECTO;
  return `<!doctype html><html lang="es" data-tema="${esc(tema)}"><head>
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
  wifi: '<path d="M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01"/>',
  whatsapp: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9.5 9.5c.3 2 2 3.8 4 4.2"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><path d="M17 7h.01"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  lugar: '<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  dado: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01"/>',
  sonido: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  racha: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 5-2 8 0 4 3 7 7 7z"/>',
  carta: '<path d="M5 4h14v16H5z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  dulce: '<path d="M4 13h16l-2 7H6z"/><path d="M6 13a6 6 0 0 1 12 0"/><path d="M12 4v3"/>',
  salado: '<path d="M3 12h18"/><path d="M5 12a7 7 0 0 0 14 0"/><path d="M9 8c0-2 1-3 3-4M14 8c0-1.5.6-2.5 2-3"/>',
  bebida: '<path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M9 3v2M13 3v2"/>',
  sorpresa: '<path d="m12 3 2.2 4.6 5 .7-3.6 3.5.9 5L12 14.4 7.5 16.8l.9-5L4.8 8.3l5-.7z"/><path d="M5 20h.01M19 20h.01M12 21h.01"/>',
};
export const icono = (k, clase = '') =>
  `<svg class="pt-icono${clase}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[k] || ''}</svg>`;

// Fondo vivo (tema cálido): manchas de color que se mueven y dibujos de comida flotando. Solo decoración (aria-hidden).
// Va antes del <main> en la portada, la carta y el club; el CSS solo lo muestra en el tema cálido.
export function fondoVivo() {
  const DOODLES = ['<path d="M5 9h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M9 3c0 2 2 2 2 4"/>',
    '<path d="M3 15c2-6 6-9 9-9s7 3 9 9c-3 2-6 2-9 2s-6 0-9-2zM8 8l2 8M16 8l-2 8M12 6v11"/>',
    '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 13v8M17 3c-2 0-3 3-3 7h3v11"/>',
    '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
    '<path d="M4 14a8 8 0 0 0 16 0zM8 10c0-2 1-3 2-4M12 10c0-2 1-4 3-5"/>'];
  return `<div class="pt-deco" aria-hidden="true"><i class="pt-mancha uno"></i><i class="pt-mancha dos"></i><i class="pt-mancha tres"></i>${
    DOODLES.map((d, k) => `<svg class="pt-doodle d${k}" viewBox="0 0 24 24">${d}</svg>`).join('')}</div>`;
}
