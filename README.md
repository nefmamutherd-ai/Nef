# Nef — clientes que vuelven (NFC + QR) · producto de Mamut Herd

Un sistema para vender placas y stickers NFC/QR a negocios (y para tus propias tarjetas de presentación).
El chip **nunca guarda el destino final**: guarda `tudominio.com/t/abc1234`, y desde el panel decides a dónde lleva.

```
Cliente acerca el celular ──► /t/abc1234 ──► se registra el toque ──► página del negocio  (/n/cafe-luna)
                                                                    └─► o directo: menú, reseña, WhatsApp, URL…
```

| Qué | Dirección |
|---|---|
| Lo que va grabado en el chip NFC | `/t/<código>` |
| Lo que va en el QR impreso | `/t/<código>?q` (así sabes cuántos usaron NFC y cuántos QR) |
| Página del negocio | `/n/<slug>` |
| Tu panel | `/admin` |
| Estadísticas para el dueño (link privado) | `/stats?k=<token>` |
| Tag sin activar / negocio que no pagó | `/inactivo` (muestra tu WhatsApp: publicidad gratis) |

**Costo de infraestructura: $0** al empezar (Supabase gratis + Cloudflare Pages gratis, que sí permite uso comercial). Solo pagas el dominio.

---

## Puesta en marcha (≈ 30 minutos)

### 1. Base de datos (Supabase)
1. Crea un proyecto nuevo en supabase.com (región: São Paulo, la más cercana).
2. **SQL Editor → New query** → pega todo `supabase/esquema.sql` → **Run**.
3. **Authentication → Users → Add user** → crea tu usuario con correo y contraseña (marca *Auto confirm*).
4. Conviértete en admin: en SQL Editor corre (con tu correo):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'TU_CORREO@gmail.com';
   ```
5. **Project Settings → API**: copia la **Project URL** y la **anon public key**.

> Ojo: en el plan gratis, Supabase pausa el proyecto si pasa ~1 semana sin actividad. Cuando haya tags en uso no pasa, pero al principio entra al panel de vez en cuando.

### 2. Sitio (Cloudflare Pages)
1. Sube esta carpeta a un repo de GitHub (privado).
2. En dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → elige el repo.
3. Configuración de build:
   - Framework preset: **None**
   - Build command: *(vacío)*
   - Build output directory: **`public`**
4. **Settings → Variables and Secrets** (en Production):
   | Variable | Valor |
   |---|---|
   | `SUPABASE_URL` | la Project URL |
   | `SUPABASE_ANON_KEY` | la anon public key |
   | `CONTACTO_WHATSAPP` | tu número, ej. `3001234567` |
   | `MARCA` | el nombre del producto, ej. `Nef` |
5. **Deployments → Retry deployment** para que tome las variables.
6. **Custom domains**: conecta tu dominio. Entre más corto, mejor (el QR queda más limpio y el link cabe sobrado en el chip).

Entra a `tudominio.com/admin` con tu usuario. Listo.

### Probar en tu computador (opcional)
```bash
npm install
npx playwright install chromium
cp tests/dev.vars.ejemplo .dev.vars
npm run test:sql     # prueba la base de datos
npm run mock         # terminal 1: Supabase de mentiras
npm run dev          # terminal 2: el sitio en http://127.0.0.1:8788
npm run test:e2e     # terminal 3: recorrido completo con capturas
```

### Seguir construyendo con Claude Code
Abre esta carpeta con Claude Code y escribe **`/siguiente-fase`**. Qué es el producto: `docs/PRODUCTO.md`; orden de construcción: `docs/PLAN.md`; marca: `docs/marca/`.
El diseño aprobado está en `docs/diseno/maqueta.html` (ábrelo en el navegador).
Ahí está todo lo que necesita para trabajar solo y probar lo que hace.

---

## Operación del día a día

### Comprar tags
- **Stickers NTAG213** (redondos de 25–30 mm): los más baratos, sirven para placas, mesas y tarjetas. NTAG215 también sirve.
- **Si van sobre metal** (mesas metálicas, neveras): compra tags *anti-metal*; los normales no leen.
- Debajo de acrílico de hasta ~3 mm leen bien. Prueba siempre uno antes de pedir 100 placas.

### Grabar los chips (con el celular, app gratis **NFC Tools**)
1. En el panel → **Tags** → crea, por ejemplo, 50 tags **sin asignar**.
2. Selecciónalos → **Copiar links NFC** (o botón *Link NFC* de cada uno).
3. NFC Tools → **Escribir → Agregar registro → URL** → pega el link → **Escribir** → acerca el sticker.
4. Recomendado: **Otros → Bloquear etiqueta**. Es permanente, pero como el link es dinámico no lo necesitas cambiar nunca, y así nadie puede regrabarlo con otro link.
5. Cuando un negocio compre, asigna esos tags desde el panel (**Asignar seleccionados a…**). Cero regrabado.

### QR
En **Tags** → filtra por negocio → selecciona → **Imprimir QR**. Sale una hoja con guías de corte, nombre del negocio y de la mesa.
**Siempre pon NFC + QR juntos**: muchos Android traen el NFC apagado y hay gente que no sabe que puede acercar el celular.

### Montar un cliente nuevo (≈ 10 min)
1. **Negocios → + Nuevo negocio**: nombre, color, logo, link del menú, link de reseñas de Google, WhatsApp, WiFi…
   - *Link de reseñas*: en el Perfil de Empresa de Google del negocio → "Pedir reseñas" → copiar.
   - *Menú*: puede ser un PDF en Google Drive (compartido "cualquiera con el link"), su página o una carta digital.
2. Asigna o crea sus tags (ej. "Mesa 1…12", "Caja", "Barra").
3. Por defecto cada tag abre la página del negocio. Si quieres que una placa vaya **directo** a reseñas (ej. la de la caja), cámbiale "Al tocar abre…".
4. **Link estadísticas** → envíaselo al dueño por WhatsApp. Ahí ve toques por día, horas pico, qué mesa se usa más y cuántos fueron a dejar reseña.

### Si un cliente deja de pagar
Edita el negocio → desmarca **Activo**. Sus tags muestran "Este código aún no está activo" con tu WhatsApp. Lo reactivas y vuelve a funcionar al instante.

### Tus tarjetas de Mamut Herd
Crea un negocio "Mamut Herd" (o uno por proyecto) con los botones a cada web en "Otros botones", crea un tag "Tarjeta Jacobo", grábalo en tus tarjetas, y listo: te sirven de demo en vivo cuando le vendes a un negocio.

---

## Estructura
```
supabase/esquema.sql        Tablas, seguridad (RLS) y funciones públicas
functions/t/[codigo].js     El toque: registra y redirige
functions/n/[slug].js       Página del negocio (se arma en el servidor, carga al instante)
functions/c/[slug]/[boton].js  Registra clics en los botones y redirige
functions/inactivo.js       Tag sin activar
functions/api/config.js     Config pública para el panel
lib/util.js                 Utilidades compartidas
public/admin.html           Tu panel
public/stats.html           Estadísticas para el dueño del negocio
public/index.html           Página de venta simple
public/assets/              Gráficas y generador de QR (qrcode-generator, licencia MIT)
```

## Seguridad, en corto
- Las tablas están cerradas con RLS: solo tu usuario admin las lee y edita.
- Lo público son 4 funciones que exponen solo lo necesario (nunca notas, contactos ni el token de estadísticas).
- La anon key es pública por diseño en Supabase; la protección está en esas reglas.
- Los links de los botones solo aceptan `http/https`.

## Ideas para la versión 2
- Que el dueño edite su menú/promo él mismo (login por negocio) → justifica un plan más caro.
- Tarjeta de lealtad "toca y suma sello".
- Menú digital propio dentro de la página (en vez de un PDF).
- Límite de toques por minuto para evitar spam en las estadísticas.
