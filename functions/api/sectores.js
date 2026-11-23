// /api/sectores → lo público de cada paquete de sector (nombre, palabras, qué estadísticas se muestran).
// Así el navegador (stats.js, admin) no escribe lógica de sector: todo sale de lib/sectores/*.json.
import { SECTORES, paquete } from '../../lib/sectores.js';

export function onRequestGet() {
  const out = {};
  for (const s of SECTORES) {
    const p = paquete(s);
    out[s] = { nombre: p.nombre, tema: p.tema, palabras: p.palabras, estadisticas: p.estadisticas, en_riesgo_dias: p.en_riesgo_dias };
  }
  return new Response(JSON.stringify(out), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
