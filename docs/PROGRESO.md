# Progreso

Bitácora de sesiones. Claude Code agrega una entrada al cerrar cada sesión (`/cerrar-sesion`).
Formato: fecha · fase · qué quedó hecho · pruebas · qué sigue · pendientes/pedidos sin hacer.

## 2026-11-19 · Fase 0 (hecha en Claude.ai)
- Hecho: links dinámicos `/t/`, registro de toques NFC/QR, página del negocio, clics, `/inactivo`,
  panel `/admin` (negocios, tags por lotes, impresión de QR, estadísticas), `/stats?k=` para el dueño.
- Pruebas: `test:sql` 10 OK · `test:e2e` 9 OK.
- Primera maqueta descartada por saturada; aprobada la **dirección simple** (`docs/DISENO.md`, `docs/diseno/maqueta.png`).
- Producto **versátil**: motor común + paquetes por sector (café, gimnasio, servicios) + servicios activables.
- Nombre provisional: **Sello**. Kit impreso en `docs/kit/`, kit de ventas en `docs/ventas/`.
- Sigue: Fase 0.5 de `docs/ROADMAP.md` (motor versátil + diseño simple). Orden: 0.5 → 3 → G → 1 → 2 → 4.

## 2026-11-19 (tarde) · Definición final antes de la jornada de Claude Code
- Nombre provisional **Nef**; identidad en `docs/marca/` (tablero, logos, fuentes).
- Producto consolidado en `docs/PRODUCTO.md`; plan del día en `docs/PLAN.md` (Fases 1 → 8).
- Gimnasios: la entrada **se importa** de su sistema (torniquete/huella), no se registra con NFC.
- Estadísticas definidas (nivel 1 automático, nivel 2 estudio en R). Caja sin conexión.
- Sigue: Fase 1 de `docs/PLAN.md`.

## 2026-11-20 · Listo para cualquier modelo + landing (hecho en Claude.ai)
- **Landing `/` hecha** (`public/index.html`): las 8 secciones de `GUIA-WEB.md`, celular primero, precios en un
  objeto `PRECIOS` (hoy "Te lo cotizamos"), WhatsApp desde `CONTACTO_WHATSAPP`, "Tócalo tú" aparece solo cuando
  exista `/n/demo-cafe` (Fase 7). Pendiente de Jacobo: foto real del sticker para la portada.
- **Interfaz armada**: `public/assets/portal.css` (portales y caja, 3 temas) y `nef-ui.css` (admin/panel),
  catálogo visual en `docs/diseno/componentes.html/.png`, reglas y pantalla por pantalla en `docs/UI.md`.
- **Modo para cualquier modelo**: `AGENTS.md` (+ `GEMINI.md`), tarjetas en `docs/tareas/` (fases 1–8),
  verificador `npm run verificar` (secretos, dependencias, SQL idempotente, RLS, search_path, pruebas que no bajan,
  rama). Guía para Jacobo: `docs/ARRANCAR-CON-OTRO-MODELO.md`.
- Assets copiados a `public/assets/` (tokens, fuentes, logos, capturas en WebP).
- Pruebas: test:sql 10 OK · test:e2e 10 OK (nuevo caso de la landing) · verificar OK.
- Sigue: tarjeta 1.1 de `docs/tareas/fase-1.md`.

## 2026-11-21 · Jornada de Claude Code en local (sin repo remoto ni Cloudflare)
Plan: Fase 1 → 2 → 3 → 4… según `docs/PLAN.md`. Todo en local: `git init` con rama `desarrollo`, mock de Supabase
(`npm run mock`) + `wrangler pages dev` (`npm run dev`). Cada fase cierra con `npm run verificar -- --e2e` en verde.

### Fase 1 · Cimientos — hecha
- **BD**: `_ahora()`, tablas `empresas` y `accesos` (RLS + política admin), `negocios.empresa_id/sector/servicios/ubicacion_etiqueta`,
  migración que crea una empresa por negocio. `negocio_publico` trae sector/servicios/ubicación. RPC nueva `tag_publico`.
- **Antispam**: cookie anónima `nef_d` en `/t/` (HttpOnly, 1 año); `resolver_toque` ignora el mismo dispositivo+tag por 30 min.
- **Paquetes de sector**: `lib/sectores/cafe.json`, `gimnasio.json` y `lib/sectores.js` (`paquete`, `botonesPortal`).
- **Portal** `/n/<slug>` rehecho con `portal.css`: tema por sector, máx. 3 botones según servicios, enlaces de texto,
  WiFi en hoja inferior, firma "Hecho con nef".
- **/inactivo** y **/admin** con la marca Nef; el admin elige sector, servicios (Catálogo, Club, Estudio) y ubicación.
- Pruebas: test:sql **17 OK** (7 nuevas) · test:e2e **15 OK** (5 nuevas) · verificar ✓.
- Capturas revisadas (390×844 y 1280): `portal-cafe-movil.png`, `portal-gym-movil.png`, `portal-cafe-wifi.png`,
  `portal-cafe-escritorio.png`, `inactivo-movil.png`, `admin-escritorio.png`, `admin-negocio-form.png`, `admin-movil.png`.
- Revisión de seguridad: tablas nuevas con RLS y prueba de anon; RPC con `search_path`; nada privado en RPC públicas;
  todo escapado; la cookie no guarda IP ni datos personales.
- Pendiente: `git push origin desarrollo` (no existe el remoto). Aviso viejo del verificador en `stats.js` (innerHTML): se rehace en la Fase 4.

### Fase 2 · Club de monedas + caja sin conexión — hecha
- **BD**: reglas del club en `negocios` (devolución 3/5/8, modo visita/valor, monedas por visita, bienvenida, horas entre visitas,
  nombres de moneda, `pin_caja_hash`); tablas `clientes`, `membresias`, `premios`, `movimientos`, `operaciones_caja`,
  `sesiones_caja`, `intentos_pin` (todas con RLS). Destino de tag `club`.
- **RPC**: `club_publico`, `club_registrar` (bienvenida pendiente), `club_tarjeta` (sin teléfono), `fijar_pin_caja` (solo admin),
  `caja_entrar` (bloqueo 10/hora, sesión 12 h), `caja_buscar`, `caja_visita` y `caja_canje` (idempotentes por `op_id`),
  vencimiento a 12 meses (`_vencer_membresia`, `vencer_monedas`).
- **Pantallas**: `/n/<slug>/club` (inscripción → tarjeta con anillo, un aviso, "Mostrar mi código" con QR, premios),
  `/n/<slug>/datos` (Ley 1581 + Ley 1480, plantilla), `/caja/<slug>` (PIN → número → Sumar/Canjear, cola sin conexión en IndexedDB),
  admin con club, PIN y premios (costo en monedas calculado).
- Pruebas: test:sql **37 OK** (20 nuevas) · test:e2e **19 OK** (4 nuevas, incluida la caja con la red cortada) · verificar ✓.
- Capturas revisadas: `club-registro.png`, `club-tarjeta.png`, `club-codigo.png`, `club-datos.png`, `caja-ficha.png`,
  `caja-sin-conexion.png`, `admin-club-premios.png`.
- Seguridad: tablas con RLS y prueba de anon; PIN con bcrypt y nunca expuesto; teléfono nunca en tarjeta ni caja; internas con
  `revoke`; prueba de que ninguna RPC pública crea monedas salvo la caja con sesión.
- Pendiente: "¿Cambiaste de celular?" (recuperar la tarjeta) no está; hoy se recupera inscribiéndose otra vez con el mismo nombre.

### 2026-11-22 · Repositorio
- Jacobo creó el repo: `https://github.com/nefmamutherd-ai/Nef.git`. Rama `desarrollo` subida (base + fases 1 y 2). No hay `main` todavía: Jacobo hace el merge.
- Entorno local: todo lo temporal en D (`d:\Nef provisional\_local`); demo para mirar en `http://localhost:4000` (admin con cualquier correo y `clave123`, PIN de caja `1234`).

### Fase 3 · Paquete gimnasio — hecha
- **BD**: `socios`, `entradas`, `importaciones`, `festivos` (2026–2027, revisar), `categorias`, `productos` (máquina/clase/plato/servicio),
  `negocios.mapeo_csv/en_riesgo_dias`, tags con destinos `producto` y `entrada` (+ `producto_id`).
- **RPC**: `importar_entradas` (no duplica, cuenta inválidas), métricas `metrica_activos`, `metrica_abandono_mensual`, `metrica_en_riesgo`,
  `metrica_horas_pico`, `metrica_racha` (internas), `puede_escribir` y `proxima_hora_permitida` (Ley 2300), `producto_publico`, `clases_hoy`,
  `maquinas_publicas`, `registrar_entrada_nfc`. `stats_admin`/`stats_token` con bloque `gimnasio`.
- **Datos de prueba**: `tests/fixtures/generar_entradas.mjs` (LCG semilla 42) → `entradas.csv`, 200 socios, 5.780 entradas; los valores
  esperados están en el encabezado y las pruebas SQL los verifican exactos (160 activos, 40 en riesgo, abandono oct 60/180, rachas, horas pico).
- **Pantallas**: `/n/<slug>/p/<id>` (ficha de máquina: video sin autoplay, YouTube con nocookie, 3 pasos), `/n/<slug>/clases` (clases de hoy),
  `/n/<slug>/entrada` (check + racha de 8 semanas), admin: pestañas **Entradas** (importador CSV) y **Catálogo**, "En riesgo" en Estadísticas.
- Pruebas: test:sql **48 OK** (11 nuevas) · test:e2e **24 OK** (5 nuevas) · verificar ✓.
- Capturas revisadas: `admin-importar.png`, `admin-importar-ok.png`, `admin-en-riesgo.png`, `admin-catalogo.png`, `maquina-ficha.png`,
  `clases-hoy.png`, `entrada-movil.png`. Bug encontrado y arreglado: los enlaces `a.pt-accion` heredaban el color del texto (botón vacío en tema oscuro); hay prueba.
- Seguridad: tablas nuevas con RLS (prueba de anon), métricas internas con `revoke`, teléfonos solo en `stats_admin`, importar solo admin.
