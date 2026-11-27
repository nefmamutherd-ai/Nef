# Interfaz — cómo se arma cada pantalla

> Para cualquier modelo. **No inventes estilos**: las pantallas se arman con las clases que ya existen.
> Mira primero `docs/diseno/componentes.png` (o abre `componentes.html`): cada bloque tiene su clase escrita encima.

## 1. Qué hoja de estilos usa cada cosa
| Superficie | Rutas | CSS (en este orden) | `<body>` |
|---|---|---|---|
| Portales de negocios (cliente final) | `/n/<slug>`, `/n/<slug>/carta`, `/n/<slug>/club`, `/n/<slug>/datos`, `/n/<slug>/entrada` | `/assets/tokens.css` + `/assets/portal.css` | `<html data-tema="calido|energia|limpio">` y `<body class="pt">` |
| Caja | `/caja/<slug>` | igual que portales | igual que portales |
| Superficies de Nef | `/` (ya hecha), `/inactivo`, `/admin`, `/panel`, `/stats` | `/assets/nef-ui.css` | `<body class="nef">` |

Prefijos: `pt-` portales y caja · `n-` superficies de Nef. **Nunca mezclar** las dos hojas en una página.

## 2. Reglas que no se discuten
1. Solo clases de `portal.css` / `nef-ui.css`. Si falta un componente: agrégalo **primero** a esa hoja y a
   `docs/diseno/componentes.html`, con captura nueva, y después úsalo.
2. `style="..."` solo para tres variables: `--marca`/`--sobre-marca` (color del negocio, lo pone el servidor),
   `--progreso` (anillo del club, 0–100) y `--v` (barras, 0–1). Nada más en línea.
3. Ningún color escrito a mano (`#...`) en HTML ni JS. Ningún `font-family` nuevo.
4. Portal: **máximo 3** `.pt-boton`; el primero con `.principal`. Lo demás va en `.pt-enlaces`.
5. **Un** `.pt-aviso` por pantalla como máximo.
6. Todo texto que viene de la base de datos pasa por `esc()` (servidor) o `textContent` (navegador).
   Nunca `innerHTML` con datos.
7. Cada pantalla tiene sus 4 estados: **cargando** (`.pt-cargando`/`.n-cargando`), **vacío** (`.pt-vacio`/`.n-vacio`),
   **error** (aviso con qué hacer) y **sin conexión** (solo la caja: `.pt-sin-conexion`).
8. Texto: español de Colombia, tuteo, frases cortas. Pesos: `Intl.NumberFormat('es-CO', {style:'currency', currency:'COP', maximumFractionDigits:0})`.
9. Íconos: SVG en línea `<svg class="pt-icono" viewBox="0 0 24 24"><path d="..."/></svg>` (trazo, sin relleno).
   Usa los de la tabla del final; no traigas librerías de íconos.
10. Probar a **390×844** (celular) y **1280×860**. Sin scroll horizontal. Capturas en `tests/capturas/`.

## 3. Esqueletos (copiar tal cual)
**Portal (SSR en la Function):**
```html
<!doctype html><html lang="es" data-tema="${tema}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(negocio.nombre)}</title>
<link rel="stylesheet" href="/assets/tokens.css"><link rel="stylesheet" href="/assets/portal.css">
<style>:root{--marca:${colorSeguro(negocio.color)};--sobre-marca:${textoSobre(negocio.color)}}</style>
</head><body class="pt"><main class="pt-pagina"> … </main></body></html>
```
**Superficie de Nef:**
```html
<body class="nef">
  <header class="n-barra"><img class="n-logo" src="/assets/marca/logo-nef.svg" alt="nef" width="70" height="26">
    <span class="n-espacio"></span><span class="n-negocio">…</span><button class="n-btn fantasma chico">Salir</button></header>
  <main class="n-contenido">
    <div class="n-encabezado"><div><div class="n-etiqueta">…</div><h1>…</h1><p>…</p></div> [botón principal opcional] </div>
    <nav class="n-pestanas">…</nav>
    …
  </main>
</body>
```

## 4. Pantallas
Cada una: **ruta · archivo · componentes · textos exactos · listo cuando**. La fase indica cuándo se construye.

### Portales (cliente final)
| Pantalla | Fase | Ruta · archivo | Componentes | Textos | Listo cuando |
|---|---|---|---|---|---|
| Portal | 1 | `/n/<slug>` · `functions/n/[slug].js` | `.pt-cabeza`, `.pt-botones` (1–3 según servicios), `.pt-enlaces`, `.pt-firma` | Botones por sector desde `lib/sectores/*.json` ("Ver la carta"/"Clases de hoy", "Mis premios" (antes "Mis monedas", 27/11), "Déjanos tu reseña") | Café y gym con el mismo código; igual a `maqueta.png` |
| Registro al club | 2 | `/n/<slug>/club` | `.pt-club` h1, `.pt-form`, `.pt-campo` ×2, `.pt-casilla` (sin marcar), `.pt-accion.marca` | "Únete al club de ${negocio}", "Tu nombre", "Tu celular", "Autorizo el uso de mis datos para el club. Cómo se usan", "Unirme" | No envía sin casilla; celular de 10 dígitos que empieza por 3 |
| Mis monedas | 2 | `/n/<slug>/club` (con sesión) | `.pt-club`, `.pt-saldo` (`--progreso` = saldo/costo del premio más cercano ×100, máx. 100), `.pt-frase`, un `.pt-aviso`, `.pt-accion` "Mostrar mi código", `.pt-link` "Ver todos los premios" | "Te faltan **N** para un X" o "¡Ya puedes canjear X!" | Bienvenida pendiente muestra aviso neutro "Tus 50 de bienvenida se activan en tu primera visita" |
| Mi código | 2 | hoja inferior en la misma página | `.pt-hoja` con QR grande (assets/qrcode.js) y el número en grande | "Muéstraselo al cajero" | QR legible a 30 cm (≥ 240 px) |
| Datos y términos | 2 | `/n/<slug>/datos` | `.pt-pagina` texto largo, h1 `.pt-titulo` | Política (Ley 1581) + condiciones del club (Ley 1480) | Enlazada desde registro y tarjeta |
| Carta / catálogo | 5 (gym: 3) | `/n/<slug>/carta` | `.pt-barra` (volver + título + `.pt-ayuda` "Elige por mí"), `.pt-pestanas`, `.pt-categoria`, `.pt-prod` (`.agotado`) | "Agotado hoy" | 60 productos sin saltos; agotado gris |
| Detalle | 5 | hoja inferior | `.pt-hoja`, `.pt-foto-grande`, h2, `.pt-precio`, descripción | — | Cierra con fondo, Escape y deslizar abajo |
| Ficha de máquina | 3 | `/n/<slug>/p/<id>` | `.pt-cabeza` (nombre de la máquina), video 16:9 (`<video controls playsinline preload="none">` o iframe de YouTube con `loading="lazy"`), 3 pasos en `<ol>`, `.pt-accion` "Ver otras máquinas" | — | El video no se reproduce solo |
| Elige por mí | 5 | hoja inferior | `.pt-hoja`, 3–4 `.pt-boton` de antojo, la ruleta, `.pt-dos` "Lo pido"/"Otra vez" | — | El resultado se elige antes de animar |
| Entrada registrada | 3 | `/n/<slug>/entrada` (tag destino `entrada`; solo con `entrada_nfc`) | `.pt-hecho`, `.pt-check`, `.pt-racha`, `.pt-semanas` (8 semanas) | "Entrada registrada", "N semanas seguidas" | No aparece si el gym usa torniquete |

### Caja
| Pantalla | Fase | Componentes | Textos | Listo cuando |
|---|---|---|---|---|
| PIN | 2 | `.pt-form`, `.pt-campo` (input `inputmode="numeric"`, 4–6 dígitos), `.pt-accion` | "PIN de la caja", "Entrar" · error: "PIN incorrecto. Te quedan N intentos." | Bloqueo tras 10 intentos/hora |
| Buscar cliente | 2 | `.pt-caja-numero` (input `inputmode="tel"`, autofocus), `.pt-o`, `.pt-escanear` | "¿Cuál es tu número?", "Escanear su código" | Buscar con Enter |
| Ficha | 2 | `.pt-cliente`, `.pt-mon`, un `.pt-aviso`, `.pt-dos` (`.pt-sumar`/`.pt-canjear`) | Modo valor: pide el valor de la compra antes de sumar | Sumar dos veces seguidas con el mismo id = una vez |
| Sin conexión | 2 | `.pt-sin-conexion` arriba + `.pt-toast` | "Guardado, se enviará al volver la conexión" · "Sin conexión · N operaciones guardadas" | Probado cortando la red en Playwright |

### Superficies de Nef
| Pantalla | Fase | Ruta | Componentes | Listo cuando |
|---|---|---|---|---|
| Landing | ✅ hecha | `/` · `public/index.html` | (estilos propios, sigue GUIA-WEB) | — no rehacer; solo cambiar textos/precios si Jacobo lo pide |
| Negocio inactivo | 1 | `/inactivo` | `.nef`, logo, `.n-vacio` "Este negocio no tiene Nef activo", `.n-btn.principal` "Conoce Nef" → `/` | — |
| Admin de Jacobo | 1 (re-vestir) | `/admin` | `.n-barra`, `.n-pestanas` (Negocios · Tags · Mensualidades · Exportar), `.n-tabla`, `.n-estado`, `.n-form`, `.n-opciones` (sector), `.n-interruptor` (servicios), `.n-dialogo` | Mismos ids que usa `tests/e2e.mjs` (no romperlos) |
| Importar entradas | 3 | `/admin` y `/panel` › Clientes | `.n-subir` → vista previa en `.n-tabla` (10 filas) → `.n-form` mapeo de columnas (`select`) → `.n-btn.principal` "Importar" → `.n-aviso.ok` con totales | Re-importar dice "0 nuevas, N repetidas" |
| Resumen del dueño | 4/8 | `/panel` (antes `/stats`) | `.n-kpis` (3 números + `.n-def` con la definición exacta), `.n-tarjeta` "En riesgo" con `.n-lista`, `.n-barras` horas | Cada número tiene su "?" |
| En riesgo | 3 | `/panel` › Resumen | `.n-lista` + `.n-btn.chico.secundario` "WhatsApp" (oculto fuera de horario Ley 2300; en su lugar texto "Disponible el lunes a las 7 a. m.") | Domingo simulado = sin botón |
| Catálogo / premios | 8 | `/panel` › Catálogo, Club | `.n-tabla`, `.n-dialogo` con `.n-form`, `.n-interruptor` "Agotado hoy" | Cambio visible en el portal al recargar |
| Informes | 4/8 | `/panel` › Informes | `.n-lista` con fecha y `.n-btn.chico` "Abrir" (URL firmada), `.n-vacio` | Un dueño no ve informes de otra empresa |
| Mensualidades | 7 | `/admin` › Mensualidades | `.n-tabla` + `.n-estado.ok/.aviso/.alerta` ("Al día", "Vence en N días", "Vencido") | Vencido + gracia = portal muestra `/inactivo` |

## 5. Íconos (trazo, `viewBox="0 0 24 24"`)
| Uso | `d` |
|---|---|
| Flecha → | `m9 6 6 6-6 6` |
| Volver ← | `m15 6-6 6 6 6` |
| Carta / lista | `M4 5h16M4 12h16M4 19h10` |
| Monedas | círculo: `<circle cx="12" cy="12" r="8"/>` |
| Reseña (estrella) | `m12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z` |
| Reproducir | `m8 5 11 7-11 7z` |
| Calendario / clases | `<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16"/>` |
| Buscar | `<circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/>` |
| Check | `m5 12 5 5 9-10` |
| Cerrar | `M6 6l12 12M18 6 6 18` |
| WiFi | `M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01` |
| QR | `<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2v2h-2zM18 18h2v2h-2z"/>` |
