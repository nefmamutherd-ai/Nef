> **REFERENCIA TÉCNICA.** Úsala para el detalle de tablas, RPC y animaciones. El orden de las fases y
> las decisiones de producto están en `docs/PLAN.md` y `docs/PRODUCTO.md`: si algo de aquí los contradice
> (por ejemplo, la entrada del gimnasio por NFC, que ahora es importada), **ganan ellos**.

# Plan técnico v2 — portal, catálogo, "Elige por mí", club y paquetes por sector

Plan para ejecutar de forma autónoma. Leer primero `CLAUDE.md` (stack, seguridad y reglas que nunca se rompen)
y `docs/DISENO.md` (cómo se ve: cada pantalla de este plan tiene su versión aprobada en `docs/diseno/maqueta.png`).
Orden: el de `docs/PLAN.md`. La Fase 5 (AR) es **próximamente: no construirla**.
Cada fase termina con pruebas en verde y un commit.

---

## ⚠️ Cambios del 19 de noviembre — mandan sobre todo lo demás de este documento
Si algo de abajo contradice esta sección, gana esta sección.

1. **Producto versátil**: no es "de restaurantes". Motor común + paquetes por sector (café, gimnasio,
   servicios) + servicios activables (Base, Catálogo, Club, Red). Ver `docs/PRODUCTO.md`.
   Orden de construcción: 0.5 → 3 → G → 1 → 2 → 4 → 5 → 6 → 7.
2. **Nombres genéricos en el código**: "catálogo" en vez de "carta" (tablas `categorias`/`productos`
   sirven para platos, clases y máquinas; agregar `productos.tipo` = plato|clase|maquina|servicio y
   `productos.video_url`). Los textos visibles ("carta", "clases") salen de `lib/sectores/*.json`.
3. **Diseño simple** (`docs/DISENO.md`, maqueta nueva). Se eliminan de la interfaz: chips de filtro a la
   vista (pasan a la lupa), insignias de colores (solo "Agotado hoy"), botón flotante (pasa a enlace
   "Elige por mí" arriba de la carta), bloques múltiples en la tarjeta del club (un solo aviso a la vez).
   La ruleta se llama **"Elige por mí"**. Las animaciones de §4 se mantienen pero discretas.
4. **Logística de puntos** (`docs/PRODUCTO.md` §6): el dueño configura **% de devolución** (3/5/8) y el valor
   en pesos de cada premio; el sistema calcula monedas. Columnas: `negocios.devolucion_pct`
   (numeric, default 5), `premios.valor_pesos` (int); `premios.costo` se calcula
   (`ceil(valor_pesos / valor_moneda)`) donde `valor_moneda` es fijo por negocio (ej. $10).
   Modo pesos por defecto: monedas = floor(compra × devolucion_pct / 100 / valor_moneda).
   **Vencimiento**: monedas vencen tras 12 meses sin visitas (movimiento `vencimiento`).
5. **Caja: primero el número de celular**, el escáner es la alternativa (la maqueta lo muestra así).
6. **Marca**: nombre provisional **Nef** (`MARCA`, por defecto `Nef`); ver `docs/marca/MARCA.md`.

### Fase G — Paquete gimnasio
**Construir**
- Tag con destino `entrada`: al tocarlo, si el socio tiene token en el celular → registra asistencia
  (máximo una por día y sede) y muestra la pantalla "Entrada registrada" con su racha. Sin token →
  registro rápido (nombre + celular + autorización) y luego registra.
- Tabla `asistencias(id, membresia_id, negocio_id, tag_id, fecha date, creado)` con `unique(membresia_id, negocio_id, fecha)`.
- La racha semanal y la regla de bono de la Fase 4 aplican igual, alimentadas por asistencias.
  Monedas por asistencia: configurable (`monedas_por_asistencia`, default 10).
- Stickers de máquina: productos `tipo = maquina` con `video_url` (YouTube/Instagram/MP4). Destino de
  tag `producto` → abre directo la ficha de esa máquina con su video y 3 pasos de uso.
- Clases: productos `tipo = clase` con `horario` (jsonb: día, hora inicio/fin, instructor, cupo
  informativo). Portal: "Clases de hoy" filtra por el día actual (hora Bogotá).
- Panel: lista **socios en riesgo** = con ≥ 4 asistencias en total y sin venir hace 10+ días
  (umbral configurable), botón de WhatsApp prellenado por socio y botón "copiar lista".
- Estadísticas gym: asistencias por día y hora, socios activos esta semana, rachas activas, en riesgo.
**Criterios**
- [ ] Doble toque el mismo día no duplica asistencia ni monedas.
- [ ] Racha correcta en semanas seguidas, con comodín y sin comodín (pruebas SQL con `_ahora()`).
- [ ] Socio en riesgo aparece y desaparece al volver.
- [ ] Pantalla "Entrada registrada" igual a la maqueta en tema Energía.

### Fase 7 — Red (grupos y redes de negocios)
- **Grupo** (`grupos(id, nombre)`, `negocios.grupo_id`): varias sedes de un mismo dueño comparten
  catálogo opcionalmente y **un solo saldo de monedas** (la membresía es del grupo). Fácil: mismo dueño.
- **Red** (`redes`, `red_negocios`): negocios distintos. Cada uno mantiene **sus propias monedas**; la red
  comparte la identidad del cliente (mismo celular), muestra "otros lugares de la red" en el portal y
  tiene retos de red ("visita 3 lugares este mes") cuyo premio pone cada negocio o la red.
  Moneda compartida entre negocios distintos queda para después (requiere liquidación mensual de quién
  le debe a quién) — no construir.

## 0. Qué existe hoy (v1, funcionando y probado)

- `/t/<codigo>` registra el toque (NFC o QR con `?q`) y redirige según `tags.destino`.
- `/n/<slug>` página del negocio con botones (menú externo, reseña, WhatsApp, WiFi, Instagram, links).
- `/c/<slug>/<boton>` registra clics. `/stats?k=<token>` estadísticas para el dueño. `/admin` panel.
- Tablas: `admins`, `negocios`, `tags`, `toques`, `clicks`. Ver `supabase/esquema.sql`.

## 1. La experiencia que queremos (resumen)

```
Toque NFC / QR ─► /t/abc123 ─► PORTAL /n/cafe-luna
                              ├─ Ver la carta  ─► /n/cafe-luna/carta   (animada, filtros, ruleta, AR opcional)
                              ├─ Mis monedas   ─► /n/cafe-luna/club    (registro o tarjeta del cliente)
                              ├─ Déjanos tu reseña (sin premio, nunca)
                              └─ WiFi · WhatsApp · Instagram · otros
Personal del negocio ─► /caja/cafe-luna  (PIN) ─► registrar visita (+monedas) / canjear premio
Dueño ─► /stats?k=...  (ahora también: carta, ruleta, club)
Jacobo ─► /admin (todo lo anterior + Carta + Club por negocio)
```

Un tag puede apuntar directo a una sección: nuevos destinos `carta` y `club` (además de los actuales).
Si el tag tiene nombre (ej. "Mesa 4"), el portal y la carta lo muestran discretamente ("Mesa 4").

---

## 2. Modelo de datos (agregar a `supabase/esquema.sql`, idempotente)

### Negocios: columnas nuevas
| columna | tipo | default | uso |
|---|---|---|---|
| `menu_activo` | boolean | false | muestra "Ver la carta" interna (si false y hay `menu_url`, sigue el link externo) |
| `ruleta_activa` | boolean | true | botón "¿No sabes qué pedir?" |
| `club_activo` | boolean | false | muestra "Mis monedas" |
| `moneda_plural` | text | 'monedas' | nombre editable (ej. "granos") |
| `moneda_singular` | text | 'moneda' | |
| `modo_monedas` | text check in ('visita','pesos') | 'visita' | cómo se gana |
| `monedas_por_visita` | int | 10 | modo visita |
| `pesos_por_moneda` | int | 1000 | modo pesos: 1 moneda por cada $N |
| `bienvenida` | int | 50 | monedas al registrarse ("arranque con ventaja") |
| `bono_ruleta` | int | 10 | bono fijo si pide el plato de la ruleta (lo confirma la caja) |
| `bono_racha` | int | 30 | bono cada 4 semanas seguidas |
| `horas_entre_visitas` | int | 3 | antifraude: mínimo entre visitas que suman |
| `niveles` | jsonb | ver abajo | umbrales por monedas **ganadas en total** |
| `pin_caja_hash` | text | null | hash bcrypt del PIN de 6 dígitos |
| `politica_datos_extra` | text | null | texto adicional opcional para la política |

`niveles` por defecto: `[{"nombre":"Visitante","desde":0},{"nombre":"Habitual","desde":200},{"nombre":"De la casa","desde":600},{"nombre":"Leyenda","desde":1500}]`

### Carta
```
categorias(id uuid pk, negocio_id → negocios on delete cascade, nombre text, orden int, activo bool default true)
productos(
  id uuid pk, negocio_id → negocios cascade, categoria_id → categorias on delete set null,
  nombre text not null, descripcion text (máx 140 caracteres, check),
  precio int not null check (precio >= 0),         -- pesos, sin decimales
  foto_url text, etiquetas text[] default '{}',    -- valores permitidos: vegetariano, vegano, picante, sin_gluten, nuevo, dulce, salado, bebida
  destacado bool default false,                    -- pesa doble en la ruleta y sale primero en su categoría
  agotado bool default false,                      -- se ve en gris con "Agotado hoy", la ruleta lo excluye
  activo bool default true, orden int default 0,
  modelo_glb_url text, ar_activo bool default false,   -- AR (Fase 5)
  creado timestamptz default now()
)
eventos_carta(id bigint identity, negocio_id, producto_id null, tipo text check in ('ver_carta','ver_producto','girar','ruleta_acepto','ver_ar'), tag_codigo text null, creado timestamptz)
```

### Club
```
clientes(id uuid pk, telefono text unique not null,   -- normalizado: solo dígitos con 57 adelante
         nombre text not null, creado timestamptz)
membresias(
  id uuid pk, cliente_id → clientes cascade, negocio_id → negocios cascade, unique(cliente_id, negocio_id),
  token text unique not null default replace(gen_random_uuid()::text,'-',''),  -- va en la tarjeta del cliente
  saldo int not null default 0 check (saldo >= 0),
  total_ganado int not null default 0,      -- define el nivel; canjear NO lo baja
  visitas int not null default 0,
  ultima_visita timestamptz, racha_semanas int default 0, ultima_semana date,   -- lunes de la semana (hora Bogotá)
  comodin_mes date,                          -- mes en que usó su comodín de racha
  acepto_datos_at timestamptz not null, creado timestamptz default now()
)
movimientos(id bigint identity, membresia_id → membresias cascade,
            tipo text check in ('bienvenida','visita','bono_hora_dorada','bono_racha','bono_ruleta','canje','ajuste'),
            monedas int not null,           -- + gana, − canjea
            premio_id uuid null, detalle text, creado timestamptz)
premios(id uuid pk, negocio_id → negocios cascade, nombre text, costo int check (costo > 0), foto_url text, activo bool, orden int)
horas_doradas(id uuid pk, negocio_id → negocios cascade, dia_semana int check 0..6 (0=domingo),
              hora_inicio time, hora_fin time, multiplicador numeric default 2 check (multiplicador between 1 and 3))
intentos_pin(id bigint identity, negocio_id, ok bool, creado timestamptz)
```
RLS: todas cerradas; admin con política `es_admin()` como las de v1.

### Reglas del club (implementar en SQL, dentro de las RPC, en una sola transacción)
- **Registro:** crea `clientes` (o reutiliza por teléfono) + `membresias` con `saldo = total_ganado = bienvenida` y movimiento `bienvenida`. Si ya era miembro, devuelve su token (no duplica bienvenida).
- **Visita** (solo desde caja): rechaza si `now() - ultima_visita < horas_entre_visitas`.
  Monedas base = `monedas_por_visita` (modo visita) o `floor(valor_compra / pesos_por_moneda)` (modo pesos).
  Si la hora actual (Bogotá) cae en una `horas_doradas` del negocio → base × multiplicador (redondeo hacia abajo); el extra se registra como movimiento `bono_hora_dorada` aparte (para estadísticas).
  Si la caja marca "pidió el plato de la ruleta" → + `bono_ruleta` (movimiento `bono_ruleta`).
- **Racha semanal** (se actualiza en cada visita): semana = lunes de la semana en Bogotá.
  Misma semana → nada. Semana siguiente → `racha + 1`. Saltó exactamente una semana y no ha usado comodín este mes → `racha + 1` y marca `comodin_mes`. Si no → racha = 1.
  Cuando la racha llega a 4, 8, 12… → + `bono_racha` (movimiento `bono_racha`).
- **Canje** (solo desde caja): premio activo del negocio y `saldo >= costo` → movimiento `canje` negativo. `total_ganado` no cambia.
- **Nivel** = el último de `niveles` cuyo `desde <= total_ganado`. Se calcula, no se guarda.

### RPC (todas `security definer`, `set search_path = public, extensions`)
Públicas (anon):
- `portal_publico(p_slug)` → datos del portal (v1 `negocio_publico` + flags `menu_activo`, `club_activo`, `ruleta_activa`, nombres de moneda).
- `carta_publica(p_slug)` → negocio + categorías activas ordenadas + productos activos (sin `creado`). Una sola llamada.
- `registrar_evento_carta(p_slug, p_tipo, p_producto uuid, p_tag text)` → valida tipo, inserta. Sin retorno útil.
- `club_registrar(p_slug, p_nombre, p_telefono, p_acepta bool)` → exige `p_acepta = true`, normaliza teléfono (10 dígitos que empiezan por 3 → 57…), devuelve `{token}`.
- `club_tarjeta(p_slug, p_token)` → saldo, total_ganado, nivel actual y siguiente (con cuánto falta), racha, si hay hora dorada activa ahora (y hasta qué hora), premios activos con `alcanzable`, el premio más cercano no alcanzable ("te faltan X para Y"), últimos 10 movimientos, nombres de la moneda.

Caja (anon + PIN, cada llamada valida PIN y aplica bloqueo):
- `caja_entrar(p_slug, p_pin)` → ok + nombre del negocio + premios + modo de monedas. Registra intento.
- `caja_buscar(p_slug, p_pin, p_token_o_telefono)` → miembro (nombre, saldo, nivel, racha, última visita, si puede sumar ya).
- `caja_visita(p_slug, p_pin, p_token, p_valor_compra int null, p_ruleta bool)` → aplica reglas, devuelve detalle de lo ganado (base, hora dorada, ruleta, racha) y saldo nuevo.
- `caja_canje(p_slug, p_pin, p_token, p_premio uuid)` → aplica, devuelve saldo nuevo.

Admin (authenticated + `es_admin()`):
- `fijar_pin_caja(p_negocio, p_pin)` → valida 6 dígitos, guarda hash.
- `stats_admin` / `stats_token`: agregar bloques `carta` (vistas, top productos vistos, giros de ruleta, % aceptados) y `club` (miembros, nuevos en el periodo, visitas, monedas emitidas/canjeadas, premios más canjeados, lista "en riesgo": miembros con ≥2 visitas y sin venir hace 21+ días, con nombre y teléfono — **teléfonos solo en stats_admin, en stats_token solo el conteo**).

---

## 3. Fases

### Fase 1 — Portal + carta animada
**Construir**
1. Esquema de carta + columnas nuevas de `negocios` + destinos de tag `carta`, `club` + RPC `portal_publico`, `carta_publica`, `registrar_evento_carta`. Ajustar `/t/` para los destinos nuevos (`/n/<slug>/carta?t=`, `/n/<slug>/club?t=`).
2. Rediseñar `/n/<slug>` como **portal**: encabezado del negocio (como hoy) + tarjetas grandes en este orden:
   "Ver la carta" (principal, color de marca) · "Mis {moneda_plural}" (si club activo; muestra saldo si el teléfono ya tiene token guardado en `localStorage`) · "Déjanos tu reseña" · luego WiFi, WhatsApp, Instagram, links. Si `menu_activo` es false y hay `menu_url`, "Ver la carta" usa el link externo como en v1.
3. `/n/<slug>/carta` (SSR + JS):
   - Barra superior fija: nombre del negocio + buscador (lupa que se expande).
   - Pestañas de categorías fijas (sticky) con **indicador que se desliza**; al hacer scroll se marca la categoría visible (IntersectionObserver); al tocar una pestaña, scroll suave a esa sección.
   - Chips de filtro bajo las pestañas, generados de las etiquetas presentes (Vegetariano, Picante, Sin gluten, Nuevo…). Filtrar anima la lista (salen con fade, entran escalonadas).
   - **Tarjeta de producto** (lectura rápida): foto cuadrada a la izquierda (o arriba en destacados), nombre (1 línea), descripción (máx 2 líneas), precio grande y claro, insignias (Nuevo, Picante 🌶 → usar ícono SVG, no emoji). Agotado: foto en gris + "Agotado hoy", al final de su categoría.
   - Tocar tarjeta → **hoja inferior (bottom sheet)** con foto grande, descripción completa, etiquetas, precio, botón "Ver en tu mesa" si tiene AR (Fase 5). Se cierra deslizando hacia abajo, con la X o tocando fuera. Usar View Transitions API si existe (la foto "vuela" de la tarjeta a la hoja); si no, animación normal de la hoja.
   - Botón flotante "¿No sabes qué pedir?" (si `ruleta_activa`) → Fase 2.
   - Registrar eventos `ver_carta` (al cargar) y `ver_producto` (al abrir hoja), con `navigator.sendBeacon`.
4. Panel `/admin`: pestaña **Carta** por negocio:
   - Categorías: crear, renombrar, ordenar (botones subir/bajar), activar.
   - Productos: tabla con edición en línea de precio, agotado y activo (guardado automático como en Tags); formulario completo para lo demás.
   - **Subir foto**: a Supabase Storage, bucket público `fotos`. El bucket y sus políticas (lectura pública, escritura solo admin) van en un archivo aparte, `supabase/storage.sql`, porque el Postgres de pruebas no tiene Storage. En el e2e, interceptar `/storage/v1/` con `ctx.route` y responder como lo haría Supabase. Antes de subir, en el navegador: recortar al centro a cuadrado, redimensionar a 1000×1000 y convertir a WebP calidad 0.82 con `<canvas>`. Ruta `negocio_id/producto_id-<timestamp>.webp`.
   - Atajo "Agotado hoy" muy visible (es lo que más se toca en el día a día).
   - Interruptores en el negocio: Carta activa, Ruleta activa.

**Criterios de aceptación**
- [ ] El esquema corre 2 veces sin error; anon no puede leer `productos` directo, solo vía `carta_publica`.
- [ ] Carta con 6 categorías y 40 productos: HTML inicial < 60 KB (sin fotos), primera pintura útil sin esperar JS.
- [ ] Pestañas sticky + indicador deslizante + scrollspy funcionan en móvil.
- [ ] Filtros y buscador combinan bien; "sin resultados" muestra mensaje amable y botón para limpiar.
- [ ] Hoja inferior abre/cierra con animación, se puede cerrar deslizando, y el botón atrás del celular la cierra (usar `history.pushState`).
- [ ] Con `prefers-reduced-motion: reduce` no hay animaciones de movimiento (solo fades cortos).
- [ ] Panel: crear categoría + producto con foto; marcar agotado; reflejo inmediato en la carta.
- [ ] Capturas en `tests/capturas/`: portal, carta, carta filtrada, hoja de producto (móvil 390×844).

### Fase 2 — Ruleta "¿No sabes qué pedir?"
**Construir**
- Hoja inferior con chips: "Lo que sea", "Algo dulce", "Algo salado", "Bebida", "Menos de $X" (X = mediana de precios del negocio redondeada a miles). Botón "Girar".
- Animación tipo tragamonedas vertical: las tarjetas de productos (foto + nombre) pasan rápido y **desaceleran** (easing de salida, 1,8–2,5 s en total) hasta quedar una. `navigator.vibrate(15)` en cada "clic" de la desaceleración donde exista. Al final: pequeño rebote de escala (1 → 1.04 → 1) y confeti mínimo (8–12 partículas CSS, 600 ms).
- Selección **ponderada**: `destacado` pesa 2, el resto 1; excluye agotados e inactivos. El resultado se decide ANTES de animar (la animación solo lo muestra).
- Resultado: "¿Te animas?" → **"Lo pido"** muestra pantalla para enseñar al mesero (nombre grande + foto) y, si el club está activo, el texto "Dile en la caja que fue el de la ruleta: +{bono_ruleta} {moneda_plural}". **"Otra vez"** vuelve a girar.
- Guardar en `localStorage` el último "Lo pido" (producto + hora) para mostrarlo en la tarjeta del club.
- Eventos `girar` y `ruleta_acepto`.

**Criterios**
- [ ] 1.000 selecciones simuladas: los destacados salen ~2× más que los normales; nunca sale un agotado.
- [ ] La animación se ve fluida en un Android de gama media (solo transform/opacity; sin layout en cada frame).
- [ ] Con movimiento reducido: sin tragamonedas, aparece el resultado con fade.

### Fase 3 — Club de monedas (base)
**Construir**
1. Tablas y RPC del club (sección 2). Pruebas SQL de cada regla (bienvenida única, antifraude de horas, modo pesos, canje sin saldo rechazado, total_ganado no baja).
2. `/n/<slug>/club`:
   - **Sin token** (no registrado en este celular): pantalla de bienvenida que vende el club ("Únete y recibe **50 {moneda_plural}** de regalo") con vista previa del primer premio. Formulario: nombre, celular (teclado numérico), casilla **sin marcar** "Autorizo el tratamiento de mis datos según la política de datos" (link a `/n/<slug>/datos`). Al registrarse: guardar token en `localStorage` (clave `toque:<slug>`), animación de monedas cayendo y contador subiendo de 0 a la bienvenida.
   - **Con token**: la tarjeta (ver maqueta acordada): saldo grande con contador animado, nivel con insignia, barra de progreso "Te faltan X para {premio}", catálogo de premios (los alcanzables resaltados con "¡Ya te alcanza!"), historial corto, botón **"Mostrar mi código"** → pantalla completa con QR grande del token (usar `public/assets/qrcode.js`), texto "Muéstraselo al cajero" y el teléfono en pequeño como respaldo.
   - "¿Cambiaste de celular?" → escribe tu número → si existe la membresía, pide confirmar con el nombre registrado (simple, sin SMS en v2) y recupera el token. Anotar en DECISIONES.md el riesgo y que la v3 usará código por WhatsApp.
3. `/n/<slug>/datos`: política de tratamiento de datos con plantilla (responsable: el negocio; encargado: Mamut Herd; finalidad: programa de fidelización y mensajes del negocio si el cliente lo acepta; derechos ARCO; contacto). Encabezado visible: "Plantilla — revisar con un abogado antes de usar con clientes reales" SOLO en el panel, no en la página pública.
4. `/caja/<slug>` (página estática + RPC con PIN; pensada para el celular o tablet del negocio):
   - Pantalla de PIN (6 dígitos, teclado numérico grande). Se recuerda en `sessionStorage` hasta cerrar la pestaña.
   - Botón grande **"Escanear código"**: usa la cámara con `BarcodeDetector` si existe; si no, copiar a `public/assets/` la librería jsQR (MIT) y leer frames de un `<video>`. Alternativa siempre visible: escribir el celular.
   - Ficha del cliente: nombre, nivel, saldo, racha, "última visita hace X". Acciones: **"Sumar visita"** (en modo pesos pide el valor de la compra; casilla "Pidió el plato de la ruleta") y **"Canjear premio"** (lista de premios con los alcanzables habilitados; confirmación).
   - Resultado claro y grande: "+15 granos (10 visita + 5 hora dorada)", saldo nuevo. Volver a escanear.
   - Errores amables: "Ya sumó hace 40 minutos. Puede volver a sumar después de las 4:20 pm".
5. Panel `/admin`: pestaña **Club** por negocio: activar club, nombre de la moneda (singular/plural), modo y valores, bienvenida, bonos, horas entre visitas, PIN de caja (fijar/cambiar), premios (CRUD con foto), niveles (editar nombres y umbrales), link de la caja para copiar.

**Criterios**
- [ ] Registro → tarjeta con 50 monedas; volver a registrarse con el mismo número no duplica la bienvenida.
- [ ] Caja: PIN errado 10 veces → bloqueo 1 hora con mensaje claro.
- [ ] Visita suma; segunda visita antes de 3 h se rechaza con la hora a la que podrá sumar.
- [ ] Canje con saldo insuficiente se rechaza; canje válido descuenta saldo pero no baja el nivel.
- [ ] El botón de reseña del portal sigue sin dar monedas (prueba explícita).
- [ ] e2e: registro en móvil → caja escanea el QR (en la prueba: simular con el token) → suma → la tarjeta del cliente muestra el saldo nuevo al recargar.

### Fase 4 — Club que engancha
**Construir**
- Hora dorada (CRUD en panel con días y horas; la tarjeta muestra el banner "Hora dorada ahora: {moneda_plural} ×2 hasta las 5:00 pm" solo cuando aplica, y "Próxima hora dorada: martes 3–5 pm" cuando no).
- Racha semanal con comodín mensual (reglas de la sección 2). En la tarjeta: llama + "Racha de N semanas", y "Vuelve antes del domingo para mantenerla" si aún no ha venido esta semana. Al llegar a múltiplos de 4: celebración en la caja y en la tarjeta.
- Niveles: insignia en la tarjeta; al subir de nivel, la próxima vez que abra la tarjeta ve una animación de "¡Subiste a De la casa!" (guardar último nivel visto en `localStorage`).
- Estadísticas del club en `/stats` y `/admin` + lista **"En riesgo"** (solo admin) con botón por cliente que abre WhatsApp con mensaje prellenado editable: `https://wa.me/57XXXXXXXXXX?text=...` (envío manual, sin API, sin costo).

**Criterios**
- [ ] Pruebas SQL de racha: semanas seguidas, salto con comodín, salto sin comodín, bono en semana 4 y 8.
- [ ] Hora dorada aplicada solo dentro del rango y en el día correcto (hora Bogotá), probado con horas simuladas (parametrizar `now` en una función interna `_ahora()` que las pruebas puedan sobreescribir).
- [ ] `stats_token` nunca devuelve teléfonos.

### Fase 5 — Realidad aumentada · PRÓXIMAMENTE (no construir hasta que Jacobo lo pida)
Se deja especificada para cuando un cliente la pague. Las fotos las hará la hermana de Jacobo (ver `docs/RECURSOS.md` → Fotografía).
**Construir**
- En el panel, por producto: campo "Modelo 3D (.glb)" con subida a Storage (bucket `modelos` en `supabase/storage.sql`, límite 8 MB, aviso si pesa más de 5 MB) + interruptor `ar_activo`.
- En la carta: insignia "Ver en 3D" en la tarjeta; en la hoja, botón "Ver en tu mesa". Al tocarlo, **recién ahí** cargar `@google/model-viewer` (import dinámico desde CDN) y mostrar el visor con `ar ar-modes="webxr scene-viewer quick-look" camera-controls ar-scale="fixed"`; iOS usa el USDZ autogenerado.
- Evento `ver_ar`. En estadísticas: vistas de AR por plato.
- `docs/AR-PRODUCCION.md`: guía para Jacobo de cómo producir un plato (fotos con RealityScan Mobile o KIRI Engine, limpieza y reducción en Blender, exportar GLB < 5 MB con texturas ≤ 2048 px, probar en Android y iPhone).

**Criterios**
- [ ] La carta sin AR no descarga nada de model-viewer (verificar en la red de Playwright).
- [ ] Con un GLB de ejemplo (usar uno libre de los ejemplos de model-viewer, descargado a `tests/fixtures/`), el visor carga desde la hoja del producto.

---

## 4. Animaciones (guía de diseño)

Objetivo: **moderna y viva, pero que se lea en 2 segundos**. La animación acompaña, nunca hace esperar.

| Momento | Animación | Duración |
|---|---|---|
| Carga de la carta | Tarjetas entran con fade + subir 8 px, escalonadas 30 ms (solo las visibles; máx 10) | 220 ms c/u |
| Cambio de categoría | Indicador de la pestaña se desliza (transform: translateX + scaleX) | 250 ms |
| Filtrar / buscar | Salen con fade 120 ms, entran escalonadas | 200 ms |
| Tocar tarjeta | Escala 0.98 al presionar; la foto viaja a la hoja (View Transitions) | 280 ms |
| Hoja inferior | Sube con easing de salida; se arrastra con el dedo y se cierra al pasar 30% | 300 ms |
| Fotos | Fondo con el color promedio de la foto mientras carga (guardar `foto_color` al subir) y fade al cargar | 200 ms |
| Ruleta | Tragamonedas que desacelera + rebote + confeti mínimo | 1,8–2,5 s |
| Monedas ganadas | Contador que sube + 5–8 monedas que caen (CSS) | 800 ms |
| Subir de nivel | Insignia que aparece con escala 0.6 → 1 y brillo | 700 ms |

Reglas técnicas: solo `transform`/`opacity`; easing `cubic-bezier(.2,.8,.2,1)`; nada de librerías de animación;
todo desactivable con `prefers-reduced-motion`. Tipografía: system-ui; precios con `font-variant-numeric: tabular-nums`.
Colores: el color de marca del negocio como acento; fondo claro cálido (#f4f3ef) como hoy.

## 5. Presupuesto de rendimiento
- Portal y carta: HTML SSR < 60 KB, CSS+JS propios < 40 KB comprimidos, sin fuentes externas.
- Fotos: WebP 1000 px para la hoja; en la lista usar la misma foto con `loading="lazy"`, `decoding="async"`, `width/height` fijos (sin saltos de diseño).
- Toque → carta visible en < 1,5 s en 4G.

## 6. Notas técnicas para no trabarse
- Rutas: `functions/n/[slug].js` (portal) puede convivir con `functions/n/[slug]/carta.js`. Si Cloudflare las confunde, mover el portal a `functions/n/[slug]/index.js`.
- `/caja/<slug>` y otras páginas estáticas con slug en la ruta: servir el HTML desde una Function con `env.ASSETS.fetch(new URL('/caja.html', request.url))` y leer el slug con `location.pathname` en el navegador.
- El saldo en la tarjeta "Mis monedas" del portal se pide desde el navegador (el servidor no ve `localStorage`): `club_tarjeta` en segundo plano después de pintar.
- La lista "En riesgo" con teléfonos solo existe en el panel de Jacobo. El link del dueño (`/stats?k=`) no tiene login, por eso solo muestra el conteo. Un login para dueños queda para v3.
- Si `wrangler pages dev` no ve las variables, revisar que exista `.dev.vars` (copiar de `tests/dev.vars.ejemplo`).

## 7. Fuera de alcance de v2 (no construir)
Pedidos y pagos desde la mesa · mensajes automáticos por WhatsApp API · Google/Apple Wallet · álbum de la carta ·
referidos · pasaporte del barrio · login del dueño para editar su carta (por ahora lo edita Jacobo en /admin).
Dejar el modelo de datos listo para ellos cuando sea gratis hacerlo (ej. `clientes` es global para el pasaporte).
