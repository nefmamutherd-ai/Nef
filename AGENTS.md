# Nef — instrucciones para CUALQUIER modelo de IA

> **Si eres Claude (Claude Code):** sigue `CLAUDE.md`; de este archivo te aplican las reglas 3 a 10 de §2,
> §5 (verificador) y §8 (git). Puedes trabajar fase por fase como dice `docs/PLAN.md`, marcando las tarjetas.
>
> **Si eres otro modelo** (GPT / Codex, Gemini, DeepSeek, Qwen, Kimi, Llama, Mistral, Cursor, Copilot…):
> sigue **este archivo al pie de la letra**. Trabajas en **modo estricto**: una tarjeta de tarea a la vez,
> solo los archivos que la tarjeta permite, y nada se da por hecho sin que el verificador pase.

## 1. Qué es esto (30 segundos)
Nef es un producto de Mamut Herd (dueño: Jacobo López). Un chip NFC + QR en la mesa de un café o en la
máquina de un gimnasio; el cliente acerca el celular y abre el **portal** del negocio (carta, monedas del club,
reseña). El dueño ve estadísticas en su **panel**. Detalle: `docs/PRODUCTO.md` (manda sobre todo lo demás).

Stack fijo: Cloudflare Pages + Pages Functions (`functions/`), Supabase (Postgres) con el esquema en
`supabase/esquema.sql`, HTML + CSS + JS **vanilla**. Pruebas con Postgres embebido (pglite) y Playwright.

## 2. Reglas de oro (si rompes una, el proyecto se daña)
1. **Una tarjeta por vez.** Las tareas están en `docs/tareas/fase-N.md`. Toma la **primera** casilla `[ ]`
   de la fase más baja que no esté completa. No adelantes trabajo de otras tarjetas.
2. **Solo toca los archivos que la tarjeta lista** en "Archivos". Si necesitas otro, escríbelo en
   `docs/PROGRESO.md` como BLOQUEO y pasa a la siguiente tarjeta.
3. **No borres, no renombres, no "limpies"** código que no es de tu tarjeta. No reformatees archivos enteros.
4. **No cambies** el stack, `package.json`, `scripts/verificar.mjs`, `tests/minimo.json`, `.gitignore`,
   ni la configuración de `.claude/`. No instales nada.
5. **No borres ni debilites pruebas** para que pasen. Si una prueba falla, el error está en tu código.
6. **No inventes estilos.** Pantallas solo con las clases de `docs/UI.md` (`portal.css` / `nef-ui.css`).
7. **SQL siempre idempotente** y con RLS (patrones en §6). Nunca `drop table`, nunca `delete` sin `where`.
8. **Nada de llaves ni datos reales.** Nunca leas ni escribas `.dev.vars`/`.env`. Nunca `service_role`.
9. **No despliegues.** Nunca `wrangler deploy`, nunca `git push` a `main`, nunca `--force`.
10. **Si dudas, elige lo más simple** que cumpla `docs/PRODUCTO.md` y anótalo en `docs/DECISIONES.md`.
    No preguntes: Jacobo no está mirando.

## 3. El ciclo de cada tarjeta (sigue los pasos en orden)
```
1. LEER      La tarjeta completa + los documentos que cita (solo las secciones que cita).
2. PLANEAR   Escribe en docs/PROGRESO.md:  "### <fecha> · Tarjeta N.M — <título>"
             + 3 a 6 viñetas: qué vas a cambiar y cómo lo vas a probar.
3. PROBAR    Si la tarjeta pide pruebas, escríbelas PRIMERO (§6 tiene la plantilla). Deben fallar.
4. HACER     Cambios pequeños, solo en los archivos permitidos.
5. VERIFICAR npm run verificar          (y si hay pantallas:  npm run verificar -- --e2e)
             Si falla: lee el mensaje "→", arregla, repite. Máximo 3 intentos por el mismo error.
6. MIRAR     Si hay pantallas: abre las capturas de tests/capturas/ a 390 px y 1280 px y compáralas con
             docs/diseno/maqueta.png o componentes.png. Si algo se ve roto, vuelve a 4.
7. CERRAR    Marca la casilla [x] en docs/tareas/fase-N.md
             Escribe en PROGRESO.md: "Hecho: … · Pruebas: verificar OK (N SQL, M e2e)"
             git add -A && git commit -m "tarea N.M: <título corto>"
8. SEGUIR    Siguiente tarjeta. Al terminar una fase completa: git push origin desarrollo
```
**Si te atascas** (3 intentos fallidos con el mismo error, o algo depende de Jacobo): deshaz tus cambios
de esa tarjeta (`git checkout -- <archivos de la tarjeta>`), escribe en `docs/PROGRESO.md`:
`BLOQUEO tarjeta N.M: <qué intentaste, el error exacto, qué crees que falta>`, y pasa a la siguiente tarjeta
que no dependa de esa.

## 4. Comandos (siempre desde la raíz del proyecto)
```bash
npm install                      # una vez
npx playwright install chromium  # una vez
cp tests/dev.vars.ejemplo .dev.vars   # una vez (valores de prueba, no reales)

npm run verificar                # reglas + pruebas SQL  ← antes de CADA commit
npm run mock                     # terminal 2: Supabase simulado en :54321 (déjalo corriendo)
npm run dev                      # terminal 3: sitio local en :8788 (déjalo corriendo)
npm run verificar -- --e2e       # además, el recorrido en navegador con capturas
```
En Windows, usa las mismas órdenes en PowerShell; no uses comandos de Linux (`rm -rf`, `sed`, `grep`).

## 5. El verificador (`npm run verificar`)
Revisa, en este orden: archivos obligatorios, dependencias nuevas, secretos, scripts/fuentes externos,
esquema SQL (idempotente, RLS en cada tabla, `search_path` en cada RPC `security definer`), que el número de
pruebas no baje, que no estés en `main`, y corre las pruebas. **Si no dice "✓ Todo en orden", no hagas commit.**
Los "⚠" son avisos: revísalos, pero no bloquean.

## 6. Patrones (copia estos; no inventes otros)

**Columna nueva** (al final de `supabase/esquema.sql`, en la sección de la fase):
```sql
alter table public.negocios add column if not exists sector text not null default 'cafe'
  check (sector in ('cafe', 'gimnasio'));
```
**Tabla nueva** (siempre las 4 partes juntas):
```sql
create table if not exists public.premios (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  nombre text not null,
  valor_pesos int not null check (valor_pesos > 0),
  activo boolean not null default true,
  creado timestamptz not null default now()
);
create index if not exists premios_negocio_idx on public.premios(negocio_id);
alter table public.premios enable row level security;
drop policy if exists admin_todo on public.premios;
create policy admin_todo on public.premios for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
```
**RPC pública** (la única forma en que el público toca datos):
```sql
create or replace function public.premios_publicos(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('nombre', p.nombre, 'valor', p.valor_pesos) order by p.valor_pesos), '[]')
  from public.premios p join public.negocios n on n.id = p.negocio_id
  where n.slug = p_slug and n.activo and p.activo;
$$;
grant execute on function public.premios_publicos(text) to anon, authenticated;
```
**Función interna** (que el público NO debe llamar): después de crearla,
`revoke execute on function public.<nombre>(<tipos>) from public, anon, authenticated;`
**Hora actual en reglas:** usa `public._ahora()` (si no existe, créala en la tarjeta 1.1), nunca `now()` directo.
**Hash de PIN:** `extensions.crypt(p_pin, extensions.gen_salt('bf'))` y `search_path = public, extensions`.

**Prueba SQL** (en `tests/test_sql.mjs`, antes de la línea final que imprime el total):
```js
await caso('premios públicos no muestran inactivos', async () => {
  await como('anon');
  const [{ r }] = await q(`select premios_publicos('cafe-luna') r`);
  assert.ok(r.every((p) => p.nombre !== 'Inactivo'));
});
```
`como('anon')`, `como('authenticated', ADMIN)` cambian de rol. `q(sql, params)` devuelve filas.

**Caso e2e** (en `tests/e2e.mjs`):
```js
await caso('portal de gimnasio usa tema energía', async () => {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(BASE + '/n/' + slug);
  assert.equal(await p.getAttribute('html', 'data-tema'), 'energia');
  await p.screenshot({ path: DIR + 'portal-gym-movil.png', fullPage: true });
  await p.close();
});
```
**Página SSR** (Function): todo dato pasa por `esc()`; links de usuario por `urlSegura()`; color por
`colorSeguro()`. Importa de `lib/util.js`. Responde con `html(...)` de `lib/util.js`.

**Navegador:** `textContent`, nunca `innerHTML` con datos. Pesos con `Intl.NumberFormat('es-CO', …)`.

## 7. Errores típicos que ya pasaron en otros proyectos de Jacobo
| Error | Cómo evitarlo |
|---|---|
| Tabla nueva sin RLS o sin política → el panel no ve nada o todos ven todo | Siempre las 4 partes de la tabla (§6) |
| Columna nueva que la RPC no devuelve | Actualiza la RPC en la misma tarjeta y agrega una prueba que lea la columna |
| "Ambiguous column reference" en plpgsql | Prefija con el alias de la tabla (`p.nombre`) y nombra parámetros con `p_` |
| El esquema falla la segunda vez | Todo con `if not exists` / `or replace` / `drop policy if exists` |
| Hora del servidor en UTC | Días y horas de negocio con `at time zone 'America/Bogota'` |
| Arreglar una prueba cambiando lo que espera | Prohibido. Arregla el código o anota BLOQUEO |
| Decir "debería funcionar" | Solo cuenta "verificar OK" + captura revisada |

## 8. Git
```bash
git switch desarrollo || git switch -c desarrollo     # al empezar
git add -A && git commit -m "tarea 1.3: tema por sector en el portal"
git push origin desarrollo                            # al cerrar cada fase
```
Nunca: `git push origin main`, `git push --force`, `git reset --hard`, `git clean`, `git rebase`.
Jacobo revisa la vista previa de `desarrollo` en Cloudflare y él hace el merge a `main`.

## 9. Al terminar la jornada
Escribe al final de `docs/PROGRESO.md`, para Jacobo, en este formato:
```
## Resumen para Jacobo — <fecha>
Hecho: <tarjetas cerradas>
Bloqueos: <tarjeta, qué falta, qué necesita de ti>
Decisiones que tomé por ti: <lista corta, detalle en DECISIONES.md>
Para probar: <rutas y qué mirar>
```

## 10. Mapa
```
AGENTS.md (este) · CLAUDE.md (Claude) · docs/tareas/fase-N.md (QUÉ hacer, tarjeta por tarjeta)
docs/PRODUCTO.md (qué es, manda) · docs/ARQUITECTURA.md (cómo está armado) · docs/PLAN.md (fases)
docs/UI.md + docs/diseno/componentes.png (cómo se arma cada pantalla) · docs/diseno/maqueta.png (portales)
supabase/esquema.sql · lib/util.js · functions/ (SSR) · public/ (estáticos, landing hecha)
tests/test_sql.mjs · tests/e2e.mjs · scripts/verificar.mjs
docs/PROGRESO.md · DECISIONES.md · BUGS.md (bitácoras)
```
