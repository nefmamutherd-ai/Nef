Revisa la seguridad antes de cerrar una fase. Reporta hallazgos con archivo y línea; arregla lo que sea claro.
- Toda tabla nueva tiene RLS activado y políticas; anon no puede leerla directo (agrega la prueba en `tests/test_sql.mjs`).
- Toda columna nueva sensible (teléfonos, notas, tokens, PIN) no sale por ninguna RPC pública. Revisa cada `json_build_object`.
- Funciones internas tienen `revoke execute ... from public, anon, authenticated`.
- Toda RPC `security definer` tiene `set search_path`.
- Todo texto que llega al HTML pasa por `esc()`; todo link de usuario por `urlSegura()`.
- PIN de caja: hash con `extensions.crypt`, bloqueo por intentos.
- No hay llaves (`service_role`, contraseñas) en el código ni en los commits. `.dev.vars` está en `.gitignore`.
- Las 4 reglas de negocio de `CLAUDE.md` siguen intactas (reseñas sin premio, azar sin premio, autorización de datos, monedas solo en caja).
