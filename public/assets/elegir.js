// "Elige por mí": sugiere UN plato. Funciones puras (las prueba tests/test_sql.mjs con semilla).
// Regla 2 (PRODUCTO §9): el azar nunca decide un premio. Girar NO da monedas ni premios: solo sugiere.
// El resultado se decide ANTES de animar; la animación solo lo muestra.

export const ANTOJOS = [
  { id: 'dulce', texto: 'Algo dulce' },
  { id: 'salado', texto: 'Algo salado' },
  { id: 'bebida', texto: 'Una bebida' },
  { id: 'sorpresa', texto: 'Sorpréndeme' },
];

// Candidatos: nunca agotados; si el antojo no es "sorpresa", solo los que tienen esa etiqueta
export function candidatos(productos, antojo) {
  const disponibles = (productos || []).filter((p) => p && !p.agotado);
  if (!antojo || antojo === 'sorpresa') return disponibles;
  return disponibles.filter((p) => (p.etiquetas || []).includes(antojo));
}

// Elección ponderada: destacado pesa 2, el resto 1. azar() devuelve un número en [0, 1).
export function elegir(productos, antojo, azar = Math.random) {
  const c = candidatos(productos, antojo);
  if (!c.length) return null;
  const peso = (p) => (p.destacado ? 2 : 1);
  let r = azar() * c.reduce((a, p) => a + peso(p), 0);
  for (const p of c) {
    r -= peso(p);
    if (r < 0) return p;
  }
  return c[c.length - 1];
}

// Generador con semilla (LCG, bits altos) para pruebas reproducibles
export function generador(semilla = 42) {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s >>> 8) / 16777216;
  };
}
