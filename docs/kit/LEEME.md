# Kit físico — para la imprenta

`vista-previa.png` muestra todas las piezas. Cada PDF está a **tamaño real con 3 mm de sangría** por lado
(el fondo se sale del corte para que no queden bordes blancos). El texto gris pequeño del borde
("QR DE MUESTRA…") queda en la sangría y se va con el corte.

> **Los QR son de muestra.** Cada sticker y placa lleva su propio código. En producción se generan
> desde el panel (Tags → seleccionar → Imprimir QR) o se reemplazan en estos diseños.
> Para cotizar y para mostrar en las visitas, sirven tal cual.

## Piezas
| Archivo | Medida final | Material sugerido | Chip NFC |
|---|---|---|---|
| `sticker-mesa-cafe.pdf` | Círculo Ø 70 mm (troquel redondo) | Vinilo adhesivo laminado mate (resiste limpieza) | Sticker NTAG213 Ø 25 mm pegado debajo del "punto" |
| `sticker-maquina-gym.pdf` | Círculo Ø 70 mm | Vinilo laminado mate de alta adherencia | **Chip antimetal** (las máquinas son de metal; uno normal no lee) |
| `placa-caja-cafe.pdf` | 105 × 148 mm (A6) | Acrílico de 3 mm impreso UV, o impresión pegada detrás de acrílico | NTAG213 detrás del centro del círculo |
| `qr-gigante-entrada-gym.pdf` | 600 × 900 mm | Vinilo adhesivo para pared/vidrio o pendón con tubos | Ninguno: al lado va una placa con chip en recepción |
| `tarjeta-mamut-herd.pdf` | 85 × 55 mm, 2 caras | Tarjeta PVC con chip NFC incluido | Viene dentro de la tarjeta |

Antes de imprimir la tarjeta: cambia `+57 300 000 0000` por tu número (en `fuentes/generar_kit.mjs`).

## Qué pedirle a la imprenta (para cotizar)
1. Precio por 50 y por 100 stickers redondos de 70 mm en vinilo laminado, con troquel.
2. Precio de placas A6 en acrílico de 3 mm impresas UV (por 10 y por 30), y si pueden dejar hueco o
   pegar el chip detrás.
3. Precio de un vinilo de 60 × 90 cm y de un pendón del mismo tamaño.
4. Precio de 100 tarjetas PVC con chip NFC (NTAG213 o NTAG215) impresas a dos caras.
5. Pedir **prueba de color** antes del tiraje: los colores de pantalla cambian en impresión.

## El "punto"
El anillo con el círculo lleno significa **"acerca tu celular aquí"**. Va igual en todas las piezas
para que la gente lo aprenda a reconocer. Archivo suelto: `fuentes/punto.svg`. No usar el símbolo de
ondas de pago sin contacto: es una marca registrada de otra organización.

## Probar antes de entregar
Graba el chip, pégalo, pon la pieza en su lugar real y prueba con un Android y un iPhone.
Si no lee: chip muy lejos (acrílico muy grueso), superficie metálica (usar antimetal) o el NFC apagado
en ese Android (por eso siempre va el QR).
