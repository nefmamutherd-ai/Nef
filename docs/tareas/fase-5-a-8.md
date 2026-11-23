# Fases 5 a 8

> Modo estricto (`AGENTS.md` §3). Antes de empezar cada fase, si una tarjeta te parece demasiado grande
> (más de ~300 líneas de cambios), **pártela** en sub-tarjetas (5.2a, 5.2b…) aquí mismo, haz commit de ese cambio
> ("plan: partir tarjeta 5.2") y sigue con la primera.

## Fase 5 — Catálogo del café + "Elige por mí"
Referencia: `docs/referencia/plan-v2-detalle.md` §2 "Carta", Fases 1 y 2 · Diseño: `docs/UI.md` filas Carta, Detalle, Elige por mí.

### [x] 5.1 Tablas `categorias`, `eventos_carta`; completar `productos` (si 3.8 ya la creó, solo `add column if not exists`)
Comprobar: [x] anon no lee · [x] verificar ✓.
### [x] 5.2 RPC `carta_publica(p_slug)` (una llamada: categorías + productos activos, destacados primero) y `registrar_evento_carta`
Comprobar: [x] no devuelve inactivos · [x] tipo de evento inválido no inserta.
### [x] 5.3 Página `/n/<slug>/carta` (SSR) + hoja de detalle
`.pt-barra`, `.pt-pestanas` (pestaña activa sigue el scroll con `IntersectionObserver`), `.pt-prod`, `.pt-hoja`.
Fotos `loading="lazy"` con `width`/`height`. En `cafe.json` el botón "Ver la carta" pasa a `/n/{slug}/carta` **solo si**
el negocio tiene productos; si no, sigue a `menu_url` (resuélvelo en `botonesPortal`).
Comprobar: [x] e2e con 30 productos: captura móvil, agotado en gris, la hoja cierra con Escape · [x] sin scroll horizontal.
### [x] 5.4 Admin de carta: categorías, productos, "agotado hoy" de un toque, foto
Foto: el navegador la recorta cuadrada y la convierte a WebP 1000×1000 con `<canvas>` (`toBlob('image/webp', .82)`) antes de subir
a Storage (bucket público `fotos`, en `supabase/storage.sql`). En e2e intercepta `/storage/v1/`.
Comprobar: [x] marcar agotado → el portal lo muestra gris al recargar.
### [x] 5.5 "Elige por mí"
3–4 antojos (dulce, salado, bebida, sorpréndeme) → candidatos sin agotados → **el resultado se elige primero**
(ponderado: destacado pesa 2) y después se anima la ruleta (≤ 2,5 s, `prefers-reduced-motion` = sin animación) →
"Lo pido" (evento `ruleta_acepto`) / "Otra vez". **Girar no da monedas ni premios** (regla 2: el azar nunca decide un premio).
El bono fijo por pedir el plato sugerido solo lo suma la caja (`DECISIONES.md`, 2026-11-17), y es opcional.
Comprobar: [x] prueba unitaria de la función de elección con semilla: nunca elige agotados; destacados ≈ el doble en 10.000 tiradas (±5 %).
### [x] 5.6 Cierre de la fase 5 — criterios de PLAN.md, PROGRESO.md, push.

## Fase 6 — Club que engancha
Referencia: `plan-v2-detalle.md` Fase 4 y "Reglas del club" (racha, hora dorada, niveles).

### [x] 6.1 Horas doradas (tabla `horas_doradas`, cálculo dentro de `caja_visita`, movimiento `bono_hora_dorada` aparte)
Comprobar: [x] visita dentro de la franja (fija `nef.ahora`) = base × multiplicador; fuera = base.
### [x] 6.2 Racha semanal con comodín mensual y `bono_racha` cada 4 semanas
Comprobar: [x] pruebas de los 4 casos: misma semana, semana siguiente, salto de 1 con comodín, salto sin comodín.
### [x] 6.3 Niveles por `total_ganado` (se calculan, no se guardan) en `club_tarjeta` y en la caja
### [x] 6.4 Aviso único en la tarjeta
Prioridad fija: (1) bienvenida pendiente → (2) hora dorada activa → (3) premio alcanzable → (4) racha en riesgo → (5) te faltan N.
Solo se muestra el primero que aplique. Comprobar: [x] prueba de la función de prioridad con los 5 casos.
### [x] 6.5 Cierre de la fase 6.

## Fase 7 — Vender y cobrar
### [x] 7.1 Negocios de demostración
`supabase/demo.sql` (idempotente, separado del esquema): empresa "Demostración", `/n/demo-cafe` (12 productos, 3 premios)
y `/n/demo-gym` (6 máquinas con pasos, 4 clases), con un cliente de ejemplo. La landing ya muestra "Tócalo tú" sola cuando
`/n/demo-cafe` existe: compruébalo. Comprobar: [x] e2e: el botón "Tócalo tú" aparece y lleva al portal demo.
### [x] 7.2 Mensualidades en el admin
`empresas.estado_pago`, `empresas.vence date`, `empresas.dias_gracia int default 5`. Estados "Al día / Vence en N días / Vencido"
con `.n-estado`. Vencido + gracia → `resolver_toque` y `negocio_publico` devuelven inactivo (prueba SQL con `nef.ahora`).
### [x] 7.3 Plantillas legales
`docs/legal/terminos-club.md`, `politica-datos.md`, `contrato-transmision-datos.md`, `contrato-servicio.md`. Arriba de cada uno:
"PLANTILLA — revisar con abogado antes de usar". Leyes: 1581 de 2012 (datos), 1480 de 2011 (consumidor), 2300 de 2023 (contacto).
### [x] 7.4 Cierre de la fase 7.

## Fase 8 — Panel del dueño
Referencia: `docs/ARQUITECTURA.md` §2, §4, §7 · `docs/UI.md` filas del panel.

### [ ] 8.1 Acceso por empresa
`es_dueno(p_empresa uuid) returns boolean` (security definer, lee `accesos` con `auth.uid()`). Políticas de lectura/escritura
en cada tabla de configuración para dueños de su empresa. **Prueba obligatoria:** usuario A (empresa 1) no lee ni modifica
nada de la empresa 2 — una prueba por tabla (negocios, tags, productos, premios, membresias, informes).
### [ ] 8.2 `/panel`: login (Supabase Auth, correo + contraseña; el admin crea al dueño y le da acceso) y selector de sede.
### [ ] 8.3 Secciones: Resumen, Clientes (en riesgo + importar entradas si es gym), Catálogo, Club (premios, devolución, PIN), Informes.
Reutiliza lo que ya existe en `admin.html` moviéndolo a módulos en `public/assets/panel/*.js`, **sin romper el admin**.
### [ ] 8.4 Reemplazar `/stats?k=`: `/stats` muestra "Ahora entras por /panel" + botón; los tokens viejos dejan de funcionar
solo cuando Jacobo lo decida (deja un interruptor en `DECISIONES.md`, no lo apagues tú).
### [ ] 8.5 Prueba e2e de aislamiento: dos dueños, dos navegadores; cada uno solo ve lo suyo. Capturas.
### [ ] 8.6 Cierre de la fase 8 + resumen final para Jacobo (`AGENTS.md` §9).
