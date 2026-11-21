# Progreso

Bitácora de sesiones. Claude Code agrega una entrada al cerrar cada sesión (`/cerrar-sesion`).
Formato: fecha · fase · qué quedó hecho · pruebas · qué sigue · pendientes/pedidos sin hacer.

## 2026-11-19 · Fase 0 (hecha en Claude.ai)
- Hecho: links dinámicos `/t/`, registro de toques NFC/QR, página del negocio, clics, `/inactivo`,
  panel `/admin` (negocios, tags por lotes, impresión de QR, estadísticas), `/stats?k=` para el dueño.
- Pruebas: `test:sql` 10 OK · `test:e2e` 9 OK.
- Primera maqueta descartada por saturada; aprobada la **dirección simple** (`docs/DISENO.md`, `docs/diseno/maqueta.png`).
- Producto **versátil**: motor común + paquetes por sector (café, gimnasio, servicios) + servicios activables.
- Nombre provisional: **Sello**. Kit impreso en `docs/kit/`, kit de ventas en `docs/ventas/`.
- Sigue: Fase 0.5 de `docs/ROADMAP.md` (motor versátil + diseño simple). Orden: 0.5 → 3 → G → 1 → 2 → 4.

## 2026-11-19 (tarde) · Definición final antes de la jornada de Claude Code
- Nombre provisional **Nef**; identidad en `docs/marca/` (tablero, logos, fuentes).
- Producto consolidado en `docs/PRODUCTO.md`; plan del día en `docs/PLAN.md` (Fases 1 → 8).
- Gimnasios: la entrada **se importa** de su sistema (torniquete/huella), no se registra con NFC.
- Estadísticas definidas (nivel 1 automático, nivel 2 estudio en R). Caja sin conexión.
- Sigue: Fase 1 de `docs/PLAN.md`.

## 2026-11-20 · Listo para cualquier modelo + landing (hecho en Claude.ai)
- **Landing `/` hecha** (`public/index.html`): las 8 secciones de `GUIA-WEB.md`, celular primero, precios en un
  objeto `PRECIOS` (hoy "Te lo cotizamos"), WhatsApp desde `CONTACTO_WHATSAPP`, "Tócalo tú" aparece solo cuando
  exista `/n/demo-cafe` (Fase 7). Pendiente de Jacobo: foto real del sticker para la portada.
- **Interfaz armada**: `public/assets/portal.css` (portales y caja, 3 temas) y `nef-ui.css` (admin/panel),
  catálogo visual en `docs/diseno/componentes.html/.png`, reglas y pantalla por pantalla en `docs/UI.md`.
- **Modo para cualquier modelo**: `AGENTS.md` (+ `GEMINI.md`), tarjetas en `docs/tareas/` (fases 1–8),
  verificador `npm run verificar` (secretos, dependencias, SQL idempotente, RLS, search_path, pruebas que no bajan,
  rama). Guía para Jacobo: `docs/ARRANCAR-CON-OTRO-MODELO.md`.
- Assets copiados a `public/assets/` (tokens, fuentes, logos, capturas en WebP).
- Pruebas: test:sql 10 OK · test:e2e 10 OK (nuevo caso de la landing) · verificar OK.
- Sigue: tarjeta 1.1 de `docs/tareas/fase-1.md`.
