# Bitácora de decisiones

Formato: fecha · decisión · por qué. Las más recientes arriba.

- 2026-11-22 · **Festivos 2026 y 2027 — REVISAR** contra el calendario oficial. Los calculé con la Ley Emiliani (Pascua 5 abr 2026 y 28 mar 2027). 2026: 1 ene, 12 ene, 23 mar, 2 y 3 abr, 1 may, 18 may, 8 jun, 15 jun, 29 jun, 20 jul, 7 ago, 17 ago, 12 oct, 2 nov, 16 nov, 8 dic, 25 dic. 2027: 1 ene, 11 ene, 22 mar, 25 y 26 mar, 1 may, 10 may, 31 may, 7 jun, 5 jul, 20 jul, 7 ago, 16 ago, 18 oct, 1 nov, 15 nov, 8 dic, 25 dic. · No pude consultar la fuente oficial sin conexión; la tarjeta 3.1 pide anotarlo.
- 2026-11-22 · Las métricas se calculan **una sola vez** sobre `_visitas(negocio)`: si el negocio tiene entradas (importadas o NFC) usa las entradas; si no, las visitas registradas en la caja. Así café y gimnasio comparten "activos", "en riesgo", "racha" y "horas pico". · PRODUCTO §5: café = visitas de caja, gimnasio = entradas importadas; la regla depende de los datos, no del sector.
- 2026-11-22 · "Activos al inicio del mes" (abandono mensual) = personas con ≥ 1 visita en los 14 días anteriores al día 1. Si el mes no ha terminado, "no registran visitas en todo el mes" se mide hasta la fecha consultada. · Es la definición de "activos" de PRODUCTO §8 aplicada al día 1.
- 2026-11-22 · Racha: semanas seguidas (lunes a domingo, Bogotá) con ≥ 1 visita; si la semana actual aún no tiene visita, se cuenta desde la anterior (la racha sigue viva hasta el domingo). · Que el lunes por la mañana nadie "pierda" su racha.
- 2026-11-22 · El umbral de "en riesgo" por sector vive en `lib/sectores/*.json` y su espejo en SQL (`_sector_en_riesgo_dias`); una prueba compara los dos. `negocios.en_riesgo_dias` lo cambia por negocio. · El cálculo nocturno corre en SQL y no puede leer el JSON.
- 2026-11-22 · Importador: el navegador convierte cada fecha a "AAAA-MM-DD HH:MM" (hora de Bogotá) con `public/assets/csv.js`; lo que no entienda llega vacío y la RPC lo cuenta como inválido. El último mapeo se guarda en `negocios.mapeo_csv` y se reutiliza si las columnas existen. · "Nunca adivinar" (tarjeta 3.6).
- 2026-11-22 · `stats_admin`/`stats_token` ahora traen un bloque `gimnasio`. El admin ve la lista "En riesgo" con teléfonos; el link del dueño solo ve el conteo. El botón de WhatsApp lleva un mensaje amable sin promociones y solo aparece en horario legal; si no, "Disponible el lunes a las 7:00 a. m.". · Ley 2300 y PRODUCTO §9.
- 2026-11-22 · Catálogo: tablas `categorias` y `productos` (tipo plato/clase/máquina/servicio, `video_url`, `pasos` ≤ 3, `horario` con día 0 = domingo). En el admin, pestaña "Catálogo" para máquinas y clases; la carta del café con fotos y agotados se completa en la Fase 5. · Un solo catálogo para los dos sectores.
- 2026-11-22 · Entrada por NFC: usa el token del club guardado en el celular del socio; crea el socio `club:<membresía>` la primera vez; máximo 1 entrada por día; nunca suma monedas. · PRODUCTO §9 regla 6 y ARQUITECTURA §5.

- 2026-11-22 · **Valor de la moneda**: `valor_moneda() = 100` → 1 moneda = $100 en premios. Costo de un premio = `ceil(valor_pesos / 100)` ($8.000 = 80 monedas). Modo valor: monedas = `floor(compra × devolucion_pct / 100 / 100)` → compra de $160.000 al 5 % = $8.000 de premio = **80 monedas**. · Tarjeta 2.1; así el dueño piensa en pesos y Nef calcula las monedas.
- 2026-11-22 · Idempotencia de la caja con la tabla de hechos `operaciones_caja` (op_id → resultado guardado) además de `movimientos.op_id unique`. Reenviar el mismo op_id devuelve exactamente el mismo resultado. · Una visita puede crear dos movimientos (visita + bienvenida); el resultado completo debe repetirse igual.
- 2026-11-22 · `club_registrar` con un celular ya inscrito solo devuelve el token si el **primer nombre coincide**; si no, `ya_registrado`. · Si bastara el celular, cualquiera que sepa tu número vería tu tarjeta. "¿Cambiaste de celular?" con código por WhatsApp queda para después.
- 2026-11-22 · `club_tarjeta` no escribe: si las monedas vencieron, las muestra en 0. El movimiento `vencimiento` lo registran la caja (al buscar/sumar/canjear) y `vencer_monedas()` (cálculo nocturno, Fase 4). · Así ninguna RPC pública sin sesión crea movimientos (hay prueba que lo verifica).
- 2026-11-22 · La página `/n/<slug>/datos` muestra arriba "Plantilla — revisar con abogado" (lo pide la tarjeta 2.4). **Quitarlo cuando el abogado la apruebe.**
- 2026-11-22 · Componentes nuevos de portal.css: `.pt-qr` (QR sobre blanco, legible en tema oscuro), `.pt-texto` (política y condiciones), `.pt-caja-titulo`. En `componentes.html`.
- 2026-11-22 · Lo compartido de las páginas de portal (cabeza con tema y color, firma, íconos) vive en `lib/portal.js`; el navegador llama a Supabase con `public/assets/nef-rpc.js`. · Club, datos, caja y portal usan la misma cabeza.
- 2026-11-22 · Caja: si la red falla, la operación queda en IndexedDB (`nef_caja`/`cola`) y se reenvía al volver (`online` o cada 15 s). Una respuesta con error definitivo (ej. `muy_pronto`) también saca la operación de la cola y se avisa con un toast. · Reintentar algo que el servidor ya rechazó no tiene sentido.
- 2026-11-22 · El club por empresa (`empresas.club_compartido`) aún no cambia el saldo: las membresías son por sede. · Ningún cliente lo necesita todavía; se hará cuando llegue un gimnasio con varias sedes.
- 2026-11-22 · Entorno local: todo lo instalado y temporal va a D (`D:\.cache` para npm y Playwright; `d:\Nef provisional\_local` para logs, temporales y la demo). La demo de Jacobo corre en `localhost:4000` con su propio mock (`MOCK_PORT=54322`) y su propio estado de wrangler (`--persist-to`). · Pedido de Jacobo: nada en el disco C.

- 2026-11-21 · Sin repositorio remoto ni Cloudflare: se trabaja en local, con git en la rama `desarrollo` y un commit por fase; el push queda pendiente hasta que exista el remoto. · Pedido de Jacobo: "no hay repo, no hay vercel, todo en local".
- 2026-11-21 · `resolver_toque` (ahora con `p_dispositivo_id`) y `negocio_publico` se definen en el bloque Fase 1 del esquema, no en el v1. · `negocio_publico` es SQL y lee columnas que se crean en la Fase 1; definirla antes rompe el esquema en una base vacía.
- 2026-11-21 · RPC pública nueva `tag_publico(slug, codigo)`: solo el nombre del tag ("Mesa 4") si es de ese negocio. · La cabeza del portal muestra el lugar; los nombres de tag no son privados.
- 2026-11-21 · Cada botón del paquete de sector puede declarar `requiere` (ej. `resena_url`, `menu_url`): si el negocio no tiene ese dato, el botón no sale. · Generaliza la regla de la reseña sin escribir lógica de sector en el motor; evita un "Ver la carta" que no lleva a ninguna parte.
- 2026-11-21 · Si el negocio tiene link de carta pero no contrató Catálogo, la carta sale como enlace de texto ("Carta"/"Clases", palabra del paquete). · Los negocios de la Fase 0 ya tenían su carta en el portal; no se la quitamos.
- 2026-11-21 · Color `#1f1f1f` (el valor por defecto) = "sin color propio": el portal usa el acento del tema del sector. · Un gimnasio sin color quedaría con botones negros sobre fondo negro.
- 2026-11-21 · WiFi del portal: enlace de texto que abre una hoja inferior (`<details>` + `.pt-hoja`) con "Copiar clave". Componentes nuevos: `.pt-dato` y `summary` en `.pt-enlaces` (portal.css); `.n-entrar`, `.n-herramientas`, `.n-codigo` (nef-ui.css). Todos en componentes.html. · Lo pide la tarjeta 1.4 y la prueba vieja `#wifi summary` sigue sirviendo.
- 2026-11-21 · Los JSON de sector se importan con `with { type: 'json' }`. · Lo aceptan Node 22 (pruebas) y el esbuild de wrangler 4; no hizo falta pasarlos a .js.
- 2026-11-21 · Destinos de tag nuevos (`catalogo`, `club`, `producto`) se agregan con su fase (2 y 3), cuando existan sus pantallas. · Un destino sin pantalla sería un botón roto.
- 2026-11-21 · `tests/e2e.mjs` guarda capturas con `fileURLToPath` en vez de `URL.pathname`. · En Windows la ruta salía como `/d:/Nef%20provisional/...` y fallaba.

- 2026-11-19 · Cuentas: empresa → sedes; accesos por empresa; caja con sesión corta por PIN. · Gimnasios y cadenas con varias sedes; un dueño no ve otras empresas.
- 2026-11-19 · BD por capas: configuración, personas, hechos (solo se agregan) y resúmenes diarios. · Paneles rápidos con muchos clientes y datos confiables para el estudio.
- 2026-11-19 · Portales públicos; "nada que dé valor se gana visitando un link"; bienvenida pendiente hasta la primera visita. · Alguien puede escribir la dirección de otro negocio; no debe poder sacar nada.
- 2026-11-19 · Git: Claude Code hace push a la rama `desarrollo`; solo Jacobo pasa a `main`. · Cloudflare publica a producción lo que llega a `main`.
- 2026-11-19 · Nombre provisional **Nef** (reemplaza "Sello"). · Corto, viene de NFC, sirve para cualquier sector; lo propuso Jacobo.
- 2026-11-19 · Gimnasios con torniquete: entradas importadas (CSV) en vez de registro NFC. · Su sistema de acceso ya registra cada entrada; duplicarla no aporta.
- 2026-11-19 · Nef no maneja pagos; la caja funciona sin conexión. · No competir con su caja; locales con mala señal.
- 2026-11-19 · Estadísticas en dos niveles: panel automático y estudio trimestral en R. · Diferencial de Jacobo (matemático).
- 2026-11-19 · Nombre provisional **Sello** (reemplaza "Sobremesa", que era solo de restaurantes). Sale de `MARCA`. · El producto es multisector; "Sello" sirve para cualquier negocio y es el punto donde se acerca el celular.
- 2026-11-19 · Producto versátil desde el inicio: motor común + paquetes por sector (JSON) + servicios activables (Base, Catálogo, Club, Red). · Vender a gimnasios y cafés a la vez sin rehacer código.
- 2026-11-19 · Diseño simple: máximo 3 botones en el portal, un aviso a la vez, sin chips ni insignias a la vista. · La primera maqueta se sintió saturada.
- 2026-11-19 · El dueño configura % de devolución (3/5/8) y el valor de los premios en pesos; monedas vencen tras 12 meses sin visitas. · Que el dueño sepa cuánto le cuesta el club.
- 2026-11-19 · Orden de construcción 0.5 → 3 → G → 1 → 2 → 4. · El primer cliente probable es un gimnasio.
- 2026-11-19 · AR queda como "próximamente". · Lo costoso son las fotos; las hará la hermana de Jacobo cuando un cliente lo pague.
- 2026-11-19 · Sistema visual aprobado en `docs/DISENO.md` + maqueta. · Que Claude Code no improvise estilos.
- 2026-11-17 · Las monedas se llaman "monedas" por defecto y el nombre es editable por negocio (singular y plural). · Cada negocio puede tematizarlas (granos, panes…) sin tocar código.
- 2026-11-17 · Club con monedas canjeables en catálogo, no tarjeta de sellos fija. · Menos rígido; el cliente decide cuándo canjear, y el nivel usa el total ganado para que canjear no castigue.
- 2026-11-17 · La ruleta solo sugiere platos; el bono de ruleta es fijo y lo confirma la caja. · El azar no puede decidir premios sin autorización de Coljuegos.
- 2026-11-17 · Reseñas de Google nunca dan monedas. · Política de Google prohíbe incentivos por reseñas.
- 2026-11-16 · Cloudflare Pages en vez de Vercel. · El plan gratis de Cloudflare permite uso comercial.
- 2026-11-20 · El proyecto lo puede construir Claude u otro modelo: `AGENTS.md` + tarjetas + `npm run verificar`. · Jacobo puede quedarse sin tokens de Claude; las guardas evitan que un modelo más débil dañe el proyecto.
- 2026-11-20 · Componentes de interfaz cerrados (`portal.css`, `nef-ui.css`) y prohibido inventar estilos. · Que cualquier modelo produzca pantallas iguales a la maqueta.
- 2026-11-20 · Landing con precios "Te lo cotizamos" hasta definirlos; "Tócalo tú" oculto hasta que exista la demo. · No mostrar cifras inventadas ni botones rotos.
