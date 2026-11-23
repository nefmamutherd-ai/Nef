# Fase 2 — Club de monedas + caja (también sin conexión)

> Modo estricto (`AGENTS.md` §3). Tablas y reglas de referencia: `docs/referencia/plan-v2-detalle.md` §2
> ("Club", "Reglas del club", "RPC"), **con los cambios de esta hoja**, que mandan.
> Regla de oro de esta fase: **las monedas solo las suma la caja**. Nada de valor se gana visitando un link.

---

### [x] 2.1 Tablas del club
**Archivos:** `supabase/esquema.sql`, `tests/test_sql.mjs`
**Pasos:** bloque `-- ===== Fase 2 =====`. Cada tabla con las 4 partes (`AGENTS.md` §6):
1. Columnas en `negocios`: `devolucion_pct int not null default 5 check (devolucion_pct in (3,5,8))`,
   `modo_monedas text not null default 'visita' check (modo_monedas in ('visita','valor'))`,
   `monedas_por_visita int not null default 10`, `bienvenida int not null default 50`,
   `horas_entre_visitas int not null default 3`, `moneda_plural text not null default 'monedas'`,
   `moneda_singular text not null default 'moneda'`, `pin_caja_hash text`.
2. `clientes`, `membresias`, `movimientos` como en plan-v2-detalle §2 "Club", y además en `membresias`:
   `bienvenida_pendiente int not null default 0`, `ultima_visita timestamptz`, `vence timestamptz`.
   En `movimientos.tipo` agrega `'vencimiento'`. Agrega `movimientos.op_id uuid unique` (idempotencia de la caja).
3. `premios(id, negocio_id, nombre, valor_pesos int > 0, activo, orden, creado)`. El **costo en monedas se calcula**:
   `ceil(valor_pesos::numeric / _valor_moneda())`, donde `public._valor_moneda()` devuelve 100 (1 moneda = $100 de premio).
   El % de devolución actúa al **ganar** (modo valor): comprar $160.000 al 5 % = $8.000 de premio = 80 monedas.
   Escribe la fórmula y este ejemplo en `docs/DECISIONES.md`.
4. `sesiones_caja(token text pk default replace(gen_random_uuid()::text,'-',''), negocio_id, expira timestamptz not null, creado)`.
5. `intentos_pin(id bigint identity, negocio_id, ok boolean, creado)`.
**Comprobar:** [x] anon no lee ninguna de estas tablas (prueba) · [x] esquema 2 veces OK · [x] verificar ✓.

---

### [x] 2.2 RPC del cliente: registrarse y ver su tarjeta
**Archivos:** `supabase/esquema.sql`, `tests/test_sql.mjs`
**Pasos:**
1. `club_registrar(p_slug, p_nombre, p_telefono, p_acepta boolean) returns json`:
   exige `p_acepta = true` (si no: `{"error":"autorizacion"}`); normaliza teléfono (10 dígitos que empiezan por 3 → `57`+número;
   otro formato → `{"error":"telefono"}`); nombre 2–60 caracteres. Crea o reutiliza `clientes` por teléfono y crea
   `membresias` con `saldo 0` y **`bienvenida_pendiente = negocios.bienvenida`**. Si ya era miembro devuelve su token sin cambiar nada.
   Devuelve `{"token": ...}`. Solo si el negocio tiene `servicios.club = true`.
2. `club_tarjeta(p_slug, p_token) returns json`: nombre, saldo, bienvenida_pendiente, premios activos con su costo en
   monedas y `alcanzable`, el premio más cercano no alcanzable (`faltan`), últimos 10 movimientos, nombres de moneda,
   `vence`. Token inválido → `{"error":"token"}`. **Nunca** devuelve el teléfono.
3. `grant execute ... to anon, authenticated` para las dos.
**Comprobar (pruebas SQL nuevas):**
- [x] sin autorización → error y no crea filas.
- [x] registrarse dos veces con el mismo celular → 1 membresía, mismo token.
- [x] recién registrado: `saldo = 0`, `bienvenida_pendiente = 50`.
- [x] `club_tarjeta` con token de otro negocio → error.
- [x] la respuesta de `club_tarjeta` no contiene la clave `telefono`.

---

### [x] 2.3 RPC de la caja: PIN, sesión, sumar y canjear (idempotente)
**Archivos:** `supabase/esquema.sql`, `tests/test_sql.mjs`
**Pasos** (todas `security definer set search_path = public, extensions`):
1. `fijar_pin_caja(p_negocio uuid, p_pin text)` — solo admin (`es_admin()`), PIN de 4 a 6 dígitos, guarda
   `extensions.crypt(p_pin, extensions.gen_salt('bf'))`.
2. `caja_entrar(p_slug, p_pin) returns json`: si hay ≥ 10 intentos fallidos en la última hora → `{"error":"bloqueado"}`.
   Registra el intento. PIN bueno → crea `sesiones_caja` con `expira = _ahora() + 12 h` y devuelve
   `{"sesion": token, "negocio": nombre, "modo": modo_monedas, "premios": [...]}`. Malo → `{"error":"pin","quedan": n}`.
3. `_sesion_valida(p_sesion) returns uuid` (negocio_id o null). **Interna**: `revoke execute ... from public, anon, authenticated`.
4. `caja_buscar(p_sesion, p_dato)`: `p_dato` es el token de la tarjeta o el celular. Devuelve nombre, saldo,
   bienvenida_pendiente, `puede_sumar` (según `horas_entre_visitas`), última visita.
5. `caja_visita(p_sesion, p_token, p_op_id uuid, p_valor int default null)`:
   - Si ya existe un movimiento con ese `op_id` → devuelve el mismo resultado guardado, **sin sumar otra vez**.
   - Respeta `horas_entre_visitas` → `{"error":"muy_pronto","desde": hora}`.
   - Monedas: modo visita = `monedas_por_visita`; modo valor = `floor(p_valor * devolucion_pct / 100 / _valor_moneda())`.
   - Si hay `bienvenida_pendiente > 0`: la pasa al saldo con movimiento `bienvenida` y la deja en 0.
   - Actualiza `ultima_visita`, `visitas`, `vence = _ahora() + 12 months`. Todo en una transacción (una sola función).
6. `caja_canje(p_sesion, p_token, p_premio uuid, p_op_id uuid)`: idempotente igual; saldo suficiente o
   `{"error":"saldo"}`; movimiento `canje` negativo.
**Comprobar (pruebas SQL nuevas):**
- [x] 11.º intento de PIN en una hora → bloqueado aunque el PIN sea correcto.
- [x] sesión vencida (cambia `nef.ahora` a +13 h) → error.
- [x] primera visita activa la bienvenida (saldo = 50 + 10).
- [x] misma `op_id` dos veces → el saldo sube una sola vez.
- [x] segunda visita a la hora → `muy_pronto`; a las 3 h → suma.
- [x] canje sin saldo → `saldo` y no crea movimiento.
- [x] `anon` no puede ejecutar `_sesion_valida`.

---

### [x] 2.4 Pantallas del cliente: unirse, tarjeta y datos
**Archivos:** `functions/n/[slug]/club.js`, `functions/n/[slug]/datos.js`, `public/assets/club.js` (nuevos), `tests/e2e.mjs`
**Leer antes:** `docs/UI.md` filas "Registro al club", "Mis monedas", "Mi código", "Datos y términos"
**Pasos:**
1. `/n/<slug>/club` (SSR, tema del negocio): si el navegador tiene `localStorage['nef_club_<slug>']` (token),
   `club.js` pide `club_tarjeta` y muestra la tarjeta; si no, muestra el registro.
   (Supabase desde el navegador: usa `window.TOQUE` de `/api/config` y `fetch` a `/rest/v1/rpc/<fn>` con el header `apikey`.)
2. Registro: `.pt-form` + `.pt-casilla` sin marcar + enlace a `/n/<slug>/datos`. Botón deshabilitado hasta marcar.
3. Tarjeta: `.pt-saldo` con `--progreso`; si hay bienvenida pendiente, el único aviso es
   `.pt-aviso.neutro` "Tus N de bienvenida se activan en tu primera visita". "Mostrar mi código" abre `.pt-hoja`
   con el QR del token (`/assets/qrcode.js`, ≥ 240 px) y "Muéstraselo al cajero".
4. `/n/<slug>/datos`: política de datos (Ley 1581: responsable = el negocio, encargado = Mamut Herd, finalidad,
   derechos, cómo pedir borrado) + condiciones del club (cómo se gana, valor de premios, vencimiento 12 meses — Ley 1480).
   Marca arriba: "Plantilla — revisar con abogado".
**Comprobar:**
- [x] e2e: registrarse (390×844) → tarjeta con 0 y aviso de bienvenida pendiente; captura `club-tarjeta.png`.
- [x] e2e: recargar la página → sigue mostrando la tarjeta (token guardado).
- [x] verificar --e2e ✓.

---

### [x] 2.5 Caja con PIN y sin conexión
**Archivos:** `functions/caja/[slug].js`, `public/assets/caja.js` (nuevos), `tests/e2e.mjs`
**Leer antes:** `docs/UI.md` sección "Caja"
**Pasos:**
1. SSR mínimo con el tema del negocio; `caja.js` hace todo lo demás.
2. PIN → `caja_entrar` → guarda la sesión en `localStorage['nef_caja_<slug>']` con su expiración.
3. Buscar por número (`inputmode="tel"`) o "Escanear su código" (usa `BarcodeDetector` si existe; si no, oculta el botón).
4. Ficha: `.pt-cliente` + `.pt-dos`. En modo valor, Sumar pide primero el valor de la compra.
5. **Sin conexión:** cada operación tiene `op_id = crypto.randomUUID()`. Si el `fetch` falla, guárdala en IndexedDB
   (base `nef_caja`, almacén `cola`), muestra `.pt-toast` "Guardado, se enviará al volver la conexión" y
   `.pt-sin-conexion` con el número pendiente. Al volver (`online` o cada 15 s) reenvía en orden y borra de la cola
   solo lo que respondió OK. Como la RPC es idempotente, reenviar nunca suma doble.
**Comprobar:**
- [x] e2e: PIN malo → mensaje con intentos; PIN bueno → buscar al cliente registrado en 2.4 → Sumar → saldo 60.
- [x] e2e: con un **segundo cliente** registrado en la misma prueba (para no chocar con `horas_entre_visitas`):
      `context.setOffline(true)` → Sumar → aparece "Guardado…" → `setOffline(false)` → la cola se vacía y su saldo
      subió **una** sola vez.
- [x] Capturas `caja-ficha.png` y `caja-sin-conexion.png` revisadas. verificar --e2e ✓.

---

### [x] 2.6 Admin: PIN, devolución y premios
**Archivos:** `public/admin.html`, `tests/e2e.mjs`
**Pasos:** en el negocio: campo PIN (llama `fijar_pin_caja`), `.n-opciones` devolución 3/5/8 %, modo visita/valor,
monedas por visita, bienvenida; lista de premios (nombre, valor en pesos, activo) y al lado el costo en monedas calculado.
**Comprobar:** [x] e2e: crear premio de $8.000 → se ve "80 monedas" en la tarjeta del cliente · [x] verificar --e2e ✓.

---

### [x] 2.7 Cierre de la fase 2
**Comprobar:** [x] Criterios de la Fase 2 de `docs/PLAN.md` cumplidos · [x] el botón de reseña no suma nada (prueba SQL: no existe
ninguna RPC pública que cree movimientos) · [x] PROGRESO.md · [ ] `git push origin desarrollo` (sin remoto).
