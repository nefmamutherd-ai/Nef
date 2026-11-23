# Bugs

IDs consecutivos B-001, B-002… Estado: abierto · arreglado (con commit) · descartado.

| ID | Qué pasa | Cómo reproducir | Estado |
|---|---|---|---|
| — | (vacío) | | |
- 2026-11-23 · Hoja de la carta: al cerrar con Escape quedaban dos cierres programados (el de la hoja y el del "atrás"); si se abría otro plato
  rápido, el cierre viejo la escondía. La prueba e2e fallaba a veces. Arreglo: `hoja()` cancela el cierre pendiente al abrir (`nef-rpc.js`).
