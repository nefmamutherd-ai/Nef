# Sistema visual

Referencia obligatoria para cualquier pantalla. Abre `docs/diseno/maqueta.html` en el navegador
(o mira `docs/diseno/maqueta.png`): son las pantallas aprobadas.

## La regla número uno: que cualquiera lo entienda sin pensar
Jacobo descartó una primera versión por saturada ("parece DiDi"). Por eso:
- **Una cosa por pantalla.** Si hay que buscar algo, el diseño falló.
- **Portal: máximo 3 botones grandes**, solo los de los servicios que el negocio contrató.
  Lo secundario (WiFi, WhatsApp, Instagram, etc.) va como enlaces de texto debajo.
- **Botones grandes**: 62–76 px de alto, texto de 17–19 px, ícono a la izquierda.
- **Un solo aviso a la vez** (ej. hora dorada *o* racha *o* premio cercano, nunca los tres).
- **Nada de**: chips de filtro a la vista, insignias de colores, botones flotantes sobre el contenido,
  tarjetas dentro de tarjetas, más de un color de acento por pantalla.
- Lo avanzado (filtros, historial, todos los premios) va **una pantalla más adentro**, nunca en la principal.

## Tokens y temas
- Todos los valores en `docs/diseno/tokens.css`. Copiarlo a `public/assets/tokens.css` y usar **solo**
  esas variables.
- **Un tema por sector**, con `data-tema` en `<html>`:
  - `calido` (por defecto) — cafés, panaderías, restaurantes: papel claro, serif para nombres.
  - `energia` — gimnasios y deportes: fondo oscuro, todo sans, títulos en 800, acento fuerte.
  - `limpio` — barberías, salones, spa, tiendas: blanco, mucho aire.
- El negocio solo elige **logo y color** (`--marca`). `--sobre-marca` se calcula por contraste
  (ya existe `textoSobre()` en `functions/n/[slug].js`).
- La estructura y los componentes son los mismos en los tres temas: cambia la ropa, no el esqueleto.

## Pantallas (ver maqueta)
| Pantalla | Lo que tiene, y nada más |
|---|---|
| Portal | Logo, nombre, ubicación ("Mesa 4" / "Sede Chapinero"), 3 botones grandes, enlaces de texto, firma pequeña "Mamut Herd". |
| Carta / catálogo | Título + "Elige por mí" arriba · pestañas de categoría · lista: nombre, una línea, precio, foto a la derecha. Buscar = lupa. Agotado: gris + "Agotado hoy". |
| Detalle | Hoja inferior: foto grande, nombre, precio, descripción. Sin más. |
| Elige por mí (ruleta) | Hoja inferior: 3–4 opciones de antojo, la ruleta, "Lo pido" / "Otra vez". |
| Mis monedas | Saludo, número grande en un anillo de progreso, una frase ("te faltan 70 para…"), un aviso, botón "Mostrar mi código", enlace "Ver todos los premios". |
| Caja | "¿Cuál es tu número?" grande · o "Escanear su código" · ficha del cliente con dos botones: **Sumar** y **Canjear**. |
| Entrada (gimnasio) | Check grande, "Entrada registrada", hora y sede, racha de semanas, una frase de lo que sigue. |

## Tipografía
- Tema cálido: serif del sistema para nombres y títulos; sans para lo demás.
- Tema energía: solo sans; títulos en 800.
- Precios y números: sans, negrita, `tabular-nums`. Sin fuentes descargadas.

## Color
- Dorado solo para monedas; verde para éxito y "Sumar"; rojo para agotado y errores.
- Sombra solo en lo que flota (hojas inferiores).

## Fotos
Reales, cuadradas, cenitales o a 45°, fondo neutro, luz natural (ver `docs/PRODUCTO.md` y `docs/RECURSOS.md`).
En la maqueta, los círculos de colores son marcadores. Mientras carga una foto: su color promedio y luego fade.

## Movimiento
150–300 ms, solo transform/opacity. Celebrar solo: ganar monedas, entrada registrada y la ruleta.
Todo desactivable con `prefers-reduced-motion`.

## Textos
Español de Colombia, tuteo, frases cortas. "Ver la carta", "Elige por mí", "Te faltan 70 para un
capuchino gratis", "¿Cuál es tu número?", "Registrar mi entrada". Las palabras cambian por sector
(mesa/entrada, plato/clase, carta/catálogo) y viven en el paquete del sector, no regadas en el código.

## Material impreso
El símbolo "punto" (anillo + centro = "acerca tu celular aquí") y las piezas para imprimir están en
`docs/kit/` (ver su `LEEME.md`).
