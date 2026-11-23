# Fase 3 — Paquete gimnasio

> Modo estricto (`AGENTS.md` §3). Definiciones de métricas: `docs/PRODUCTO.md` §8 (exactas, no las cambies).
> El gimnasio **ya registra entradas con su torniquete o huellero**: Nef las **importa por CSV**.
> La entrada por NFC (3.6) es solo para gimnasios sin torniquete.

---

### [x] 3.1 Tablas: socios, entradas, festivos
**Archivos:** `supabase/esquema.sql`, `tests/test_sql.mjs`
**Pasos** (4 partes por tabla):
1. `socios(id uuid pk, negocio_id, codigo_externo text not null, nombre text, telefono text, plan text, creado, unique(negocio_id, codigo_externo))`.
2. `entradas(id bigint identity pk, negocio_id, socio_id → socios cascade, fecha_hora timestamptz not null, origen text check in ('importado','nfc'), creado, unique(negocio_id, socio_id, fecha_hora))`.
   Índice `(negocio_id, fecha_hora)`.
3. `festivos(fecha date pk, nombre text)` con los festivos de Colombia **2026 y 2027** (insert ... on conflict do nothing).
   Fuente: calendario oficial; si no puedes verificar una fecha, anótala en `docs/DECISIONES.md` como "revisar".
4. `importaciones(id, negocio_id, archivo text, filas int, nuevas int, repetidas int, mapeo jsonb, creado)` y
   `negocios.mapeo_csv jsonb` (último mapeo usado).
**Comprobar:** [x] anon no lee socios ni entradas · [x] verificar ✓.

### [x] 3.2 RPC de importación (admin)
**Archivos:** `supabase/esquema.sql`, `tests/test_sql.mjs`
**Pasos:** `importar_entradas(p_negocio uuid, p_filas jsonb, p_mapeo jsonb, p_archivo text) returns json` — solo
`es_admin()` (en Fase 8 también el dueño). `p_filas` = arreglo de objetos `{codigo, fecha_hora, nombre?, telefono?, plan?}`
ya mapeados por el navegador, máximo 5.000 por llamada (el navegador parte en lotes). Crea socios que no existan,
inserta entradas con `on conflict do nothing`, guarda `importaciones` y `mapeo_csv`. Devuelve `{filas, nuevas, repetidas, invalidas}`.
**Comprobar:** [x] importar el mismo lote dos veces → la segunda dice `nuevas: 0` · [x] fecha inválida cuenta en `invalidas` y no rompe el lote.

### [x] 3.3 Datos de prueba conocidos
**Archivos:** `tests/fixtures/generar_entradas.mjs`, `tests/fixtures/entradas.csv` (nuevos)
**Pasos:** script con semilla fija (sin `Math.random`; usa un generador simple tipo LCG con semilla 42) que crea
200 socios × 3 meses (sep–nov 2026) con patrones **conocidos y documentados en el encabezado del script**:
120 regulares (3/semana), 40 que abandonan en octubre, 20 que vuelven en noviembre, 20 esporádicos.
Escribe en el encabezado cuántos activos, abandonos y en riesgo deben salir al 30 de noviembre.
**Comprobar:** [x] correr el script dos veces produce el mismo archivo (mismo tamaño y mismas primeras 5 líneas).

### [x] 3.4 Métricas del gimnasio
**Archivos:** `supabase/esquema.sql`, `tests/test_sql.mjs`
**Pasos:** funciones (`stable`, internas → `revoke` de anon), todas con `p_negocio uuid, p_fecha date`:
`metrica_activos` (≥ 1 entrada en los 14 días hasta p_fecha), `metrica_abandono_mensual` (definición exacta §8),
`metrica_en_riesgo` (devuelve la lista: ≥ 4 entradas históricas y ≥ 10 días sin venir; umbral desde el paquete del sector,
guárdalo en `negocios.en_riesgo_dias int default null` → null = el del sector), `metrica_horas_pico` (matriz día × hora,
Bogotá), `metrica_racha` por socio (semanas seguidas con ≥ 1 entrada, semana = lunes Bogotá).
**Comprobar:** [x] con `entradas.csv` importado en la prueba, cada métrica da **exactamente** lo escrito en el encabezado de 3.3.

### [x] 3.5 Horario legal para escribir (Ley 2300)
**Archivos:** `supabase/esquema.sql`, `tests/test_sql.mjs`
**Pasos:** `puede_escribir(p_momento timestamptz default _ahora()) returns boolean` en hora Bogotá:
lunes a viernes 7:00–19:00, sábado 8:00–15:00, nunca domingo ni festivo (`festivos`). Y `proxima_hora_permitida(...)`
→ timestamptz (para el texto "Disponible el lunes a las 7 a. m.").
**Comprobar:** [x] domingo 10 a. m. → false · [x] sábado 3:30 p. m. → false · [x] martes 8 a. m. no festivo → true · [x] 8 de diciembre 2026 → false.

### [x] 3.6 Importador en el admin
**Archivos:** `public/admin.html`, `public/assets/importar.js` (nuevo), `tests/e2e.mjs`
**Leer antes:** `docs/UI.md` fila "Importar entradas"
**Pasos:** `.n-subir` → leer el CSV en el navegador (separador `,` o `;`, detecta cuál; respeta comillas) →
vista previa 10 filas en `.n-tabla` → `select` por columna (código del socio*, fecha y hora*, fecha y hora separadas
como alternativa, nombre, celular, plan), precargado con `mapeo_csv` → "Importar" en lotes de 2.000 con barra
de progreso → `.n-aviso.ok` con totales. Formatos de fecha aceptados: `AAAA-MM-DD HH:MM`, `DD/MM/AAAA HH:MM`,
`DD/MM/AAAA H:MM a. m.`. Lo que no se entienda cuenta como inválido (nunca adivinar).
**Comprobar:** [x] e2e: subir `tests/fixtures/entradas.csv` → totales correctos; subirlo otra vez → "0 nuevas" · [x] verificar --e2e ✓.

### [x] 3.7 "En riesgo" con WhatsApp en horario legal
**Archivos:** `public/admin.html` (y `public/stats.html` si muestra la lista), `supabase/esquema.sql` (`stats_admin`)
**Pasos:** `stats_admin` agrega `gimnasio: {activos, abandono, en_riesgo: [{nombre, dias, entradas, telefono}], puede_escribir, proxima}`.
**Teléfonos solo en `stats_admin`**; `stats_token` solo devuelve el conteo. Lista `.n-lista` con botón WhatsApp
(mensaje prellenado amable, sin promociones) **solo si `puede_escribir`**; si no, texto "Disponible <proxima>".
**Comprobar:** [x] prueba SQL: `stats_token` no contiene `telefono` · [x] e2e o SQL con domingo simulado → sin botón.

### [x] 3.8 Máquinas y clases
**Archivos:** `supabase/esquema.sql`, `functions/n/[slug]/p/[id].js`, `functions/n/[slug]/clases.js`, `lib/sectores/gimnasio.json`, `public/admin.html`, pruebas
**Pasos:**
1. Tabla `productos` con las columnas de `plan-v2-detalle.md` §2 "Carta" **más** `tipo text not null default 'plato' check in ('plato','clase','maquina','servicio')`,
   `video_url text`, `pasos jsonb default '[]'` (máx. 3 textos), `horario jsonb` (clases: `[{dia:1, hora:"18:00", duracion:60, cupo:20}]`).
   Si `productos` ya existe, solo `add column if not exists`.
2. RPC `producto_publico(p_slug, p_id)` y `clases_hoy(p_slug)` (día de hoy en Bogotá).
3. `/n/<slug>/p/<id>`: ficha de máquina según `docs/UI.md` (video sin autoplay; YouTube solo con `youtube-nocookie.com`).
4. `/n/<slug>/clases`: lista de hoy. En `gimnasio.json` el botón "Clases de hoy" pasa a `/n/{slug}/clases`.
5. Tags: destino `producto` con `producto_id` → `/t/` redirige a la ficha.
6. Admin: crear máquina (nombre, video, 3 pasos) y clase (nombre, horario).
**Comprobar:** [x] e2e: tag de máquina → ficha con video y 3 pasos (captura) · [x] clases de hoy muestra solo las de hoy · [x] verificar --e2e ✓.

### [x] 3.9 Entrada por NFC (solo gimnasios sin torniquete)
**Pasos:** `negocios.servicios.entrada_nfc` (bool). Tag destino `entrada` → `/n/<slug>/entrada`: si el socio tiene token
del club guardado, RPC `registrar_entrada_nfc(p_slug, p_token)` (máx. 1 por día, origen `nfc`) → pantalla
`.pt-hecho` con racha. **No suma monedas** (PRODUCTO §9 regla 6: solo suma la asistencia). Si no tiene token: lo manda a unirse.
**Comprobar:** [x] dos toques el mismo día = 1 entrada · [x] negocio sin `entrada_nfc` → la ruta muestra el portal normal.

### [x] 3.10 Cierre de la fase 3
[x] Criterios de la Fase 3 de `docs/PLAN.md` · [x] PROGRESO.md · [x] `git push origin desarrollo`.
