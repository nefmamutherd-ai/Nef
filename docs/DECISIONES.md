# Bitácora de decisiones

Formato: fecha · decisión · por qué. Las más recientes arriba.

- 2026-11-19 · Cuentas: empresa → sedes; accesos por empresa; caja con sesión corta por PIN. · Gimnasios y cadenas con varias sedes; un dueño no ve otras empresas.
- 2026-11-19 · BD por capas: configuración, personas, hechos (solo se agregan) y resúmenes diarios. · Paneles rápidos con muchos clientes y datos confiables para el estudio.
- 2026-11-19 · Portales públicos; "nada que dé valor se gana visitando un link"; bienvenida pendiente hasta la primera visita. · Alguien puede escribir la dirección de otro negocio; no debe poder sacar nada.
- 2026-11-19 · Git: Claude Code hace push a la rama `desarrollo`; solo Jacobo pasa a `main`. · Cloudflare publica a producción lo que llega a `main`.
- 2026-11-19 · Nombre provisional **Nef** (reemplaza "Sello"). · Corto, viene de NFC, sirve para cualquier sector; lo propuso Jacobo.
- 2026-11-19 · Gimnasios con torniquete: entradas importadas (CSV) en vez de registro NFC. · Su sistema de acceso ya registra cada entrada; duplicarla no aporta.
- 2026-11-19 · Nef no maneja pagos; la caja funciona sin conexión. · No competir con su caja; locales con mala señal.
- 2026-11-19 · Estadísticas en dos niveles: panel automático y estudio trimestral en R. · Diferencial de Jacobo (matemático).
- 2026-11-19 · Nombre provisional **Sello** (reemplaza "Sobremesa", que era solo de restaurantes). Sale de `MARCA`. · El producto es multisector; "Sello" sirve para cualquier negocio y es el punto donde se acerca el celular.
- 2026-11-19 · Producto versátil desde el inicio: motor común + paquetes por sector (JSON) + servicios activables (Base, Catálogo, Club, Red). · Vender a gimnasios y cafés a la vez sin rehacer código.
- 2026-11-19 · Diseño simple: máximo 3 botones en el portal, un aviso a la vez, sin chips ni insignias a la vista. · La primera maqueta se sintió saturada.
- 2026-11-19 · El dueño configura % de devolución (3/5/8) y el valor de los premios en pesos; monedas vencen tras 12 meses sin visitas. · Que el dueño sepa cuánto le cuesta el club.
- 2026-11-19 · Orden de construcción 0.5 → 3 → G → 1 → 2 → 4. · El primer cliente probable es un gimnasio.
- 2026-11-19 · AR queda como "próximamente". · Lo costoso son las fotos; las hará la hermana de Jacobo cuando un cliente lo pague.
- 2026-11-19 · Sistema visual aprobado en `docs/DISENO.md` + maqueta. · Que Claude Code no improvise estilos.
- 2026-11-17 · Las monedas se llaman "monedas" por defecto y el nombre es editable por negocio (singular y plural). · Cada negocio puede tematizarlas (granos, panes…) sin tocar código.
- 2026-11-17 · Club con monedas canjeables en catálogo, no tarjeta de sellos fija. · Menos rígido; el cliente decide cuándo canjear, y el nivel usa el total ganado para que canjear no castigue.
- 2026-11-17 · La ruleta solo sugiere platos; el bono de ruleta es fijo y lo confirma la caja. · El azar no puede decidir premios sin autorización de Coljuegos.
- 2026-11-17 · Reseñas de Google nunca dan monedas. · Política de Google prohíbe incentivos por reseñas.
- 2026-11-16 · Cloudflare Pages en vez de Vercel. · El plan gratis de Cloudflare permite uso comercial.
- 2026-11-20 · El proyecto lo puede construir Claude u otro modelo: `AGENTS.md` + tarjetas + `npm run verificar`. · Jacobo puede quedarse sin tokens de Claude; las guardas evitan que un modelo más débil dañe el proyecto.
- 2026-11-20 · Componentes de interfaz cerrados (`portal.css`, `nef-ui.css`) y prohibido inventar estilos. · Que cualquier modelo produzca pantallas iguales a la maqueta.
- 2026-11-20 · Landing con precios "Te lo cotizamos" hasta definirlos; "Tócalo tú" oculto hasta que exista la demo. · No mostrar cifras inventadas ni botones rotos.
