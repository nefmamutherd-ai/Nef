// Paquetes de sector: todo lo propio de cada sector (textos, botones, tema, palabras) vive en
// lib/sectores/*.json. El motor (functions/) nunca escribe textos de un sector.
import cafe from './sectores/cafe.json' with { type: 'json' };
import gimnasio from './sectores/gimnasio.json' with { type: 'json' };

const PAQUETES = { cafe, gimnasio };

export const SECTORES = Object.keys(PAQUETES);

// Paquete del sector; si no existe, el de café
export function paquete(sector) {
  return PAQUETES[sector] || cafe;
}

// Botones grandes del portal: solo los de servicios contratados, máximo 3.
// Un botón con "requiere" (ej. resena_url) se omite si el negocio no tiene ese dato, salvo que traiga una
// "alterna" que sí se cumpla (ej. carta propia → si no hay, el link externo de la carta).
export function botonesPortal(negocio) {
  const n = negocio || {};
  const servicios = n.servicios || { base: true };
  const slug = encodeURIComponent(String(n.slug || ''));
  const cumple = (r) => !r || !!n[r];
  return paquete(n.sector).botones
    .filter((b) => servicios[b.servicio] === true)
    .map((b) => (cumple(b.requiere) ? b : b.alterna && cumple(b.alterna.requiere) ? { ...b, ruta: b.alterna.ruta, requiere: b.alterna.requiere } : null))
    .filter(Boolean)
    .map((b) => ({ ...b, ruta: b.ruta.replaceAll('{slug}', slug) }))
    .slice(0, 3);
}
