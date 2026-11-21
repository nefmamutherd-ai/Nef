# Fase 1 — Cimientos: cuentas, sectores, antispam y portal nuevo

> Modo estricto: lee `AGENTS.md` §3 (el ciclo) antes de empezar. Una tarjeta a la vez, en orden.
> La landing (`public/index.html`) **ya está hecha**: no la toques.

---

### [ ] 1.1 Base de datos: empresas, accesos, sector, servicios y `_ahora()`
**Objetivo:** que un negocio pertenezca a una empresa y tenga sector y servicios activables.
**Archivos:** `supabase/esquema.sql`, `tests/test_sql.mjs`
**Leer antes:** `docs/ARQUITECTURA.md` §2 y §3 · `AGENTS.md` §6 (patrones)
**Pasos:**
1. Al final de `esquema.sql` agrega un bloque `-- ===== Fase 1 =====`.
2. `public._ahora()` → `returns timestamptz language sql stable as $$ select coalesce(nullif(current_setting('nef.ahora', true), '')::timestamptz, now()) $$;`
   (las pruebas fijan la hora con `set nef.ahora = '2026-11-22 10:00-05'`).
3. Tabla `empresas(id uuid pk, nombre text not null, nit text, plan text not null default 'base', estado_pago text not null default 'al_dia' check in ('al_dia','por_vencer','vencido'), club_compartido boolean not null default false, creado timestamptz default now())` con las 4 partes (RLS + política admin).
4. Tabla `accesos(user_id uuid not null, empresa_id uuid not null references empresas on delete cascade, rol text not null check in ('dueno','gerente'), creado timestamptz default now(), primary key (user_id, empresa_id))` con las 4 partes.
5. Columnas en `negocios` (con `add column if not exists`):
   `empresa_id uuid references public.empresas(id) on delete set null`,
   `sector text not null default 'cafe' check (sector in ('cafe','gimnasio'))`,
   `servicios jsonb not null default '{"base":true,"catalogo":false,"club":false,"estudio":false}'`,
   `ubicacion_etiqueta text` (ej. "Sede Chapinero").
6. Migración idempotente: por cada negocio con `empresa_id is null`, crear una empresa con su mismo nombre y asignarla
   (bloque `do $$ ... $$` que solo actúa sobre los que no tienen empresa).
7. `negocio_publico(p_slug)`: agrega al JSON `sector`, `servicios`, `ubicacion_etiqueta`. No agregues nada privado.
**Comprobar:**
- [ ] Prueba: el esquema corre dos veces sin error (ya existe; debe seguir pasando).
- [ ] Prueba nueva: un negocio creado antes tiene `empresa_id` después de correr el esquema.
- [ ] Prueba nueva: `negocio_publico` devuelve `sector` y `servicios` y NO devuelve `empresa_id` ni `notas`.
- [ ] Prueba nueva: `anon` no puede leer `empresas` ni `accesos` (count = 0).
- [ ] Prueba nueva: con `set nef.ahora = '2026-01-01 00:00-05'`, `select _ahora()` devuelve esa fecha.
- [ ] `npm run verificar` → ✓ Todo en orden.
**No hacer:** no cambies tablas existentes de otra forma; no borres `plan` de negocios.

---

### [ ] 1.2 Antispam de estadísticas (un toque por celular cada 30 min)
**Objetivo:** que recargar la página no infle los toques.
**Archivos:** `supabase/esquema.sql`, `functions/t/[codigo].js`, `tests/test_sql.mjs`, `tests/e2e.mjs`
**Leer antes:** `docs/ARQUITECTURA.md` §5
**Pasos:**
1. `toques`: `add column if not exists dispositivo_id uuid`. Índice `toques_tag_disp_idx on toques(tag_id, dispositivo_id, creado)`.
2. `resolver_toque`: agrega parámetro `p_dispositivo_id uuid default null` **al final** (crea la función nueva con
   `create or replace`; si Postgres se queja por la firma, primero `drop function if exists public.resolver_toque(text, text, text);`).
   Si existe un toque del mismo `tag_id` y `dispositivo_id` con `creado > _ahora() - interval '30 minutes'`, **no inserta**,
   pero devuelve lo mismo (la persona igual llega).
3. En `functions/t/[codigo].js`: lee la cookie `nef_d`; si no existe o no es un uuid válido, crea uno con
   `crypto.randomUUID()`. Pásalo como `p_dispositivo_id`. En la respuesta agrega
   `Set-Cookie: nef_d=<uuid>; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`.
   (Para agregar el header usa `new Response(r.body, r)` sobre lo que devuelve `redirigir`.)
**Comprobar:**
- [ ] Prueba SQL: dos toques del mismo dispositivo en 5 min = 1 fila; a los 31 min (cambiando `nef.ahora`) = 2 filas.
- [ ] Prueba SQL: sin `dispositivo_id` (null) se registra siempre (compatibilidad).
- [ ] e2e: visitar `/t/<codigo>` dos veces con el mismo contexto de Playwright → el panel muestra 1 toque nuevo, no 2.
- [ ] `npm run verificar -- --e2e` → ✓.
**No hacer:** no guardes IP ni nada que identifique a la persona.

---

### [ ] 1.3 Paquetes de sector (textos, botones y tema fuera del código)
**Objetivo:** que cambiar `sector` de un negocio cambie textos, botones y tema sin tocar código.
**Archivos:** `lib/sectores/cafe.json`, `lib/sectores/gimnasio.json`, `lib/sectores.js` (nuevos)
**Pasos:**
1. Forma exacta de cada JSON:
```json
{
  "sector": "cafe",
  "tema": "calido",
  "palabras": { "lugar": "mesa", "catalogo": "carta", "item": "plato", "visita": "visita" },
  "botones": [
    { "servicio": "catalogo", "id": "carta", "texto": "Ver la carta", "icono": "lista", "ruta": "/c/{slug}/menu" },
    { "servicio": "club", "id": "monedas", "texto": "Mis monedas", "icono": "monedas", "ruta": "/n/{slug}/club" },
    { "servicio": "base", "id": "resena", "texto": "Déjanos tu reseña", "icono": "estrella", "ruta": "/c/{slug}/resena" }
  ],
  "monedas": { "modo": "visita", "plural": "monedas", "singular": "moneda" },
  "en_riesgo_dias": 21
}
```
   Gimnasio: `tema "energia"`, palabras `{ "lugar": "máquina", "catalogo": "clases", "item": "clase", "visita": "entrada" }`,
   botones `Clases de hoy` (catalogo, icono calendario) · `Mis monedas` (club) · `Déjanos tu reseña` (base),
   `monedas.modo "asistencia"`, `en_riesgo_dias 10`.
2. `lib/sectores.js`: `import cafe from './sectores/cafe.json'; import gimnasio from './sectores/gimnasio.json';`
   exporta `paquete(sector)` (devuelve cafe si el sector no existe) y
   `botonesPortal(negocio)` → filtra `botones` por `negocio.servicios[b.servicio] === true`, reemplaza `{slug}`,
   y devuelve **máximo 3**. Si el botón es `resena` y el negocio no tiene `resena_url`, lo omite.
3. Mientras no exista la carta interna (Fase 5) ni las clases (Fase 3), "Ver la carta" y "Clases de hoy" van a
   `/c/{slug}/menu` (el `menu_url` de hoy). Las fases 3 y 5 cambian esa ruta en el JSON.
4. Si `wrangler pages dev` no acepta importar `.json`, convierte los dos archivos a `.js` con `export default {...}`
   y anótalo en `docs/DECISIONES.md`.
**Comprobar:**
- [ ] `node -e "import('./lib/sectores.js').then(m=>console.log(m.botonesPortal({slug:'x',sector:'gimnasio',resena_url:'https://g.page/r/x',servicios:{base:true,club:true,catalogo:true}})))"` imprime 3 botones de gimnasio.
- [ ] `npm run verificar` → ✓.
**No hacer:** ningún texto de sector escrito dentro de `functions/`; todo sale del paquete.

---

### [ ] 1.4 Portal nuevo con temas (SSR)
**Objetivo:** `/n/<slug>` igual a `docs/diseno/maqueta.png` (café) y al portal de gimnasio de `componentes.png`.
**Archivos:** `functions/n/[slug].js`, `tests/e2e.mjs`
**Leer antes:** `docs/UI.md` §1–§3 y la fila "Portal" · `docs/diseno/componentes.html` (bloques `.pt-cabeza`, `.pt-botones`, `.pt-enlaces`)
**Pasos:**
1. Usa el esqueleto de portal de `docs/UI.md` §3: `data-tema` = `paquete(n.sector).tema`; CSS `tokens.css` + `portal.css`.
2. `.pt-cabeza`: logo (si `logo_url` pasa `urlSegura`, `<img>`; si no, iniciales), nombre, y debajo:
   el nombre del tag si la URL trae `?t=` (ya se lee hoy) y el tag es del negocio; si no, `ubicacion_etiqueta`.
3. `.pt-botones` con `botonesPortal(n)`; el primero `.principal`. Íconos de `docs/UI.md` §5.
4. `.pt-enlaces`: WiFi (abre hoja con nombre y clave + botón "Copiar clave"), WhatsApp, Instagram y `links` extra.
   Todos los clics siguen pasando por `/c/<slug>/<boton>` como hoy (no rompas el registro de clics).
5. `.pt-firma`: logo una tinta `/assets/marca/logo-nef-una-tinta.svg` + "Hecho con nef".
6. Conserva todo lo que hoy hace la página (meta tags, `textoSobre`, escapado). Quita los estilos viejos en línea.
**Comprobar:**
- [ ] e2e: portal del negocio de prueba como café → `data-tema="calido"`, 1 a 3 `.pt-boton`, captura `portal-cafe-movil.png` a 390×844.
- [ ] e2e: cambiar el negocio a `sector: 'gimnasio'` (por la API del mock, como hace el caso "crear negocio") → `data-tema="energia"`, botón "Clases de hoy", captura `portal-gym-movil.png`.
- [ ] Los casos e2e viejos ("botones registran y redirigen", "portal en móvil") siguen pasando.
- [ ] Mira las dos capturas junto a `maqueta.png`: mismos tamaños de botón (76 px), máximo 3 botones, sin scroll horizontal.
- [ ] `npm run verificar -- --e2e` → ✓.

---

### [ ] 1.5 Página `/inactivo` con la marca Nef
**Archivos:** `functions/inactivo.js`
**Pasos:** `<body class="nef">` + `nef-ui.css`; logo centrado arriba; `.n-vacio` con
"Este punto no está activo" / "Si eres el dueño del negocio, escríbenos para activarlo."; `.n-btn.principal` "Conoce Nef" → `/`.
Mantén el código HTTP que devuelve hoy.
**Comprobar:** [ ] e2e "código inventado → inactivo" sigue pasando · [ ] captura móvil revisada · [ ] verificar ✓.

---

### [ ] 1.6 Admin con la marca Nef + sector y servicios
**Objetivo:** que Jacobo elija sector y servicios por negocio desde `/admin`.
**Archivos:** `public/admin.html`, `tests/e2e.mjs`
**Leer antes:** `docs/UI.md` fila "Admin de Jacobo" · bloques `.n-*` en `componentes.html`
**Pasos:**
1. Cambia los estilos de `admin.html` a `nef-ui.css` (`<body class="nef">`, `.n-barra`, `.n-contenido`, `.n-tabla`, `.n-form`…).
   **No cambies ningún `id`** que use `tests/e2e.mjs` (búscalos con el buscador antes de tocar el HTML).
2. En el formulario del negocio: `.n-opciones` "Café / Gimnasio" (campo `sector`), `.n-interruptor` para
   Catálogo, Club y Estudio (Base siempre activo, no se muestra), campo "Ubicación (ej. Sede Chapinero)".
3. Guarda con el mismo mecanismo que ya usa el admin para guardar el negocio.
**Comprobar:**
- [ ] e2e nuevo: en el admin cambiar el negocio a Gimnasio + activar Club → el portal muestra tema energía y "Mis monedas".
- [ ] Todos los casos e2e anteriores pasan. Capturas del admin a 1280 y 390 revisadas.
- [ ] `npm run verificar -- --e2e` → ✓.

---

### [ ] 1.7 Cierre de la fase 1
**Pasos:** revisa los criterios de "Listo cuando" de la Fase 1 en `docs/PLAN.md`; escribe la entrada de cierre en
`docs/PROGRESO.md` con la lista de capturas; `git push origin desarrollo`.
**Comprobar:** [ ] `npm run verificar -- --e2e` ✓ · [ ] push hecho.
