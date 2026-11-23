# Plan de construcción — para trabajar solo todo el día

> **Qué** se construye: `docs/PRODUCTO.md`. **Cómo se ve**: `docs/DISENO.md` (portales) y
> `docs/marca/MARCA.md` (superficies de Nef). Detalle técnico de tablas y RPC del club:
> `docs/referencia/plan-v2-detalle.md` §2 (si contradice este archivo o PRODUCTO.md, ganan ellos).

> **Paso a paso:** cada fase está partida en tarjetas en `docs/tareas/` (con archivos, pasos y comprobaciones).
> Claude puede trabajar por fases; cualquier otro modelo trabaja tarjeta por tarjeta (`AGENTS.md`).
> Antes de cada commit: `npm run verificar`.

## Reglas de la jornada
1. Trabaja **fase por fase en este orden**. Cada fase: construir → pruebas (`test:sql` + `test:e2e`)
   → capturas → `/revisar-seguridad` → commit `fase N: …` → entrada en `docs/PROGRESO.md`.
2. **No preguntes.** Si algo es ambiguo, toma la opción más simple que cumpla PRODUCTO.md, anótala en
   `docs/DECISIONES.md` y sigue.
3. **Si te bloqueas** (algo externo, una prueba imposible de arreglar en 30 min), anótalo en
   `docs/PROGRESO.md` como BLOQUEO con lo que intentaste, y pasa a la siguiente tarea que no dependa de eso.
4. Git: rama `desarrollo`, `git push origin desarrollo` al cerrar cada fase. Nunca a `main`, nunca `--force`,
   nunca desplegar a mano, borrar datos de producción ni tocar `.dev.vars` con llaves reales.
5. Al terminar el día (o la última fase posible): `/cerrar-sesion` con un resumen para Jacobo: qué quedó,
   qué falta, qué decidiste por él y qué necesita que él haga.

---

## Fase 1 — Cimientos: marca, motor versátil y diseño simple
**Construir**
- ~~Copiar tokens, fuentes y logos a `public/assets/`~~ **hecho** (más `portal.css` y `nef-ui.css`).
- `lib/sectores/cafe.json`, `gimnasio.json`, `servicios.json`: textos, botones del portal por servicio,
  tema (`calido`/`energia`/`limpio`), regla de monedas (`visita`/`valor`/`asistencia`), palabras
  (mesa/recepción, carta/clases, plato/máquina).
- Cuentas (ver `docs/ARQUITECTURA.md` §2): tablas `empresas`, `accesos`; `negocios.empresa_id` (migrar los
  negocios actuales creando una empresa por cada uno). Columnas en `negocios`: `sector`, `servicios jsonb`
  (base, catalogo, club, estudio → bool), `ubicacion_etiqueta`.
- Antispam de estadísticas: cookie anónima `nef_d` (uuid) en `/t/`; un toque por dispositivo y tag cada 30 min
  (`toques.dispositivo_id`, ignorar repetidos en la RPC). Tags: destinos nuevos `catalogo`, `club`, `producto` (con `producto_id`).
- Portal `/n/<slug>` rehecho según `docs/diseno/maqueta.png`: tema por sector, máximo 3 botones según
  servicios activos, enlaces de texto, firma "Hecho con nef" (logo una tinta).
- ~~Landing `/`~~ **hecha** (20 nov, `public/index.html`, 8 secciones de GUIA-WEB). `/inactivo` con la marca Nef.
- Panel `/admin` con la marca Nef: elegir sector y servicios por negocio.
**Listo cuando**
- [x] El mismo negocio de prueba cambiado de café a gimnasio cambia botones, textos y tema sin tocar código.
- [x] Capturas móvil del portal café y gimnasio comparables con la maqueta.
- [x] Pruebas de antes siguen en verde.

## Fase 2 — Club base + caja (sin conexión)
**Construir** (tablas y reglas en `referencia/plan-v2-detalle.md` §2, con estos cambios):
- `negocios.devolucion_pct` (3/5/8, default 5), `negocios.modo_monedas` (`visita` default | `valor`),
  `premios.valor_pesos`; costo en monedas calculado. Vencimiento a 12 meses sin visitas.
- Registro en `/n/<slug>/club` (nombre, celular, casilla sin marcar, link a `/n/<slug>/datos`) →
  bienvenida → tarjeta simple (número grande, una frase, un aviso, "Mostrar mi código").
- Bienvenida **pendiente** hasta la primera visita en caja (ARQUITECTURA §5).
- Caja `/caja/<slug>`: PIN (hash con `extensions.crypt`, bloqueo 10 intentos/hora) → sesión de 12 h en
  `sesiones_caja` (las RPC de caja reciben el token de sesión, no el PIN) →
  "¿Cuál es tu número?" grande / escanear código → **Sumar** / **Canjear**.
- **Sin conexión**: si falla la red, la caja guarda la operación en IndexedDB con un id único
  (`uuid` generado en el navegador), muestra "Guardado, se enviará al volver la conexión" y reintenta.
  La RPC `caja_visita` recibe ese id y es **idempotente** (mismo id = no suma dos veces).
- Términos del club visibles (cómo se gana, valor de premios, vencimiento) — Ley 1480.
**Listo cuando**
- [x] Pruebas SQL: bienvenida única, antifraude de horas, canje sin saldo rechazado, idempotencia por id.
- [x] e2e: registro → caja suma (también con la red cortada en Playwright → reconecta → se envía una vez).
- [x] El botón de reseña sigue sin sumar nada.

## Fase 3 — Paquete gimnasio
**Construir**
- **Importador de entradas** en el panel: subir CSV → vista previa → mapear columnas (identificador del
  socio, fecha y hora, nombre y celular opcionales) → importar. Re-importar el mismo archivo no duplica
  (`unique(negocio_id, socio_codigo, fecha_hora)`). Guardar mapeo por negocio para la próxima vez.
  Tablas: `socios(id, negocio_id, codigo_externo, nombre, telefono null, plan null)`,
  `entradas(id, negocio_id, socio_id, fecha_hora, origen: importado|nfc)`.
- Métricas de gimnasio (definiciones exactas en PRODUCTO.md §8): activos, abandono mensual, en riesgo,
  horas pico, racha por socio (semanas seguidas con ≥ 1 entrada).
- **En riesgo**: lista con botón de WhatsApp prellenado, **oculto fuera del horario de la Ley 2300**
  (L–V 7–19, S 8–15, nunca domingos ni festivos de Colombia; tabla de festivos en el esquema).
- **Máquinas**: productos `tipo = maquina` con `video_url` y 3 pasos; tag destino `producto` abre su ficha.
- **Clases**: productos `tipo = clase` con horario; "Clases de hoy" en el portal.
- Entrada por NFC solo si el negocio activa `entrada_nfc` (gimnasios sin torniquete).
**Listo cuando**
- [x] Con un CSV de prueba (generarlo en `tests/fixtures/entradas.csv`, 200 socios × 3 meses, con
      patrones de abandono conocidos) las métricas dan exactamente lo esperado (prueba SQL).
- [x] Re-importar no duplica. El botón de WhatsApp desaparece en un domingo simulado (`_ahora()`).

## Fase 4 — Estadísticas nivel 1 + soporte del estudio
**Construir**
- Tabla `metricas_diarias` + funciones `metrica_*` (una por definición) + `recalcular_metricas(negocio, desde)`.
  El cálculo nocturno va en `supabase/cron.sql` (pg_cron, 2:00 a. m. Bogotá; el Postgres de pruebas no tiene
  pg_cron: las pruebas llaman la función directo). Los paneles leen `metricas_diarias` + "hoy" en vivo.
- Todas las métricas de PRODUCTO.md §8 en `stats_admin`/`stats_token`, por sector, con la definición
  visible al pasar el dedo/mouse (un "?" junto a cada número).
- **Exportar para el estudio** (solo admin): CSV limpios por negocio (`visitas.csv`, `clientes.csv`,
  `canjes.csv`, `entradas.csv`) con diccionario de datos `LEEME.txt`, sin teléfonos (ids anonimizados).
- **Informes**: subir un PDF por negocio y periodo (Storage, bucket privado) → aparece en el link del
  dueño como "Informe del trimestre" (URL firmada temporal).
- `docs/ESTUDIO.md`: plantilla del informe (secciones, pruebas por pregunta, advertencias de muestra)
  y un script base en R (`estudio/plantilla.R`) que lee los CSV exportados.
**Listo cuando**
- [ ] Cada métrica tiene prueba SQL con datos conocidos.
- [ ] El CSV exportado no contiene teléfonos ni nombres.

## Fase 5 — Catálogo del café + "Elige por mí"
Carta (categorías, productos, foto subida y convertida a WebP 1000×1000, agotado a un toque) y la ruleta
"Elige por mí" (ponderada por `destacado`, excluye agotados, el resultado se decide antes de animar).
Detalle en `referencia/plan-v2-detalle.md` Fases 1 y 2, **con el diseño simple** de `docs/DISENO.md`.

## Fase 6 — Club que engancha
Hora dorada, racha con comodín mensual, niveles (por total ganado), aviso único en la tarjeta.
Detalle en `referencia/plan-v2-detalle.md` Fase 4.

## Fase 7 — Vender y cobrar
Negocios de demostración (`/n/demo-cafe`, `/n/demo-gym` con datos de ejemplo), landing con "Tócalo tú",
mensualidades en el panel (al día / por vencer / vencido, gracia, apagado por mora), plantillas de
términos, política de datos y contrato de transmisión (marcadas "revisar con abogado").

## Fase 8 — Dueño autónomo
`/panel` con login de dueños (Supabase Auth + tabla `accesos`), RLS por empresa, selector de sedes, edición de
catálogo/premios, PIN de caja, sección **Informes**. Reemplaza `/stats?k=`. Prueba obligatoria: un dueño no
puede leer nada de otra empresa (SQL + e2e).

## No construir (ideas guardadas)
Ver PRODUCTO.md §11: mapa 3D del gimnasio, AR, álbum, referidos, Wallet, WhatsApp automático, Red.
