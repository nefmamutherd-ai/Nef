# Platos en 3D de un negocio real (fotogrametría)

Nef muestra cualquier plato en 3D y "en tu mesa" (realidad aumentada) si tiene un archivo **.glb**. Para platos reales ese archivo
se saca con **fotogrametría**: muchas fotos alrededor del plato que una app convierte en modelo 3D.

## Qué necesitas
- Un celular con buena cámara. Si es iPhone Pro, mejor (tiene LiDAR).
- Una app: **RealityScan** (de Epic, gratis), **Polycam** o **KIRI Engine** (tiene versión gratis). Las tres exportan .glb.
- Una base giratoria (una bandeja de pastelería giratoria sirve) y un fondo liso que no sea del color del plato.
- Luz pareja y suave: al lado de una ventana con cortina, o dos lámparas con papel encima. Nada de sombras duras ni flash.

## Paso a paso (15–30 min por plato)
1. Arma el plato como se sirve, recién hecho. Ponlo en el centro de la base giratoria.
2. En la app, empieza la captura. Toma fotos dando una vuelta completa en **tres alturas**: casi a ras de mesa, a 45° y desde arriba.
   Entre 60 y 150 fotos. Que cada foto se parezca a la anterior en un 70% (pasos pequeños).
3. No muevas el plato ni la comida durante la captura (si giras la base, gira solo la base, sin tocar el plato).
4. Procesa en la app y recorta lo que no es el plato (la mesa, la base).
5. Exporta en **.glb**. Que pese máximo 3 MB (si la app deja elegir, "calidad media" y textura de 2048 px).
6. Pásalo al computador (por WhatsApp a ti mismo como documento, Drive o cable).

## Publicarlo en Nef (5 minutos)
1. Entra a tu **/admin › Catálogo** (o el dueño en **/panel › Catálogo**) y elige el negocio.
2. Toca **Editar** en el plato (o **Agregar** si es nuevo).
3. En **Modelo 3D**, toca **"Subir modelo 3D (.glb)"** y elige el archivo. Debe decir "Modelo listo (x MB)". Máximo 5 MB.
4. Toca **Guardar**. Nef lo sube y llena el link solo.
5. **Pruébalo:** abre la carta del negocio en el celular, toca el plato: debe salir "Cargando tu plato…" y luego el 3D.
   Luego "Verlo en tu mesa" en un iPhone (Safari) y en un Android con "Servicios de Google Play para RA".
6. Si se ve muy grande o muy pequeño en la mesa: el modelo no está en metros. En la app de fotogrametría, ajusta la
   escala (un plato mide ~26 cm) y exporta otra vez.

## Si algo sale mal
- **"Pesa más de 5 MB":** exporta en calidad media y textura de 2048 px.
- **El plato sale negro o sin color:** exporta en .glb (no .obj ni .usdz) con texturas incluidas.
- **Sale torcido o de lado:** gíralo en la app antes de exportar (que el plato quede plano sobre el piso).
- **Sin tiempo para fotogrametría:** sube solo la foto; el plato funciona igual, sin 3D.

## Qué sale bien y qué no
- **Bien**: lo mate y con textura: pan, arepas, tortas, postres, galletas, carnes, ensaladas.
- **Difícil**: lo brillante o transparente (salsas muy brillantes, vasos de vidrio, café con reflejo, gelatina). Esos platos mejor
  dejarlos solo con foto.

## Cómo venderlo
Un extra: "tus 5 platos estrella en 3D, para que el cliente los vea en su mesa antes de pedir". Llévate la base giratoria a la cita.
