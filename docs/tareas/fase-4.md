# Fase 4 — Estadísticas nivel 1 + soporte del estudio

> Modo estricto (`AGENTS.md` §3). Definiciones: `docs/PRODUCTO.md` §8. Flujo: `docs/ARQUITECTURA.md` §6
> (hechos → `metricas_diarias` → paneles).

### [x] 4.1 `metricas_diarias` y recálculo
**Archivos:** `supabase/esquema.sql`, `tests/test_sql.mjs`
**Pasos:** tabla `metricas_diarias(negocio_id, fecha date, metrica text, valor numeric, detalle jsonb, primary key (negocio_id, fecha, metrica))` (4 partes).
Funciones `metrica_*` que falten de §8 (visitas_portal, inscritos, frecuencia, retorno_30, conversion_resena, devolucion_real,
uso_maquinas). `recalcular_metricas(p_negocio uuid, p_desde date)` → borra y vuelve a escribir solo ese rango con `insert ... on conflict do update`.
Interna (revoke anon/authenticated; el admin la llama con una RPC envoltorio `admin_recalcular` que valida `es_admin()`).
**Comprobar:** [x] recalcular dos veces da los mismos valores · [x] cada métrica tiene una prueba con datos conocidos (puedes reutilizar el CSV de 3.3).

### [x] 4.2 Cálculo nocturno
**Archivos:** `supabase/cron.sql` (nuevo)
**Pasos:** `create extension if not exists pg_cron;` + `cron.schedule('nef-metricas', '0 7 * * *', $$select public.recalcular_todo(current_date - 2)$$)`
(7:00 UTC = 2:00 a. m. Bogotá). `recalcular_todo` recorre negocios activos. Comentario arriba: "Se corre a mano en Supabase una vez; las pruebas no lo usan".
**Comprobar:** [x] `recalcular_todo` existe en `esquema.sql` y tiene prueba · [x] `cron.sql` no está incluido en `test_sql.mjs`.

### [x] 4.3 Paneles con definiciones visibles
**Archivos:** `supabase/esquema.sql` (`stats_admin`, `stats_token`), `public/stats.html`, `public/assets/stats.js`, e2e
**Pasos:** las stats leen `metricas_diarias` para días pasados + cálculo en vivo para hoy. Bloques por sector. Cada número
con `.n-def` y la definición **exacta** de §8. Rehaz `stats.html` con `nef-ui.css` (`docs/UI.md` "Resumen del dueño").
**Comprobar:** [x] e2e: cada `.n-kpi` tiene `.n-def[data-def]` no vacío · [x] capturas 390/1280 revisadas.

### [x] 4.4 Exportar para el estudio (solo admin)
**Archivos:** `supabase/esquema.sql`, `public/admin.html`, `public/assets/exportar.js` (nuevo), pruebas
**Pasos:** RPC `exportar_estudio(p_negocio, p_desde, p_hasta)` (solo admin) devuelve JSON con `visitas`, `clientes`, `canjes`,
`entradas` usando **ids anonimizados**: `md5(id::text || p_sal)` donde `p_sal` es aleatoria por exportación (no se guarda).
Sin nombres ni teléfonos. El navegador arma 4 CSV + `LEEME.txt` (diccionario: columna, tipo, significado) y los descarga uno por uno.
**Comprobar:** [x] prueba SQL: el JSON exportado no contiene `telefono`, `nombre` ni ningún teléfono de los datos de prueba (busca el texto) · [x] e2e: descarga de los 5 archivos.

### [x] 4.5 Informes en PDF para el dueño
**Archivos:** `supabase/storage.sql` (nuevo), `supabase/esquema.sql`, `public/admin.html`, `public/stats.html`, pruebas
**Pasos:** bucket privado `informes` (en `storage.sql`, con políticas: solo admin sube). Tabla `informes(id, negocio_id, periodo text, ruta text, creado)` (4 partes).
Admin sube PDF (máx. 10 MB) → fila en `informes`. El dueño ve "Informe del trimestre" con URL firmada de 1 hora
(RPC envoltorio o Function `functions/api/informe.js` que valida el token del dueño y pide la URL firmada **con la anon key + RLS**,
nunca con `service_role`). El mock no tiene Storage: en e2e intercepta `/storage/v1/` como ya se hace.
**Comprobar:** [x] un token de otro negocio no obtiene la URL (prueba) · [x] verificar --e2e ✓.

### [x] 4.6 Plantilla del estudio
**Archivos:** `docs/ESTUDIO.md`, `estudio/plantilla.R` (nuevos)
**Pasos:** `ESTUDIO.md`: secciones del informe (resumen en 5 líneas, descriptivo, la pregunta del dueño, método, resultado,
3 acciones, advertencias de muestra), qué prueba usar por pregunta (antes/después → Wilcoxon/t pareada o ITS; quién se va → regresión logística;
cuánto dura un socio → Kaplan-Meier + log-rank; afluencia → modelo de conteo/Poisson por hora), y el mínimo de datos para hacer inferencia.
`plantilla.R`: lee los 4 CSV de 4.4 con rutas relativas, limpia, descriptivos, y un ejemplo comentado de cada método (paquetes: `survival`, `ggplot2`, `dplyr`).
**Comprobar:** [x] `Rscript estudio/plantilla.R` corre con un CSV de ejemplo (probado con R 4.6.1 sobre una exportación de prueba).

### [x] 4.7 Cierre de la fase 4
[x] Criterios de la Fase 4 de `docs/PLAN.md` · [x] PROGRESO.md · [x] `git push origin desarrollo`.
