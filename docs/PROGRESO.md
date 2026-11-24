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

### Fase 4 · Estadísticas nivel 1 + soporte del estudio — hecha
- **BD**: `metricas_diarias` + métricas que faltaban (`metrica_visitas_portal`, `_clics_resena`, `_inscritos`, `_visitas`, `_frecuencia`,
  `_retorno_30`, `_recencia`, `_devolucion_real`, `_uso_maquinas`), `_metricas_dia`, `recalcular_metricas`, `recalcular_todo`,
  `admin_recalcular`, `_nivel1` (guardado + hoy en vivo), `exportar_estudio` (anónimo), `informes` + `informe_ruta`/`informe_existe`.
- `supabase/cron.sql` (pg_cron 2:00 a. m. Bogotá; se corre a mano) y `supabase/storage.sql` (bucket privado `informes`).
- **Pantallas**: `stats.js` rehecho con `nef-ui.css` (cada número con su "?" y la definición exacta; qué números ve cada sector sale del paquete),
  `/stats?k=` rehecho con la marca Nef + "Informes del estudio", admin con "Exportar para el estudio", "Recalcular" y subida de PDF.
  `/api/informe` (URL firmada de 1 hora) y `/api/sectores`.
- **Estudio**: `docs/ESTUDIO.md` (secciones, prueba por pregunta, mínimos de datos) y `estudio/plantilla.R` (probado con R 4.6.1).
- Pruebas: test:sql **54 OK** (6 nuevas) · test:e2e **29 OK** (5 nuevas) · verificar ✓ (y sin avisos).
- Capturas revisadas: `stats-dueno-movil.png`, `stats-dueno-escritorio.png`, `admin-estudio.png`.
- Seguridad: anon no lee `metricas_diarias` ni llama recalcular/exportar/métricas (prueba); la exportación no trae nombres ni teléfonos
  (prueba SQL y e2e sobre los archivos descargados); un token de otro negocio no abre el informe (prueba SQL y e2e).
- Para Jacobo: correr `supabase/cron.sql` y `supabase/storage.sql` en Supabase después de `esquema.sql`.

### Fase 5 · Carta del café + "Elige por mí" — hecha
- **BD**: `eventos_carta`, etiquetas permitidas en `productos`, `carta_publica` (una llamada, destacados primero, agotados al final),
  `registrar_evento_carta`, `negocio_publico.tiene_carta`. Bucket público `fotos` en `storage.sql`.
- **Pantallas**: `/n/<slug>/carta` (SSR: barra con "Elige por mí", pestañas que siguen el scroll, platos con foto, agotado en gris,
  hoja de detalle), "Elige por mí" (antojos → resultado decidido antes → rollo ≤ 2,2 s → "Lo pido"/"Otra vez").
  Admin › Catálogo: categorías, plato con foto (WebP 1000×1000 en el navegador), etiquetas, destacado y "Agotado hoy" de un toque.
- Pruebas: test:sql **58 OK** (4 nuevas, incluida la de 10.000 tiradas con semilla) · test:e2e **32 OK** (3 nuevas) · verificar ✓.
- Capturas revisadas: `carta-movil.png`, `carta-detalle.png`, `elige-por-mi.png`, `admin-plato.png`, `admin-carta.png`.
- Seguridad: anon no lee `eventos_carta`; el evento ignora productos de otro negocio; girar no crea movimientos (e2e lo verifica).

### Fase 6 · Hora dorada, racha y niveles — hecha
- Hora dorada (franjas por negocio, monedas × 2), racha semanal con comodín y bono a las 4 semanas, niveles por total ganado,
  un solo aviso en la tarjeta (prioridad bienvenida → hora dorada → premio → racha → te faltan). Ver commit `3229012`.

### 2026-11-23 · Diseño (pedido de Jacobo) + investigación de competencia
- Portal, carta y club con estilo de carta impresa (no "estilo IA"); "Elige por mí" como tragamonedas; landing con más movimiento,
  también con "reducir movimiento" activo (decisión de Jacobo).
- Competencia investigada en `docs/COMPETENCIA.md`. Aplicado: carrusel **"Lo más pedido"** con fotos grandes (`carta_populares`),
  **camino de premios** en el club (cada premio es una parada), **pieles por negocio** (`negocios.tema`: cálido, limpio, noche, energía;
  nueva piel "noche"), elegibles en el admin ("Estilo del portal").
- Fotos de los 12 platos de la demo: renders 3D en Blender (Cycles), script en `scripts/platos_blender.py`, WebP 600×600 en
  `public/assets/demo/`. Las ilustraciones SVG quedan de respaldo. Croissant, natas y changua son los renders más flojos.

### Fase 7 · Vender y cobrar — hecha
- **Demo**: `supabase/demo.sql` (demo-cafe y demo-gym); "Tócalo tú" aparece solo si existe la demo (e2e).
- **Mensualidades**: `empresas.vence`, `dias_gracia` (5 por defecto), `_negocio_habilitado` (vencido + gracia → `resolver_toque` y
  `negocio_publico` dan inactivo), `mensualidades_admin`, `registrar_pago` (suma meses; si estaba vencido, desde hoy).
  Todo negocio nuevo recibe su empresa (trigger). Admin › **Mensualidades**: pagado hasta, gracia, estado y "Registrar pago · 1 mes".
- **Legal**: `docs/legal/` (términos del club, política de datos, contrato de transmisión, contrato de servicio), marcadas
  "PLANTILLA — revisar con abogado".
- Pruebas: test:sql **70 OK** · test:e2e **34 OK** · verificar ✓.
- Capturas revisadas: `panel_mensualidades.png`, carta con "Lo más pedido", club con camino de premios, piel noche.
- Seguridad: anon no llama `registrar_pago` ni `mensualidades_admin`; un logueado que no es admin recibe "no autorizado";
  `_negocio_habilitado` y `_estado_pago` revocadas al público.

### Fase 8 · Panel del dueño — hecha
- **Acceso por empresa**: tabla `accesos` (usuario ↔ empresa, rol dueño/gerente), `es_mi_negocio(p_negocio)` y políticas
  `dueno_*` en productos, categorías y premios (leer/escribir), tags e informes (solo leer), empresas y accesos (solo lo suyo).
  La tabla `negocios` **no** se abre al dueño (tiene notas, token y hash del PIN): la ve por `panel_negocios()`.
  `stats_dueno` (con "en riesgo" y teléfonos, porque son sus clientes), `fijar_pin_caja`, `importar_entradas` y `admin_recalcular`
  aceptan admin o dueño de ese negocio. Membresías y clientes siguen cerrados (los ve solo por las estadísticas).
- **Admin por correo**: `admins_correos`; al **confirmar** la cuenta con un correo de la lista, queda como admin (trigger).
- **`/panel`**: crear cuenta / entrar, "tu cuenta está lista" mientras no tenga acceso, selector de sede (solo con 2+ sedes),
  pestañas Resumen, Clientes (en riesgo + importar entradas si es gimnasio), Catálogo, Club (premios, devolución real, PIN) e
  Informes (PDF con URL firmada de 1 hora). Módulos compartidos con el admin en `public/assets/panel/`.
- **Admin › Dueños**: dar acceso por correo (la persona primero crea su cuenta en /panel) y quitarlo.
- **`/stats?k=`** sigue funcionando y muestra "Ahora entras por /panel". Interruptor `links_stats_viejos` (ver DECISIONES).
- Guía para grabar chips: `docs/kit/GRABAR-NFC.md`.
- Pruebas: test:sql **81 OK** (11 de aislamiento, una por tabla) · test:e2e **39 OK** (dos dueños en dos navegadores, también
  por la API con la sesión de cada uno) · verificar ✓. El e2e ahora guarda `tests/capturas/fallo-*.png` si un caso falla.
- Capturas revisadas: `panel_dueno_resumen_movil.png`, `panel_dueno_catalogo_movil.png`, `panel_dueno_club_movil.png`
  (premios pasaron de tabla a lista: en 390 px no se leían), `panel_dueno_sin_acceso_movil.png`, `panel_admin_duenos.png`.
- Pendiente: aplicar `supabase/esquema.sql` completo en el Supabase real (necesita la contraseña de la BD que da Jacobo).
- Pedidos de Jacobo para después: tarjeta del club más llamativa (las 50 monedas de bienvenida no se notaron), QR de compra
  desde la caja (productos → monedas), mejorar los renders de croissant, natas y changua, realidad aumentada de platos.
