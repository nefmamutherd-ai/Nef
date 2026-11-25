# Nef — contexto completo (para otro Claude)

> **Para quién es esto:** para un Claude que no ha visto el proyecto y va a ayudar a Jacobo con estrategia, precios,
> ventas, expansión a otros sectores y prioridades. Aquí está **todo** lo que existe hoy (25/11/2026), cómo funciona,
> qué falta, la competencia y las preguntas abiertas.
>
> **Antes de proponer precios:** revisa en tu memoria **los precios de Nef que ya hablaste con Jacobo**. Esta página no
> los repite a propósito: úsalos como punto de partida y ajústalos con lo que dice la sección 9 (competencia).

---

## 1. Qué es Nef, en una frase

**Nef hace que los clientes vuelvan.** Un punto (chip NFC + QR) en la mesa; el cliente acerca el celular, entra al
portal del negocio **sin descargar nada**, ve la carta (con platos en 3D), se une al club de monedas, y el negocio lo
conoce, lo premia y lo recupera cuando deja de venir.

- Producto de **Mamut Herd**, dueño **Jacobo López** (Bogotá). "Nef" es nombre provisional.
- **Público principal hoy: restaurantes** (decisión del 25/11/2026). Cafés después (ahí hay que crear la necesidad).
  Gimnasios están construidos pero **escondidos** hasta lanzarlos. Se quiere expandir a **veterinarias** y otros.
- Jacobo es estadístico: el **servicio de estudio estadístico** (informe trimestral) es una ventaja que nadie más ofrece.

---

## 2. Dónde verlo (todo funciona hoy)

Sitio de pruebas (rama `desarrollo`, publicado por Cloudflare): **https://nef-73r.pages.dev**

| Qué | Dirección | Quién lo usa |
|---|---|---|
| Página de ventas de Nef | `/` | Prospectos |
| Portal de un negocio (demo restaurante/café "Café Luna") | `/n/demo-cafe` | El cliente del restaurante |
| Carta (fotos, 3D, buscador, "Elige por mí") | `/n/demo-cafe/carta` | Cliente |
| Club / tarjeta de monedas | `/n/demo-cafe/club` | Cliente |
| Caja del negocio | `/caja/demo-cafe` — **PIN 1234** | Cajero |
| Panel del dueño / gerente | `/panel` | Dueño del restaurante |
| Panel de Jacobo (todos los negocios) | `/admin` | Solo Jacobo |
| Demo gimnasio (escondida) | `/n/demo-gym` | — |

- `/admin` entra con el correo de admin de Jacobo. Si Jacobo entra a `/panel` con esa misma cuenta, **ve el panel de
  cualquier negocio tal como lo ve su dueño** (con aviso arriba y selector de negocio).
- Guía para probar el QR de compra: `docs/kit/PRUEBA-QR.md`.
- Ojo: existe una copia vieja en **Vercel** (`nef-gamma.vercel.app`) que **no** está al día. No usarla.

---

## 3. Cómo está construido (lo mínimo para entender límites y costos)

- **Cloudflare Pages + Pages Functions** (servidor liviano, páginas armadas en el servidor) + **Supabase** (Postgres,
  login, archivos). Sin frameworks: HTML, CSS y JavaScript simples. Costo de infraestructura casi cero al inicio.
- Seguridad: todas las tablas con permisos por fila (RLS); las páginas públicas solo usan funciones que exponen lo
  mínimo. **Nada que dé valor se gana visitando un link**: monedas y canjes solo los registra la caja (con PIN).
- La **caja funciona sin internet** (guarda y reenvía; nunca suma doble).
- Pruebas automáticas: 87 de base de datos + 41 recorridos en navegador. Todo cambio pasa por `npm run verificar`.
- Flujo de publicación: se trabaja en `desarrollo`; **Jacobo** hace el merge a `main` para producción.
- Documentos del repo: `docs/PRODUCTO.md` (fuente de verdad del producto), `docs/PLAN.md`, `docs/ARQUITECTURA.md`,
  `docs/DECISIONES.md` (bitácora de decisiones, muy completa), `docs/PROGRESO.md`, `docs/kit/` (material de ventas).

---

## 4. Lo que YA existe, pieza por pieza

### 4.1 Portal del negocio (lo primero que ve el cliente)
- Se abre al tocar el chip o escanear el QR de la mesa; sabe **en qué mesa** está ("Mesa 4").
- Diseño nuevo **"Fiesta"** (elegido por Jacobo el 25/11): blanco, coral, amarillo, azul noche y lila; fondo vivo con
  manchas de color y dibujos de comida flotando; animaciones de entrada.
- Baldosas grandes: **Ver la carta** · **Mis monedas** · **Déjanos tu reseña** · **Elige por mí**. Debajo, **"Lo más
  pedido"** con fotos, y píldoras de **WiFi** (se copia la clave con un toque), WhatsApp, Instagram y otros enlaces.
- Cada negocio pone su **color y logo**; hay estilos alternos (Noche = oscuro elegante; Limpio = minimalista) con
  **vista previa** en el admin antes de guardar.

### 4.2 Carta digital
- Categorías con pestañas que siguen el scroll, **buscador** (sin importar tildes), rejilla de 2 columnas con fotos,
  plato destacado grande ("La de la casa"), **"Agotado hoy"** (en gris; se marca desde el panel y se ve al instante).
- **Platos en 3D**: el cliente lo gira con el dedo; pantalla de carga con fundido; fondo de "mesa de madera".
- **"Verlo en tu mesa"** (realidad aumentada, el plato a tamaño real sobre la mesa):
  - iPhone: realidad aumentada propia del teléfono (Quick Look). Funciona sin instalar nada.
  - Android: la app de Google (Scene Viewer). **Requiere "Servicios de Google Play para RA"**; si el celular es
    compatible, Google lo instala gratis la primera vez (se avisa antes). Si no es compatible: aviso "No es compatible".
  - Probado: funcionó en el celular de la mamá de Jacobo (tras instalar el servicio); en el de Jacobo no es compatible.
  - Se intentó hacerlo dentro de Chrome (WebXR): se trababa y cerraba Chrome → descartado por ahora.
  - Alternativas sin app evaluadas: **anclar el plato a un sticker impreso (MindAR, gratis)** — prototipo probado con
    una carta de póker: funciona, el plato queda quieto mientras se ve el sticker; servicios pagos con seguimiento del
    mundo (Zappar, Blippar, Onirix; 8th Wall cerró) — cientos de USD/mes; AlvaAR (código abierto, experimental, GPL).
- **"Elige por mí"**: tragamonedas con palanca, luces, confeti, **sonido** (clics + sonido de premio elegido por Jacobo)
  y botón para apagarlo. Gira sobre **toda la carta disponible** (el negocio no etiqueta nada). Solo **sugiere**: nunca
  da premios (regla de Coljuegos). Botones "Lo pido" / "Otra vez".
- Los modelos 3D de la demo los genera Claude con **Blender** (procedural, con luz de estudio y mesa de roble).
  Calidad: buena luz, comida aún "de juguete" (croissant nuevo pendiente de aprobación). Para platos reales:
  **fotogrametría** con el celular (RealityScan/Polycam/KIRI) → guía en `docs/kit/PLATOS-3D.md`.

### 4.3 Club de monedas (fidelización)
- Inscripción una sola vez: nombre + celular + autorización de datos (casilla sin marcar; Ley 1581).
- **Bienvenida**: monedas de regalo que se activan en la **primera compra** (evita registros falsos desde la casa).
  Configurable por negocio (demo: 50). → Esto es el "premio para los primeros clientes" que pidió Jacobo.
- Ganar: **por visita** (monedas fijas) o **por valor de la compra** (3, 5 u 8 % de devolución, lo elige el dueño).
- **Premios** con valor en pesos; Nef calcula cuántas monedas cuestan (misma regla para todos).
- **Niveles**, **racha semanal** (bono cada 4 semanas, con comodín mensual), **horas doradas** (franjas con monedas ×2
  o ×3 para llenar horas flojas). Vencimiento a 12 meses sin visitas.
- Tarjeta del cliente rediseñada (25/11): saldo grande, regalo pendiente, **botón principal "Sumar mis monedas"**
  (abre la cámara y lee el QR de la caja, en cualquier celular), "Tu próximo premio" con barra, "Tus premios",
  "¿Cómo gano monedas?" en 3 pasos, condiciones del club.
- Animación de lluvia de monedas al ganar.

### 4.4 Caja (el cajero, en una tablet o celular del mostrador)
- Entra con PIN (bloqueo tras 10 intentos/hora). Sesión de 12 h.
- **Sumar**: por número de celular del cliente o escaneando el código del cliente.
- **Cobrar con QR** (nuevo): el cajero toca lo que compró el cliente → total con precios de la carta → **QR de un solo
  uso, vence en 10 min** → el cliente lo escanea → gana monedas por el valor real; la caja dice "¡Listo!".
  No se puede usar dos veces ni inventar el valor. Probado en la base real.
- **Canjear** premios. Funciona sin internet.

### 4.5 Panel del dueño / gerente (`/panel`)
- Cuenta con correo; Jacobo le da acceso (rol dueño o gerente). Varias sedes con selector.
- **Resumen**: visitas al portal (NFC/QR), inscritos, frecuencia, retorno a 30 días, recencia, en riesgo, conversión a
  reseña, devolución real, horas pico. Cada cifra con "?" que explica qué significa.
- **Clientes en riesgo** con botón de WhatsApp y mensaje listo, **solo en horario legal** (Ley 2300).
- **Catálogo**: agregar/editar platos, precio, foto, modelo 3D, **Agotado hoy**.
- **Club**: premios y **PIN de la caja**.
- **Informes**: el PDF trimestral del Estudio.
- Importar entradas de torniquete (gimnasios).
- **Guía paso a paso** que resalta cada parte (sale sola la primera vez).

### 4.6 Panel de Jacobo (`/admin`)
- Pestañas: Negocios, Tags (lotes de chips NFC/QR por mesa, impresión), Estadísticas, Entradas/Informes, Catálogo,
  Mensualidades (fecha de pago + días de gracia: si vence, el portal y los tags se apagan solos), Dueños (accesos).
- Formulario del negocio: servicios (Catálogo, Club, Estudio), estilo con vista previa, color, logo, links, WiFi,
  monedas, bienvenida, racha, PIN, premios, horas doradas, datos legales, plan, notas privadas.
- **Guías**: "Guía" (pestañas) y "¿Qué es cada cosa?" (campo por campo).
- Sector: "Restaurante o café"; Gimnasio tras "Ver más sectores".

### 4.7 Página de ventas (`/`)
- Portada con el celular mostrando el producto (se turnan portal, carta y monedas), platos 3D flotando, sección
  "El plato en 3D, y sobre su mesa", cómo funciona, para quién (restaurantes), lo que ve el dueño, estudio, precios
  (sección por completar con la estrategia de la sección 9), preguntas, cierre con WhatsApp.

### 4.8 Legal y reglas que nunca se rompen
1. Reseñas **sin premio** (Google). 2. El azar **nunca** decide un premio (Coljuegos). 3. Autorización de datos
explícita (Ley 1581; el negocio es responsable, Mamut encargado). 4. Condiciones del club visibles (Ley 1480).
5. Mensajes solo por canal autorizado y en horario legal (Ley 2300). 6. Monedas solo desde la caja o entradas
registradas. 7. Nef no toca la plata del negocio.

### 4.9 Ya construido para gimnasios (escondido)
Máquinas con video, clases del día, importación de entradas del torniquete/huellero, activos, abandono mensual,
en riesgo, entrada por NFC para gimnasios sin torniquete, tema visual "Energía".

### 4.10 Cómo se adapta a otro sector
Cada sector es un **paquete** (`lib/sectores/*.js`): textos, botones del portal, palabras ("carta" vs "máquinas"),
tema visual y funciones. Agregar un sector = un archivo nuevo + ajustes de diseño; el motor (club, caja, panel,
estadísticas) es el mismo.

---

## 5. Recorrido de un restaurante (cómo se vende y se usa)

1. **Instalación** (Mamut): se crea el negocio, se imprimen y pegan los chips NFC+QR en cada mesa, se monta la carta
   (fotos y platos estrella en 3D), premios y PIN.
2. **Todos los días**: el cliente toca el chip → carta / 3D / "Elige por mí" → se une al club → al pagar, "Cobrar con
   QR" o el número → monedas → canjea premios. Si algo se acaba, "Agotado hoy" desde el panel.
3. **Cada semana**: el dueño mira el panel (5 min) y escribe por WhatsApp a los clientes en riesgo.
4. **Cada 3 meses** (si compró Estudio): informe en PDF con 3 acciones concretas.

---

## 6. Estado y pendientes (al 25/11/2026)

**Para salir a vender:**
1. Jacobo prueba el recorrido completo (caja en computador + cliente en celular).
2. Merge de `desarrollo` a `main` (producción) y **dominio propio** (p. ej. `nef.com.co`).
3. Cambiar la contraseña de la base de datos (se usó en el chat).
4. **Demo de restaurante de verdad**: convertir "Café Luna" en restaurante con platos fuertes en 3D (ajiaco, bandeja,
   carnes, pastas, postres).
5. **Información del plato bajo el 3D** (ingredientes / receta): falta un campo en el admin.
6. Sticker de mesa con buen diseño (NFC + QR) para llevar a las citas.

**Después:**
- Realidad aumentada anclada al sticker (MindAR) para celulares sin la app de Google.
- "Bono de fundadores" (los primeros N socios reciben algo extra), si Jacobo lo quiere además de la bienvenida.
- Que la carta abierta se refresque sola al cambiar "Agotado hoy".
- Lanzar gimnasios; diseñar veterinarias y otros sectores (sección 10).

---

## 7. Decisiones de diseño y producto recientes (para no repetir discusiones)

- Diseño del portal: **C "Fiesta"** (entre 3 propuestas: Bistró, Noche, Fiesta), **con azar** en "Elige por mí"
  (le gustó la idea de "sí/no", va después del giro).
- La caja **muestra** un QR → el cliente **lee** (no al revés).
- Realidad aumentada: solo se ofrece donde se ve bien (iPhone y Android con el servicio de Google).
- "Elige por mí" sin etiquetar antojos (antes había 4 opciones; a Jacobo no le gustó).
- Máximo de botones del portal: se permitió una 4.ª baldosa ("Elige por mí") a pedido de Jacobo.

---

## 8. Material de ventas existente (`docs/kit/`)
Guía de fotogrametría (`PLATOS-3D.md`), guía de prueba del QR (`PRUEBA-QR.md`), sonido de premio, y otros textos de
venta. `docs/ventas/` tiene contexto comercial.

---

## 9. Competencia: Fides-link (Bogotá)

Lo que Jacobo vio (reel, 25/11/2026):
- "Página digital" del negocio + **halador/display con QR y NFC**.
- **Un solo punto en el mostrador**, con "todo" ahí.
- **Dashboard / resumen** para el dueño.
- **Pago único ~1.900** (por confirmar si son **$1.900.000 COP**), **sin mensualidad**.
- También lo ofrecen a **veterinarias** y otros negocios.

Lo que Nef tiene y ellos (por lo visto) no:
| | Nef | "QR de mostrador" |
|---|---|---|
| Dónde está el punto | **En cada mesa** (el cliente lo usa sentado, cuando pide y cuando está contento) | Uno en el mostrador |
| Carta | Con **platos en 3D** y **"Verlo en tu mesa"** | Página digital |
| Fidelización | **Club de monedas** con caja, QR de compra, premios, racha, horas doradas | ¿? |
| Recuperar clientes | Lista de **clientes en riesgo** + WhatsApp listo en horario legal | Resumen |
| Experiencia | "Elige por mí" (tragamonedas con sonido) | — |
| Análisis | **Informe estadístico trimestral** hecho por un estadístico | — |
| Evoluciona | Sí (servicio) | Se entrega y queda quieto |

Estrategia que se le propuso a Jacobo (para que la afines con los precios que ya tienes en memoria):
1. **No competir por precio.** Ofrecer también un pago inicial, pero mejor armado:
   - **Instalación (pago único):** stickers NFC+QR para todas las mesas, carta montada, platos estrella en 3D.
   - **Mensualidad baja:** club, panel con clientes en riesgo, soporte, mejoras.
   - **Plan anual con descuento** (p. ej. 12 meses al precio de 10) para quien no quiere mensualidad.
2. **Mostrar la cuenta al dueño:** "si el club hace volver a 10 clientes al mes con un ticket de $40.000, son $400.000
   al mes; la mensualidad se paga sola".
3. **Pilotos rápidos:** 30 días gratis a 3 restaurantes a cambio de testimonio y permiso de mostrar sus números.
4. Comparación de una página para la reunión (sin nombrar a la competencia).

Lo que necesitamos de ti: precios concretos (instalación, mensualidad, anual, extras como Estudio y platos 3D),
guion de venta frente a "pago único", y la comparación de una página.

---

## 10. Expansión a otros sectores (lo que Jacobo quiere pensar contigo)

- **Veterinarias** (la competencia ya las ataca). Ideas a validar: portal con servicios y precios, citas por WhatsApp,
  club por visitas/compras de la tienda, **recordatorios** (vacunas, desparasitación) — ojo con Ley 2300 (solo canal y
  horario autorizados), carnet de la mascota, y sobre todo el **estudio estadístico** (qué servicios traen clientes de
  vuelta, estacionalidad, clientes que se pierden).
- **Gimnasios**: ya construido (sección 4.9), falta lanzarlo y ajustar el diseño.
- Barberías, salones, spa, panaderías, heladerías: mismo motor; cambia el paquete del sector.
- Jacobo quiere que la plantilla del portal (botones como "reseña", textos, diseño) sea **configurable por sector** y
  que Nef sirva para **más que fidelización** — el servicio estadístico es la pieza diferencial.

Preguntas para trabajar con Jacobo: ¿qué sector sigue después de restaurantes? ¿qué necesita una veterinaria que hoy
le duela? ¿cómo se empaqueta el Estudio para que lo compren negocios pequeños?

---

## 11. Preguntas abiertas para Jacobo
1. ¿Los "1.900" de la competencia son $1.900.000 COP? ¿Qué incluye exactamente?
2. Precios finales de Nef (ver tu memoria) y si se ofrece instalación + mensualidad + anual.
3. ¿Dominio definitivo y nombre final (Nef es provisional)?
4. ¿Primer sector después de restaurantes?
5. ¿Quién toma las fotos/modelos 3D de los platos reales (Mamut o el restaurante)?
6. ¿"Bono de fundadores" además de la bienvenida?

---

## 12. Riesgos conocidos
- La contraseña de la base de datos se compartió en chat → cambiarla.
- El PC de desarrollo es lento (i5 de 2013, disco C casi lleno): renders de 3D tardan ~5 min por plato.
- Realidad aumentada en Android depende del servicio de Google (no todos los celulares).
- Copia vieja en Vercel: quitarla para evitar confusión.

---

## 13. Ruta de venta (de "no me conoce" a "cliente que renueva")

> Material que ya existe en el repo y que esta ruta usa: `docs/ventas/` (guiones, objeciones, mensajes de WhatsApp,
> alta de cliente, **precios.md = hipótesis de precios del repo**) y `docs/kit/` (stickers, placa de caja, tarjeta,
> guías). **Los precios definitivos: revisa tu memoria** (lo que ya hablaste con Jacobo) y compáralos con
> `docs/ventas/precios.md`, que dice hoy: instalación $150.000–$250.000 (hasta 10 stickers + 1 placa de caja) +
> mensualidad Base $30.000, Carta +$30.000, Club +$40.000, Todo $85.000. Esa tabla es anterior al 3D, a "Verlo en tu
> mesa", al QR de compra y a la competencia de pago único: hay que actualizarla.

### Paso 0 · Preparar (una vez)
- Celular con la demo lista (`/n/demo-cafe`), un **sticker de mesa** NFC+QR de muestra y una **tablet o segundo
  celular con la caja abierta** (`/caja/demo-cafe`, PIN 1234).
- Probar antes "Verlo en tu mesa" en el celular que se va a usar (iPhone o Android con el servicio de Google).
- Ideal: la demo convertida en **restaurante** (platos fuertes en 3D). Pendiente en la lista de la sección 6.

### Paso 1 · Elegir a quién visitar
- Restaurantes con mesas (no solo domicilios), ticket medio-alto y clientela de barrio que repite: comida típica,
  asaderos, brunch, parrillas, cevicherías, pizzerías de barrio.
- Señales de dolor: **pocas reseñas en Google** frente a la competencia de la cuadra, **carta en PDF feo** o foto
  pixelada, sin programa de fidelización.
- Mirar en Google Maps antes: número de reseñas y calificación.

### Paso 2 · Primer contacto
- En persona, **entre 2 y 4 p. m.** (después del almuerzo). Guion: `docs/ventas/guion-cafes.md` (sirve para
  restaurantes; actualizar el gancho con el 3D).
- O por Instagram/WhatsApp con un video corto del plato en 3D sobre una mesa (`docs/ventas/mensajes-whatsapp.md`).

### Paso 3 · La demo (3 minutos, que lo toque el dueño)
1. **El "wow":** que acerque SU celular al sticker → abre el portal → "Ver la carta" → **un plato en 3D** → **"Verlo
   en tu mesa"** sobre su propia mesa.
2. **"Elige por mí":** la tragamonedas con sonido. Se ríen; es memorable.
3. **El club:** se inscribe → en la caja, "Cobrar con QR" → escanea → le caen las monedas.
4. **El negocio:** el panel con "clientes en riesgo" y el botón de WhatsApp. "Esto es lo que te hace plata: los que
   dejaron de venir y vuelven."
5. **Las reseñas:** "el botón aparece cuando el cliente está contento, en la mesa" (nunca a cambio de premio).

### Paso 4 · La oferta
- Empezar por lo que más le duele: pocas reseñas → Base; carta fea → Carta + 3D de sus platos estrella; clientes que
  no vuelven → Club.
- **Frente a "el otro es pago único"** (sección 9): instalación (pago único, con 3D de sus platos estrella) +
  mensualidad baja, o **anual con 2 meses gratis**. Hacer la cuenta: "10 clientes que vuelven al mes × ticket ≈ X; la
  mensualidad se paga sola".
- **Piloto:** 15–30 días gratis a los primeros restaurantes a cambio de testimonio y permiso de mostrar sus números.

### Paso 5 · Objeciones (ver `docs/ventas/objeciones.md` y agregar estas)
- "El otro cobra una sola vez": lo de ellos se entrega y se queda quieto; Nef trabaja todos los meses (club, alertas
  de clientes en riesgo, informes, platos nuevos en 3D). Y hay opción anual.
- "Mis clientes no se van a inscribir": la bienvenida (monedas de regalo) y el QR de compra lo hacen en 10 segundos;
  se mide en el panel.
- "Ya tengo carta con QR": la de Nef está en cada mesa, en 3D, se actualiza con "Agotado hoy" y además fideliza.
- "No tengo tiempo": el cajero tarda 3 segundos; el dueño mira el panel 5 minutos a la semana.
- "¿Y si mi cliente no tiene NFC?": cada sticker trae QR.

### Paso 6 · Cierre y alta
- Pedir: logo, link de reseñas de Google, carta (o fotos), WhatsApp, Instagram, WiFi, datos legales (Ley 1581).
- Lista de chequeo completa: `docs/ventas/alta-de-cliente.md`. En `/admin`: crear negocio (con la guía "¿Qué es cada
  cosa?"), tags por mesa, premios, PIN, dar acceso al dueño (pestaña Dueños). Cobrar 50 % por adelantado.
- Platos en 3D: fotogrametría (`docs/kit/PLATOS-3D.md`) o renders.

### Paso 7 · Instalación (en el local)
- Pegar stickers (mesa por mesa: cada tag sabe en qué mesa está), placa en la caja, tablet/celular de la caja con el
  PIN. Probar un toque por mesa. Enseñar al cajero: sumar por número y "Cobrar con QR" (2 minutos).
- Enseñar al dueño el panel (sale la guía sola) y "Agotado hoy".

### Paso 8 · Seguimiento (lo que convierte un piloto en cliente)
- Semana 1: mensaje con sus primeros números (visitas, inscritos, reseñas).
- Mes 1: reunión de 10 minutos con el panel: "volvieron X clientes, estos Y están en riesgo, escríbeles".
- Mensualidades en `/admin` (si vence, se apaga solo tras los días de gracia).

### Paso 9 · Crecer con el cliente
- **Estudio** (informe trimestral): la venta natural después de 3 meses de datos.
- Más platos en 3D, horas doradas para llenar horas flojas, otra sede.
- Pedir **referidos** a otros restaurantes del dueño (los dueños se conocen entre ellos).
