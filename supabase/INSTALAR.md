# Instalar Nef en un proyecto de Supabase (paso a paso, para Jacobo)

> Hazlo tú desde el navegador. Ninguna contraseña ni llave secreta se pega en el chat ni en el código.
> Lo único que va en el hosting es la URL del proyecto y la llave **pública** (`sb_publishable_…` o la "anon" antigua).

## 0. Seguridad primero
- Si alguna vez escribiste la contraseña de la base de datos en un chat o un archivo, **cámbiala**:
  Supabase → Project Settings → Database → **Reset database password**.
- La llave `service_role` / `sb_secret_…` **nunca** se usa en Nef. Si la ves, no la copies a ningún lado.

## 1. Crear las tablas (una sola vez; se puede repetir sin dañar nada)
1. Supabase → **SQL Editor** → **New query**.
2. Abre `supabase/esquema.sql` en VS Code, selecciona todo (Ctrl+A), copia y pégalo en el editor → **Run**.
   Debe terminar con "Success. No rows returned".
3. Nueva consulta → pega `supabase/storage.sql` → **Run** (crea los buckets `informes` y `fotos`).
4. Database → **Extensions** → busca **pg_cron** → actívalo. Luego nueva consulta → pega `supabase/cron.sql` → **Run**
   (calcula las estadísticas cada noche a las 2:00 a. m.).
5. (Opcional, para mostrar a clientes) nueva consulta → pega `supabase/demo.sql` → **Run**: crea `/n/demo-cafe` y `/n/demo-gym`
   y hace aparecer el botón "Tócalo tú" en la landing.

## 2. Crear tu usuario de administrador
1. Supabase → **Authentication** → **Users** → **Add user** → *Create new user*: tu correo y una contraseña fuerte,
   marca **Auto Confirm User**.
2. SQL Editor → nueva consulta (cambia el correo):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'tu-correo@ejemplo.com'
   on conflict do nothing;
   ```
3. Authentication → **URL Configuration** → *Site URL*: la dirección donde publiques Nef (ej. `https://nef.pages.dev`).

## 3. Publicar (recomendado: Cloudflare Pages, gratis y permite uso comercial)
1. dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → repositorio `Nef`.
2. Production branch: `main` (la rama `desarrollo` queda como vista previa). Framework preset: **None**.
   Build command: *(vacío)*. Build output directory: `public`.
3. **Environment variables** (en Production y en Preview):

   | Nombre | Valor |
   |---|---|
   | `SUPABASE_URL` | `https://<tu-proyecto>.supabase.co` (Project Settings → API → Project URL) |
   | `SUPABASE_ANON_KEY` | la llave **publishable** (`sb_publishable_…`) o la "anon" antigua |
   | `CONTACTO_WHATSAPP` | tu WhatsApp de ventas, 10 dígitos (ej. `3001234567`) |
   | `MARCA` | `Nef` |

   Ojo: Nef usa estos nombres exactos. `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` son de Next.js y aquí no sirven.
4. **Save and Deploy**. Te queda una dirección gratis tipo `https://nef-xxx.pages.dev`.

**Vercel** solo sirve para la landing (no ejecuta las funciones de `functions/`). Si la tienes ahí, basta con `CONTACTO_WHATSAPP`.

## 4. Probar que todo funciona (5 minutos)
1. `https://<tu-dirección>/admin` → entra con tu correo → crea un negocio (sector, servicios, link de reseña, WiFi).
2. Pestaña **Tags** → crea 3 tags para ese negocio → "Copiar links NFC" → grábalos en los chips con la app *NFC Tools*
   (Escribir → Agregar registro → URL). "Imprimir QR" para las versiones en papel.
3. Acerca tu celular al chip: debe abrir el portal del negocio.
4. Si activaste el Club: pon un PIN de caja en el negocio, inscríbete desde el portal ("Mis monedas") y suma una visita en
   `https://<tu-dirección>/caja/<slug-del-negocio>`.
5. Estadísticas: pestaña **Estadísticas** → "Link estadísticas" para enviárselo al dueño.

## 5. Si algo falla
- "Estamos teniendo un problema": revisa que `SUPABASE_URL` y `SUPABASE_ANON_KEY` estén bien escritas en el hosting.
- El admin dice "este usuario no es administrador": falta el paso 2.2.
- Las fotos o los informes no suben: falta `storage.sql` (paso 1.3).
