# Cómo grabar un chip NFC de Nef

## La idea en una línea
El chip guarda **un solo link fijo**: `https://nef-73r.pages.dev/t/<código>`. **Lo que abre se decide en el admin**
(Tags → "Al tocar abre…") y se puede cambiar cuando quieras **sin volver a grabar el chip**.
El QR de la misma pieza lleva el mismo link con `?q` al final (así las estadísticas separan NFC de QR).

## Lo que necesitas
- Chips **NTAG213** (stickers, placas o tarjetas). En máquinas de metal: **chip antimetal**.
- Un celular con NFC y la app gratis **NFC Tools** (de wakdev; hay para Android y iPhone).

## Paso a paso
1. **Crea los tags en el admin.** Abre `https://nef-73r.pages.dev/admin` (esa dirección, no un link de vista previa:
   el link que se copia sale de la dirección en la que estás) → **Tags** → "Crear tags nuevos". Puedes crearlos
   "Sin asignar" y asignarlos después.
2. **Copia los links.** Marca los tags → **Copiar links NFC**. Te queda una lista `Mesa 1 → https://…/t/abc2345`.
   Pásala a tu celular (por WhatsApp a ti mismo, por ejemplo).
3. **Graba.** En NFC Tools: **Escribir → Agregar un registro → URL/URI** → pega el link completo, con `https://`
   → **OK → Escribir** → acerca el chip a la parte de atrás del celular hasta que diga que terminó.
   - Un solo registro, de tipo **URL**. No uses "Texto" ni agregues otros registros.
   - Cada chip tiene su propio código: graba uno por uno y ve marcando cuál es cuál (Mesa 1, Mesa 2…).
4. **Prueba antes de pegarlo.** Sal de la app y acerca el chip con el celular desbloqueado: debe abrir el portal.
   Prueba con un Android y con un iPhone.
5. **Elige qué abre.** En el admin, en la fila del tag, cambia **"Al tocar abre…"**: página del negocio, carta,
   reseña de Google, WhatsApp, Instagram, WiFi, club, ficha de una máquina, registrar entrada o una URL tuya.
   El cambio vale al instante, sin tocar el chip.
6. **Bloquea el chip (opcional, después de probar).** En NFC Tools: **Otros → Bloquear etiqueta**. Así nadie lo
   regraba con otro link. **Es para siempre**: el chip ya no se puede volver a grabar. Como lo que abre se cambia
   en el admin, normalmente no hace falta regrabarlo nunca.

## Dónde acercar el celular
- **iPhone (XS o más nuevo):** la parte de arriba del celular, con la pantalla encendida. No hace falta abrir nada.
- **Android:** el centro de la parte de atrás. El NFC tiene que estar prendido (Ajustes → NFC). Por eso siempre
  va también el QR.

## Si no abre
| Qué pasa | Por qué | Qué hacer |
|---|---|---|
| No pasa nada | NFC apagado en ese Android, o el celular está bloqueado | Prender NFC; desbloquear; usar el QR |
| No lee en una máquina | El metal bloquea los chips normales | Usar chip **antimetal** |
| No lee detrás del acrílico | Material muy grueso | Acrílico de 3 mm como máximo, chip pegado al centro del círculo |
| Abre "Este punto no está activo" | El tag no tiene negocio asignado, está apagado o la mensualidad venció | Asignarlo en Tags, prender "Activo", o registrar el pago |
| Abre la página del negocio en vez de, por ejemplo, la carta | Ese destino no está configurado en el negocio | Llenar el link en el negocio (o el destino cae a la página del negocio) |

## Ojo con el dominio
Los chips quedan grabados con `nef-73r.pages.dev`. Si algún día compras un dominio propio, los chips viejos siguen
funcionando mientras el proyecto de Cloudflare exista. Lo ideal es comprar el dominio **antes** de grabar muchos.
