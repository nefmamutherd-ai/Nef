# Cómo poner a trabajar a otro modelo (para Jacobo)

El proyecto ya trae todo para que **cualquier** asistente de código lo construya sin dañarlo:
`AGENTS.md` (reglas en modo estricto), `docs/tareas/` (tarjetas paso a paso), `docs/UI.md` + componentes
(la interfaz ya diseñada) y `npm run verificar` (el guardián que bloquea los errores típicos).

## El flujo
```
1. Abre la carpeta del proyecto en la herramienta (Codex, Gemini CLI, Cursor, OpenCode, Claude Code…)
2. Asegúrate de estar en la rama desarrollo        git switch desarrollo
3. Pega el mensaje de abajo
4. Déjalo trabajar. Cada tarjeta termina en un commit con "verificar OK"
5. Al volver: lee el "Resumen para Jacobo" al final de docs/PROGRESO.md
6. Mira la vista previa de la rama desarrollo en Cloudflare. Si está bien, tú haces el merge a main
```

## Qué archivo lee cada herramienta sola
| Herramienta | Lee automáticamente |
|---|---|
| Claude Code | `CLAUDE.md` |
| Codex (OpenAI), Cursor, OpenCode, Copilot y la mayoría | `AGENTS.md` |
| Gemini CLI | `GEMINI.md` (que manda a `AGENTS.md`) |
Si una herramienta no lee ninguno, el mensaje de abajo se lo ordena.

## Mensaje para pegar (cualquier modelo que no sea Claude)
```
Lee AGENTS.md completo y síguelo al pie de la letra. Trabajas en modo estricto en el proyecto Nef.
Toma la primera tarjeta sin marcar de docs/tareas/ (empieza por fase-1.md) y sigue el ciclo de AGENTS.md §3:
planear en PROGRESO.md → pruebas primero → cambios solo en los archivos de la tarjeta → npm run verificar →
mirar capturas → marcar [x] → commit. Luego la siguiente tarjeta. No me preguntes nada: si dudas, elige lo más
simple que cumpla docs/PRODUCTO.md y anótalo en docs/DECISIONES.md; si te atascas 3 veces, BLOQUEO y sigues.
Nunca push a main, nunca --force, nunca edites scripts/verificar.mjs ni tests/minimo.json, nunca instales nada.
Al terminar, escribe el "Resumen para Jacobo" de AGENTS.md §9.
```

## Mensaje para Claude Code
```
/siguiente-fase
```

## Si el otro modelo es débil (comete muchos errores)
- Dale **una sola tarjeta** por mensaje: "Haz solo la tarjeta 1.2 de docs/tareas/fase-1.md y detente".
- Revisa `git log` y `docs/PROGRESO.md` entre tarjetas.
- Si dañó algo: `git log` → busca el último commit bueno → `git revert <commit>` (no borres historia).
- Las tarjetas de SQL y caja sin conexión (2.3, 2.5) son las más delicadas: si puedes, déjalas para Claude.

## Permisos
Cada herramienta tiene su forma de dar permisos. Lo seguro para este proyecto, en cualquiera:
permitir editar archivos, `npm`, `node`, `npx wrangler pages dev`, `npx playwright`, `git add/commit/push`
(a `desarrollo`). **No** permitir: `wrangler deploy`, `git push --force`, `git reset --hard`, leer `.dev.vars`.
