Arranca la siguiente fase pendiente:
1. Lee `docs/PRODUCTO.md`, `docs/PLAN.md` y la última entrada de `docs/PROGRESO.md`. Toma la primera fase sin terminar.
2. Abre `docs/tareas/fase-N.md` y sigue sus tarjetas en orden (márcalas `[x]`). Si la fase tiene pantallas: `docs/UI.md` + `docs/diseno/componentes.png`, y además portales → `docs/DISENO.md` + `docs/diseno/maqueta.png`; superficies de Nef → `docs/marca/MARCA.md` + `docs/marca/tablero.png`.
3. Escribe en `docs/PROGRESO.md` el plan corto de la sesión (qué vas a hacer y cómo lo vas a probar).
4. Trabaja sin pedir confirmación, siguiendo `CLAUDE.md`. Antes de cada commit, `npm run verificar` (con `-- --e2e` si hubo pantallas). Al terminar la fase, `/revisar-seguridad`, commit, y sigue con la siguiente fase de `docs/PLAN.md` hasta acabar el día. Al final, `/cerrar-sesion`.
