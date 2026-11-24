# Bugs

IDs consecutivos B-001, B-002… Estado: abierto · arreglado (con commit) · descartado.

| ID | Qué pasa | Cómo reproducir | Estado |
|---|---|---|---|
| — | (vacío) | | |
- 2026-11-23 · Hoja de la carta: al cerrar con Escape quedaban dos cierres programados (el de la hoja y el del "atrás"); si se abría otro plato
  rápido, el cierre viejo la escondía. La prueba e2e fallaba a veces. Arreglo: `hoja()` cancela el cierre pendiente al abrir (`nef-rpc.js`).
- 2026-11-23 · `tests/e2e.mjs` quedó con su contenido duplicado por un `String.replace` cuyo texto tenía `$'` (en JS inserta "lo que
  sigue a la coincidencia"). `verificar` contó esos 17 casos repetidos y subió `tests/minimo.json` a 56. Se restauró `e2e.mjs`
  desde git y `minimo.json` al valor del último commit (39): no se quitó ninguna prueba real. Lección: en scripts de parche, usar
  `replace(a, () => b)` o el editor, nunca un texto de reemplazo con `$`.
