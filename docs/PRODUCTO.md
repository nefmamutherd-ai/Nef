# Nef — definición del producto

> Fuente de verdad de **qué es** Nef. El orden de construcción está en `docs/PLAN.md`.
> Si algún otro documento contradice este, gana este.

## 1. Qué es, en una frase
**Nef hace que los clientes vuelvan.** Pone un punto (chip NFC + QR) en la mesa, la entrada o la
máquina; el cliente acerca el celular, entra al portal del negocio, y el negocio lo conoce, lo premia
y lo recupera cuando deja de venir.

- Producto de **Mamut Herd** (Jacobo López). Nombre provisional: **Nef** (`MARCA`).
- Primeros nichos: **cafés/restaurantes** y **gimnasios**. El motor sirve para cualquier negocio con
  clientes que vuelven (barberías, salones…).

## 2. Quién usa qué
| Actor | Qué hace | Dónde |
|---|---|---|
| Cliente final | Acerca el celular, ve el portal, se inscribe una vez, dice su número al pagar, canjea | Portal del negocio (sin app) |
| Cajero / recepción | Suma y canjea (5 segundos) | `/caja/<negocio>` con PIN |
| Dueño | Mira sus números y la lista de "en riesgo"; recibe el informe | Link de estadísticas (luego, panel del dueño) |
| Jacobo (Mamut) | Vende, instala, configura, cobra, hace el estudio estadístico | `/admin` |

## 3. El ciclo (igual para todos los negocios)
1. **Llega** y ve el punto (mesa, entrada o máquina).
2. **Toca el chip o escanea** el QR — sin descargar nada, con sus propios datos móviles.
3. **Ve el portal**: máximo 3 botones grandes, según el sector y los servicios contratados.
4. **Usa el servicio y gana monedas** (en la caja o por asistencia).
5. **Canjea premios y vuelve.**
↻ Si deja de venir, **el dueño lo ve en "en riesgo" y le escribe** → vuelve al paso 1.

## 4. Servicios (se venden por separado y se combinan)
| Servicio | Qué incluye |
|---|---|
| **Base** | Tags NFC+QR con links dinámicos, portal, botón de reseñas, enlaces (WiFi, WhatsApp, Instagram), estadísticas nivel 1 |
| **Catálogo** | Carta del café ("Agotado hoy"); clases y máquinas (con video y "En mantenimiento") del gimnasio; "Elige por mí" |
| **Club** | Inscripción por celular, monedas, premios, caja, niveles, racha, hora dorada, socios en riesgo |
| **Estudio** | Informe estadístico trimestral (descriptivo + inferencial) hecho por Jacobo |
| **Red** (después) | Grupos de sedes y redes de negocios aliados |

El portal muestra **solo** lo contratado.

**"En mantenimiento" (máquinas):** el dueño, el gerente o Jacobo (desde /admin) lo prenden de un toque en el catálogo, con
una fecha opcional "Vuelve el…". El socio que acerca el celular a esa máquina ve arriba "Esta máquina está en mantenimiento"
(y cuándo vuelve, si se puso); el video y los pasos siguen visibles, pero no se puede entrenar con el tutorial ni ganar
monedas en ella. En "Encuentra tu máquina" sale en gris. No se quita solo: queda hasta que el dueño lo apague.

## 5. Cómo se adapta a cada nicho
| | ☕ Café / restaurante | 🏋️ Gimnasio |
|---|---|---|
| Dónde está el punto | Mesas y caja | Recepción y máquinas (la entrada ya la controla su torniquete) |
| Portal | Ver la carta · Mis monedas · Déjanos tu reseña | Cómo usar las máquinas · Clases de hoy · Mis monedas |
| Cómo se gana | Al pagar: cajero pregunta el número → Sumar | Por asistencia: se **importa** el registro de entradas de su sistema (huella/torniquete); o en recepción por compras de la tienda |
| Racha / en riesgo | Desde las visitas registradas en caja | Desde las entradas importadas |
| Lo que vendes | Reseñas en el mejor momento + clientes que vuelven | Saber quién se va a ir antes de que cancele + máquinas con video |
| Tema visual | Cálido | Energía |

**Gimnasio con torniquete/huella:** Nef **no** registra la entrada. Su sistema ya lo hace. Flujo:
exportan las entradas (Excel/CSV) → se importan en el panel → Nef calcula activos, rachas, en riesgo,
horas pico → el dueño recibe la lista y el informe. El chip de entrada (registro por NFC) existe solo
para gimnasios **sin** control de acceso.

## 6. Logística de las monedas
1. **Inscripción, una vez:** nombre + celular + casilla de autorización (sin marcar por defecto) → monedas de bienvenida **pendientes**, que se activan con la primera visita en caja (evita registros falsos desde la casa).
2. **Sumar:** cajero → "¿cuál es tu número?" (o escanea su código) → Sumar. Modo **por visita** (sin digitar monto, recomendado) o **por valor** (monto × % de devolución).
3. **Canjear:** el cajero ve qué premios le alcanzan → toca uno.
4. **El dueño define cuánto devuelve: 3 %, 5 % u 8 %**, y el valor de cada premio en pesos; Nef calcula las monedas. El panel muestra "este mes devolviste $X en premios".
5. **Vencimiento:** 12 meses sin visitas; aviso un mes antes. Todo esto visible en los términos del club.
6. **Nef no maneja pagos.** El cliente paga como siempre (efectivo, datáfono, Nequi). Nef solo registra.
7. **Sin internet en el local:** el portal usa los datos del cliente; la **caja funciona sin conexión**
   (guarda las operaciones en el dispositivo y las envía al volver la señal).

## 7. Si el negocio ya tiene otro sistema
- Caja/facturación sin puntos → conviven; el costo es el paso extra en caja (modo por visita = 3 segundos).
- Ya tiene puntos → no se vende Club; se vende Base, Catálogo y Estudio.
- Gimnasio con software de acceso → se importan sus entradas (ver §5).

## 8. Estadísticas
**Nivel 1 — panel automático (incluido).** Definiciones exactas (implementarlas así):

| Métrica | Definición |
|---|---|
| Visitas al portal | Toques + escaneos en el periodo |
| Clientes inscritos | Membresías creadas (total y nuevas en el periodo) |
| Frecuencia | Visitas registradas por cliente en los últimos 30 días (promedio y mediana) |
| Recencia | Días desde la última visita, por cliente |
| Retorno a 30 días | % de clientes con ≥ 2 visitas en 30 días |
| Activos (gimnasio) | Socios con ≥ 1 entrada en los últimos 14 días |
| Abandono mensual (gimnasio) | Activos al inicio del mes que no registran entradas en todo el mes ÷ activos al inicio |
| En riesgo | Clientes con ≥ 4 visitas históricas y sin venir hace ≥ 10 días (gimnasio) / ≥ 21 días (café); umbral editable |
| Horas pico | Visitas por hora y día de la semana (hora Bogotá) |
| Conversión a reseña | Clics en "Déjanos tu reseña" ÷ visitas al portal |
| Devolución real | Valor de premios canjeados ÷ ventas registradas en caja |
| Uso de máquinas | Escaneos por máquina |

**Nivel 2 — Estudio (servicio aparte, trimestral, Jacobo en R).** Nef exporta los datos limpios (CSV)
y aloja el informe:
- Descriptivo completo: cohortes por mes de inscripción, distribuciones, perfiles.
- Inferencial según la pregunta del dueño: comparación antes/después (¿funcionó la hora dorada?),
  regresión logística (¿quién va a cancelar?), supervivencia Kaplan-Meier (¿cuánto dura un socio por
  plan?), pronóstico de afluencia por hora.
- Entrega: PDF en lenguaje simple + 3 acciones concretas, publicado como link privado en el panel.
- Advertencia que va en cada informe: tamaño de muestra y periodo; sin datos suficientes no hay inferencia.

## 9. Reglas que nunca se rompen
1. **Reseñas sin premio** (política de Google).
2. **El azar nunca decide un premio** (Coljuegos). "Elige por mí" solo sugiere; bonos fijos para todos.
3. **Datos personales (Ley 1581):** autorización explícita, política visible, negocio = responsable,
   Mamut = encargado (contrato de transmisión).
4. **Puntos = promoción (Ley 1480):** condiciones, valores y vencimiento claros y visibles.
5. **Mensajes (Ley 2300):** solo por el canal que el cliente autorizó; lunes a viernes 7 a. m.–7 p. m. y
   sábados 8 a. m.–3 p. m.; nunca domingos ni festivos. El botón de WhatsApp de "en riesgo" se oculta
   fuera de ese horario.
6. **Monedas solo desde la caja o el registro de entradas**, nunca desde la mesa.
7. **Nef no toca la plata del negocio.**

## 10. Seguridad en una frase
**Nada que dé valor se gana visitando un link.** Los portales son públicos (como la carta en la vitrina);
las monedas, los canjes y las entradas solo los registra una persona del negocio (caja con PIN) o el
sistema de acceso del gimnasio. Detalle y casos en `docs/ARQUITECTURA.md` §5.

## 11. Identidad
- Marca Nef: `docs/marca/MARCA.md` (landing, paneles, informes).
- Portales de los negocios: `docs/DISENO.md` (temas por sector, diseño simple).

## 12. Ideas guardadas (NO construir hasta que Jacobo lo pida)
- **Mapa del gimnasio**: placas "¿Te perdiste?" por piso → mapa 3D simple con "Estás aquí" y ruta a la
  máquina → video. Va de la mano con **Antesala** (tour 3D realista para vender membresías).
  Sin seguimiento en tiempo real: cada placa es un "estás aquí".
- Realidad aumentada de platos (fotos con la hermana de Jacobo).
- Álbum de la carta, trae un amigo, cumpleaños, Wallet, WhatsApp automático, pedir desde la mesa,
  moneda compartida entre negocios distintos.
