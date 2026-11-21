# Guía web de Nef — para que no parezca hecha con IA

Para la landing de Nef, los paneles y la sección de Nef en la página de Mamut Herd.
Referencias visuales: `tablero.png` (marca) y `landing-referencia.png` (cómo se aplica).

## 1. Estructura del sitio
```
nef.<dominio>/                 Landing: presentación de Nef
 ├── #como-funciona            (ancla en la misma página)
 ├── #cafes  #gimnasios         (anclas)
 ├── /n/demo-cafe  /n/demo-gym  Demos reales: "Tócalo tú"
 └── WhatsApp de ventas         Botón principal
nef.<dominio>/n/<negocio>      Portal de cada negocio (NO usa esta guía: usa su tema, ver DISENO.md)
nef.<dominio>/panel            Panel del dueño (esta guía)
mamutherd.<dominio>            Página de Mamut → tarjeta de Nef → enlace a la landing
```

## 2. Landing: secciones en orden (no agregar más)
1. **Portada.** Promesa grande a la izquierda ("Clientes que vuelven."), una línea de explicación, dos
   botones (principal: "Quiero Nef en mi negocio" → WhatsApp; secundario: "Tócalo tú" → demo). A la
   derecha, **foto real** de un sticker en una mesa o una placa en un gimnasio (con la hermana de Jacobo).
   Mientras no haya foto: la captura del portal en un celular, inclinada levemente.
2. **Cómo funciona.** Tres pasos en fila con número grande en mandarina: Acerca el celular → Ve el portal →
   Vuelve. Debajo de cada uno, captura real recortada (no íconos).
3. **Para cafés / Para gimnasios.** Dos columnas desiguales (7/5), cada una con lo concreto: qué ve el
   cliente, qué ve el dueño, una frase con un número ("Estos 12 socios dejaron de venir").
4. **Lo que ve el dueño.** Captura grande del panel; tres números en Bricolage.
5. **El estudio.** Un bloque oscuro (tinta) con texto corto: quién hace el análisis (Jacobo, matemático) y
   qué entrega. Sin gráficas decorativas.
6. **Precios.** Una tabla simple por servicio. Si aún no están definidos: "Desde $X / mes" y WhatsApp.
7. **Preguntas.** 5 máximo, en acordeón: ¿necesitan app? ¿y si no tienen NFC? ¿y si no hay internet?
   ¿mis datos? ¿puedo probar gratis?
8. **Cierre.** Una frase y el botón de WhatsApp. Pie con "Un producto de Mamut Herd".

## 3. Grilla y espacio
- Base de **4 px**. Escala de espacios: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.
- Contenedor: **1200 px** máximo, márgenes laterales 24 px (escritorio) / 20 px (celular).
- Escritorio: **12 columnas**, separación 24 px. Celular: 4 columnas, separación 16 px.
- Espacio vertical entre secciones: **128 px** escritorio / **72 px** celular. Dentro de una sección: 48 / 32.
- Texto de párrafo: máximo **62 caracteres** por línea (unos 560 px).

## 4. Tipografía
| Estilo | Escritorio | Celular | Fuente | Peso | Interlineado | Espaciado |
|---|---|---|---|---|---|---|
| Portada | 88 px | 48 px | Bricolage | 800 | 0.95 | −0.035em |
| Título 1 | 56 px | 36 px | Bricolage | 800 | 1.0 | −0.03em |
| Título 2 | 40 px | 28 px | Bricolage | 700 | 1.08 | −0.02em |
| Título 3 | 24 px | 20 px | Bricolage | 700 | 1.2 | −0.01em |
| Texto grande | 20 px | 18 px | Sistema | 400 | 1.5 | 0 |
| Texto | 17 px | 16 px | Sistema | 400 | 1.55 | 0 |
| Pequeño | 14 px | 14 px | Sistema | 400 | 1.45 | 0 |
| Etiqueta | 13 px | 12 px | Sistema | 600 | 1.2 | 0.08em, MAYÚSCULAS |
| Números grandes | 64 px | 44 px | Bricolage | 800 | 1.0 | −0.03em, `tabular-nums` |

Texto **alineado a la izquierda** siempre (lo centrado solo en el cierre).

## 5. Color (proporción en pantalla)
- **70 % papel** `#F5F1EA` · **20 % tinta** `#1D1B18` · **máximo 10 % mandarina** `#FF6B35`.
- Mandarina solo para: el punto, el número de cada paso, una palabra destacada por título, un botón principal
  por pantalla (con texto en tinta, no en blanco).
- Bloques de cambio de ritmo: una sección en tinta (el estudio). Arena `#E8E1D4` para separar zonas.
- Cielo `#CFE3F0` solo en gráficas.

## 6. Componentes
| Componente | Medidas |
|---|---|
| Botón principal | Alto 52 px, padding 0 24 px, radio 14 px, mandarina con texto tinta 600 · al presionar: escala 0.98 |
| Botón secundario | Igual, fondo transparente, borde 1.5 px tinta |
| Tarjeta grande | Radio 28 px, padding 40 px (24 en celular), fondo blanco, **sin sombra**, sin borde |
| Tarjeta pequeña | Radio 16 px, padding 20 px |
| Capturas | Radio 20 px; en marco de celular solo en la portada |
| Separadores | 1 px arena; nunca sombras para separar |
| Íconos | Solo donde ayudan a leer (pasos, preguntas); trazo 1.75 px, sin rellenos de color |

## 7. Lo que hace que una página parezca hecha con IA — prohibido
- Degradados (especialmente morado-azul), brillos, vidrio esmerilado, fondos con manchas difuminadas.
- La grilla de **3 tarjetas iguales con ícono + título + 2 líneas** como sección principal.
- Todo centrado; todas las secciones con la misma estructura.
- Emojis como viñetas; frases tipo "Revoluciona", "Potencia", "Desbloquea", "Lleva tu negocio al siguiente nivel",
  "Solución integral".
- Ilustraciones genéricas de gente con celulares; fotos de banco de imágenes.
- Testimonios, logos de clientes o cifras **inventadas**. Si no hay, no se ponen.
- Sombras grandes y difusas en todas las tarjetas; esquinas redondeadas en todo por igual.
- Animaciones que aparecen al hacer scroll en cada bloque.

## 8. Lo que la hace sentir real
- **Fotos reales** del producto en lugares reales (sticker en una mesa de madera, placa en recepción).
- **Capturas reales** del portal y del panel (de la maqueta o del sistema funcionando).
- Textos **específicos**: números, nombres de pantallas, ejemplos de un café real de Bogotá.
- **Asimetría**: columnas 7/5, una imagen que se sale del contenedor, un bloque oscuro que rompe el ritmo.
- Tipografía grande con mucho aire: que el título haga el trabajo, no la decoración.
- Un detalle con carácter por página: el punto mandarina como viñeta de los pasos o como cursor del
  número grande. Uno solo.
- Movimiento mínimo: hover de botones y el punto del logo "latiendo" una vez al cargar. Nada más.

## 9. Celular primero
Se diseña primero a 390 px. La portada en celular: título (3 líneas máximo), una línea, botón principal
a todo el ancho, foto debajo. Ningún texto menor a 14 px. Botones de 52 px de alto mínimo.

## 10. Rendimiento
Landing < 300 KB sin contar fotos; fotos en WebP con `width`/`height` fijos y `loading="lazy"` (salvo la
portada); solo 2 pesos de Bricolage (700 y 800) con `font-display: swap`.
