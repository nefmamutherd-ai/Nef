# Nef — instrucciones para Claude Code

> ¿No eres Claude? Lee `AGENTS.md` (modo estricto, tarjeta por tarjeta). Claude: también te aplican las reglas 3–10 de su §2, su §5 y su §8.

**Nef** (nombre provisional; el repo y algunos archivos aún dicen "toque") es un producto de **Mamut Herd**
(dueño: Jacobo López): un chip NFC + QR en la mesa, la recepción o la máquina; el cliente acerca el celular,
entra al portal del negocio, y el negocio lo conoce, lo premia y lo recupera. Primeros nichos: cafés y
gimnasios. Motor común + paquetes por sector + servicios activables.
**Nunca escribas lógica de un sector en el motor**: lo propio de cada sector va en `lib/sectores/*.json`.

## Lee esto primero (en este orden)
1. `docs/PRODUCTO.md` — **qué** es Nef. Fuente de verdad: si otro documento lo contradice, gana este.
2. `docs/PLAN.md` — **qué construir hoy y en qué orden**, con criterios de "listo".
   `docs/ARQUITECTURA.md` — **cómo está armado**: cuentas, capas de la BD, rutas, seguridad, estadísticas, escala.
3. Última entrada de `docs/PROGRESO.md` — dónde quedó la sesión anterior.
4. Según la tarea: **`docs/UI.md` + `docs/diseno/componentes.png`** (cómo se arma cada pantalla, con qué clases),
   `docs/tareas/fase-N.md` (tarjetas con pasos y comprobaciones; márcalas `[x]` al terminar),
   `docs/DISENO.md` + `docs/diseno/maqueta.png` (portales de los negocios),
   `docs/marca/MARCA.md` + `docs/marca/GUIA-WEB.md` + `docs/marca/landing-referencia.png` (landing, paneles, informes),
   `docs/referencia/plan-v2-detalle.md` (tablas, RPC y animaciones en detalle), `docs/DECISIONES.md`.
5. `docs/ventas/` y `docs/kit/` son contexto del negocio: no se construyen.

Comandos: `/siguiente-fase`, `/revisar-seguridad`, `/cerrar-sesion` (en `.claude/commands/`).

## Cómo trabajar (jornada sin supervisión)
- **Trabaja solo, fase por fase, sin pedir confirmación.** Si algo es ambiguo, elige lo más simple que
  cumpla `PRODUCTO.md`, anótalo en `docs/DECISIONES.md` y sigue.
- **Si te bloqueas** más de 30 minutos en algo, anótalo como BLOQUEO en `docs/PROGRESO.md` (qué intentaste)
  y sigue con otra tarea que no dependa de eso. No te quedes esperando.
- **Antes de cada commit: `npm run verificar`** (y `npm run verificar -- --e2e` si hubo pantallas). Si no dice
  "✓ Todo en orden", no hay commit. No edites `scripts/verificar.mjs` ni `tests/minimo.json` para que pase.
- Al terminar cada fase: TODAS las pruebas en verde, capturas revisadas, `/revisar-seguridad`, commit
  `fase N: <resumen>`, entrada en `docs/PROGRESO.md`. No pases a la siguiente fase con pruebas rotas.
- Antes de dar algo por terminado, ábrelo en el navegador (Playwright) y mira capturas en móvil (390×844)
  y escritorio, comparándolas con la maqueta o el tablero de marca. Si se ve mal, arréglalo.
- Nada es "debería funcionar": se demuestra con una prueba o una captura.
- Al agregar una tabla o columna, revisa RLS y permisos en el mismo cambio (el bug más repetido en Prodigia).
- **Git:** trabaja en la rama `desarrollo` (créala si no existe) y haz `git push origin desarrollo` al cerrar
  cada fase. **Nunca** push a `main` ni `--force`: Cloudflare publica a producción lo que llegue a `main`;
  Jacobo revisa la vista previa de `desarrollo` y él hace el merge.
- **Nunca**: desplegar a mano, pegar o pedir llaves (`service_role`, contraseñas), usar datos reales.
- Si Jacobo pidió algo y no se hizo, dilo explícitamente en `docs/PROGRESO.md`.

## Stack (no cambiarlo)
- **Cloudflare Pages** + **Pages Functions** (`functions/`), sin framework ni build. Estáticos en `public/`.
  Código compartido del servidor en `lib/`.
- **Supabase** (Postgres + Auth + Storage). Esquema en `supabase/esquema.sql`, **idempotente**
  (`if not exists`, `create or replace`, `add column if not exists`). Buckets en `supabase/storage.sql`.
- Front: HTML + CSS + JS vanilla (módulos ES). Nada de React/Vue/Tailwind ni bundlers. Librerías pequeñas
  copiadas a `public/assets/`. Por CDN solo `@supabase/supabase-js` (panel/caja).
- Páginas del cliente final (portal, catálogo, club): **SSR en la Function**; el JS solo agrega interacción.
- La caja funciona **sin conexión** (cola en IndexedDB + RPC idempotentes). Ver `docs/PLAN.md` Fase 2.

## Seguridad (obligatorio)
- Todas las tablas con RLS. Las páginas públicas solo usan **RPC `security definer`** que exponen lo mínimo.
  Nunca exponer notas, teléfonos (salvo al admin), tokens ni PINs.
- Funciones internas: `revoke execute ... from public, anon, authenticated`. Toda RPC con `set search_path`.
- Escapar todo en HTML (`esc()`), links de usuario solo `http/https` (`urlSegura()`).
- PIN de caja: `extensions.crypt` / `extensions.gen_salt('bf')`, bloqueo tras 10 intentos/hora.
- Exportaciones para el estudio: sin nombres ni teléfonos (ids anonimizados).

## Reglas de negocio que NUNCA se rompen (detalle en PRODUCTO.md §9)
1. Reseñas sin premio. 2. El azar nunca decide un premio. 3. Autorización de datos explícita (Ley 1581).
4. Condiciones del club visibles (Ley 1480). 5. Mensajes solo en horario legal y por canal autorizado
(Ley 2300). 6. Monedas solo desde caja o entradas registradas. 7. Nef no toca la plata del negocio.

## Estilo
- **Pantallas solo con las clases de `public/assets/portal.css` (portales y caja) y `nef-ui.css` (superficies de Nef)**;
  reglas en `docs/UI.md`. Si falta un componente, agrégalo primero a la hoja y a `docs/diseno/componentes.html`.
- La landing `/` (`public/index.html`) ya está hecha según `GUIA-WEB.md`: no la rehagas.
- Portales de los negocios: `docs/DISENO.md` + `tokens.css` (temas por sector). Diseño **simple**:
  máximo 3 botones, un aviso a la vez, nada de chips/insignias a la vista.
- Superficies de Nef (landing, paneles, informes): `docs/marca/MARCA.md` (clase `.nef` en `tokens.css`).
- Texto en **español de Colombia**, tuteo, frases cortas. Pesos con `Intl.NumberFormat('es-CO')`, sin decimales.
- Animaciones: transform/opacity, 150–300 ms, `prefers-reduced-motion`.
- Código en español (tablas, columnas, funciones).

## Pruebas
Una vez: `npm install` y `npx playwright install chromium`. Copia `tests/dev.vars.ejemplo` a `.dev.vars`.
```bash
npm run test:sql      # esquema 2 veces en Postgres embebido + permisos y reglas (sale con error si falla)
npm run mock          # (en segundo plano) Supabase simulado en :54321
npm run dev           # (en segundo plano) sitio local en :8788
npm run test:e2e      # recorrido en navegador + capturas en tests/capturas/
npm run verificar     # guardas (secretos, SQL idempotente, RLS, pruebas que no bajan) + test:sql
```
- El mock simula PostgREST + Auth sobre Postgres real (pglite) con `pgcrypto` en `extensions`.
  Admin de prueba: cualquier correo con contraseña `clave123`. No tiene Storage: en el e2e se intercepta `/storage/v1/`.
- Reglas que dependen de la hora: usa `_ahora()` en el esquema (reemplazable en pruebas), nunca `now()` directo.
- **Cada fase agrega sus casos a `tests/test_sql.mjs` y `tests/e2e.mjs`.**

## Mapa
```
supabase/esquema.sql            Esquema + RLS + RPC
lib/util.js                     rpc(), esc(), urlSegura(), waLink(), redirigir()…
functions/t/[codigo].js         Toque NFC/QR → registra y redirige
functions/n/[slug].js           Portal del negocio (SSR)
functions/c/[slug]/[boton].js   Clic de botón → registra y redirige
public/admin.html               Panel de Jacobo · public/stats.html estadísticas del dueño
AGENTS.md                       Instrucciones para cualquier otro modelo (modo estricto)
docs/tareas/fase-N.md           Tarjetas de tareas con pasos y comprobaciones
docs/UI.md, docs/diseno/componentes.*   Cómo se arma cada pantalla · catálogo de componentes
public/assets/portal.css, nef-ui.css    Componentes (portales/caja · superficies de Nef)
scripts/verificar.mjs           Verificador (npm run verificar)
docs/PRODUCTO.md                Qué es Nef (fuente de verdad)
docs/PLAN.md                    Orden de construcción y criterios de listo
docs/ARQUITECTURA.md            Multi-cliente, BD por capas, rutas, seguridad, estadísticas, escala
docs/DISENO.md, docs/diseno/    Portales: tokens con temas, maqueta.html/.png
docs/marca/                     Marca Nef: MARCA.md, logos SVG, fuentes, tablero
docs/referencia/                Detalle técnico anterior (tablas, RPC, animaciones)
docs/kit/, docs/ventas/         Contexto del negocio (no construir)
docs/RECURSOS.md                Skills, MCP y lecciones de otros proyectos
docs/PROGRESO.md · DECISIONES.md · BUGS.md   Bitácoras
```
