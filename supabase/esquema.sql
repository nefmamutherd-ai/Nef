-- =====================================================================
--  TOQUE · esquema de base de datos (Supabase / Postgres)
--  Pega TODO este archivo en Supabase → SQL Editor → Run.
--  Se puede volver a correr sin romper nada (usa "if not exists").
-- =====================================================================

-- ---------- Administradores (tú) ------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Generador de códigos cortos (sin i, l, o, 0, 1) ---------
create or replace function public.gen_codigo()
returns text language sql volatile as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', (floor(random() * 31) + 1)::int, 1), '')
  from generate_series(1, 7);
$$;

-- ---------- Negocios (tus clientes) ---------------------------------
create table if not exists public.negocios (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  nombre            text not null,
  descripcion       text,
  logo_url          text,
  color             text not null default '#1f1f1f' check (color ~ '^#[0-9a-fA-F]{6}$'),
  menu_url          text,
  resena_url        text,      -- link directo para dejar reseña en Google
  whatsapp          text,      -- ej: 3001234567 o 573001234567
  instagram         text,      -- ej: @micafe
  wifi_nombre       text,
  wifi_clave        text,
  links             jsonb not null default '[]'::jsonb,  -- [{"titulo": "...", "url": "..."}]
  activo            boolean not null default true,       -- si no paga: false → sus tags muestran "inactivo"
  plan              text not null default 'basico',
  token_stats       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  contacto_nombre   text,
  contacto_telefono text,
  notas             text,      -- privado, solo lo ves tú
  creado            timestamptz not null default now()
);

-- ---------- Tags (cada sticker / placa / tarjeta) -------------------
create table if not exists public.tags (
  id                uuid primary key default gen_random_uuid(),
  codigo            text not null unique default public.gen_codigo() check (codigo ~ '^[a-z0-9]{4,16}$'),
  negocio_id        uuid references public.negocios(id) on delete set null,
  nombre            text,      -- ej: "Mesa 3", "Caja", "Tarjeta Jacobo"
  destino           text not null default 'hub'
                    check (destino in ('hub', 'menu', 'resena', 'whatsapp', 'instagram', 'wifi', 'url')),
  url_personalizada text,
  activo            boolean not null default true,
  creado            timestamptz not null default now()
);
create index if not exists tags_negocio_idx on public.tags(negocio_id);

-- ---------- Registro de toques y clics ------------------------------
create table if not exists public.toques (
  id          bigint generated always as identity primary key,
  tag_id      uuid not null references public.tags(id) on delete cascade,
  negocio_id  uuid references public.negocios(id) on delete cascade,
  medio       text not null check (medio in ('nfc', 'qr')),
  dispositivo text,
  creado      timestamptz not null default now()
);
create index if not exists toques_negocio_fecha_idx on public.toques(negocio_id, creado);

create table if not exists public.clicks (
  id          bigint generated always as identity primary key,
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  tag_id      uuid references public.tags(id) on delete set null,
  boton       text not null,
  creado      timestamptz not null default now()
);
create index if not exists clicks_negocio_fecha_idx on public.clicks(negocio_id, creado);

-- ---------- Seguridad: solo el admin toca las tablas directamente ---
alter table public.admins   enable row level security;
alter table public.negocios enable row level security;
alter table public.tags     enable row level security;
alter table public.toques   enable row level security;
alter table public.clicks   enable row level security;

drop policy if exists admin_todo on public.negocios;
drop policy if exists admin_todo on public.tags;
drop policy if exists admin_todo on public.toques;
drop policy if exists admin_todo on public.clicks;
drop policy if exists admin_ver  on public.admins;
create policy admin_todo on public.negocios for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy admin_todo on public.tags     for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy admin_todo on public.toques   for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy admin_todo on public.clicks   for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy admin_ver  on public.admins   for select to authenticated using (user_id = auth.uid());

-- =====================================================================
--  Funciones públicas (las llama el sitio sin login). Son la ÚNICA
--  puerta pública: no exponen notas, contactos ni datos de otros.
-- =====================================================================

-- resolver_toque (un toque NFC/QR) y negocio_publico (datos de la página del negocio)
-- se definen en el bloque "Fase 1" al final: usan columnas que se agregan allá.

-- Clic en un botón de la página del negocio
create or replace function public.registrar_click(p_slug text, p_boton text, p_codigo text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  n public.negocios;
  v_tag uuid;
begin
  select * into n from public.negocios where slug = lower(trim(p_slug)) and activo;
  if not found then return null; end if;
  if p_boton !~ '^(menu|resena|whatsapp|instagram|wifi|link[0-9]{1,2})$' then
    return public.negocio_publico(p_slug);
  end if;
  select id into v_tag from public.tags where codigo = lower(trim(p_codigo)) and negocio_id = n.id;
  insert into public.clicks (negocio_id, tag_id, boton) values (n.id, v_tag, p_boton);
  return public.negocio_publico(p_slug);
end $$;

-- ---------- Estadísticas --------------------------------------------
-- Interna (no pública): arma todas las cifras de un negocio
create or replace function public._stats_negocio(p_negocio uuid, p_dias int)
returns json language sql stable security definer set search_path = public as $$
  with
  rango as (
    select ((now() at time zone 'America/Bogota')::date - (greatest(1, least(p_dias, 365)) - 1)) as desde,
           (now() at time zone 'America/Bogota')::date as hoy
  ),
  tq as (
    select q.*, (q.creado at time zone 'America/Bogota') as local
    from public.toques q, rango
    where q.negocio_id = p_negocio and q.creado >= (rango.desde::timestamp at time zone 'America/Bogota')
  ),
  ck as (
    select c.* from public.clicks c, rango
    where c.negocio_id = p_negocio and c.creado >= (rango.desde::timestamp at time zone 'America/Bogota')
  )
  select json_build_object(
    'dias',   greatest(1, least(p_dias, 365)),
    'total',  (select count(*) from tq),
    'nfc',    (select count(*) from tq where medio = 'nfc'),
    'qr',     (select count(*) from tq where medio = 'qr'),
    'resenas',(select count(*) from ck where boton = 'resena'),
    'por_dia', (
      select coalesce(json_agg(json_build_object('dia', d.dia, 'n', coalesce(c.n, 0)) order by d.dia), '[]'::json)
      from (select generate_series(r.desde, r.hoy, interval '1 day')::date as dia from rango r) d
      left join (select local::date as dia, count(*) as n from tq group by 1) c on c.dia = d.dia
    ),
    'por_hora', (
      select json_agg(coalesce(c.n, 0) order by h.h)
      from generate_series(0, 23) h(h)
      left join (select extract(hour from local)::int as h, count(*) as n from tq group by 1) c on c.h = h.h
    ),
    'por_tag', (
      select coalesce(json_agg(x order by x.n desc, x.nombre), '[]'::json)
      from (
        select coalesce(t.nombre, t.codigo) as nombre, t.codigo, count(tq.id) as n
        from public.tags t left join tq on tq.tag_id = t.id
        where t.negocio_id = p_negocio
        group by t.id
      ) x
    ),
    'clicks', (
      select coalesce(json_agg(x order by x.n desc), '[]'::json)
      from (select boton, count(*) as n from ck group by boton) x
    ),
    'dispositivos', (
      select coalesce(json_object_agg(coalesce(dispositivo, 'otro'), n), '{}'::json)
      from (select dispositivo, count(*) as n from tq group by dispositivo) x
    ),
    'links', (select links from public.negocios where id = p_negocio)
  );
$$;

-- Para tu panel (exige ser admin)
create or replace function public.stats_admin(p_negocio uuid, p_dias int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'no autorizado';
  end if;
  return public._stats_negocio(p_negocio, p_dias);
end $$;

-- Para el link privado que le compartes al dueño del negocio
create or replace function public.stats_token(p_token text, p_dias int default 30)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('negocio', n.nombre, 'color', n.color, 'stats', public._stats_negocio(n.id, p_dias))
  from public.negocios n where n.token_stats = p_token;
$$;

-- ---------- Permisos de ejecución -----------------------------------
revoke execute on function public._stats_negocio(uuid, int) from public;
do $$ begin
  revoke execute on function public._stats_negocio(uuid, int) from anon, authenticated;
exception when undefined_object then null; end $$;

grant execute on function public.registrar_click(text, text, text) to anon, authenticated;
grant execute on function public.stats_token(text, int)            to anon, authenticated;
grant execute on function public.stats_admin(uuid, int)            to authenticated;
grant execute on function public.es_admin()                        to authenticated;

-- =====================================================================
-- ===== Fase 1 =====  cuentas (empresas, accesos), sector, servicios,
-- hora reemplazable en pruebas y antispam de toques.
-- =====================================================================

-- Hora "de negocio": las pruebas la fijan con  set nef.ahora = '2026-11-22 10:00-05'
create or replace function public._ahora()
returns timestamptz language sql stable as $$
  select coalesce(nullif(current_setting('nef.ahora', true), '')::timestamptz, now())
$$;

-- ---------- Empresas (quien paga) y accesos de dueños/gerentes -------
create table if not exists public.empresas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  nit             text,
  plan            text not null default 'base',
  estado_pago     text not null default 'al_dia' check (estado_pago in ('al_dia', 'por_vencer', 'vencido')),
  club_compartido boolean not null default false,
  creado          timestamptz not null default now()
);
alter table public.empresas enable row level security;
drop policy if exists admin_todo on public.empresas;
create policy admin_todo on public.empresas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create table if not exists public.accesos (
  user_id    uuid not null,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  rol        text not null check (rol in ('dueno', 'gerente')),
  creado     timestamptz not null default now(),
  primary key (user_id, empresa_id)
);
create index if not exists accesos_empresa_idx on public.accesos(empresa_id);
alter table public.accesos enable row level security;
drop policy if exists admin_todo on public.accesos;
create policy admin_todo on public.accesos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------- Negocios: empresa, sector, servicios, ubicación -----------
alter table public.negocios add column if not exists empresa_id uuid references public.empresas(id) on delete set null;
alter table public.negocios add column if not exists sector text not null default 'cafe'
  check (sector in ('cafe', 'gimnasio'));
alter table public.negocios add column if not exists servicios jsonb not null
  default '{"base":true,"catalogo":false,"club":false,"estudio":false}'::jsonb;
alter table public.negocios add column if not exists ubicacion_etiqueta text;
create index if not exists negocios_empresa_idx on public.negocios(empresa_id);

-- Migración: cada negocio sin empresa recibe una empresa con su mismo nombre
do $$
declare
  r record;
  v_empresa uuid;
begin
  for r in select id, nombre from public.negocios where empresa_id is null loop
    insert into public.empresas (nombre) values (r.nombre) returning id into v_empresa;
    update public.negocios set empresa_id = v_empresa where id = r.id;
  end loop;
end $$;

-- ---------- Antispam: un toque por dispositivo y tag cada 30 min ------
alter table public.toques add column if not exists dispositivo_id uuid;
create index if not exists toques_tag_disp_idx on public.toques(tag_id, dispositivo_id, creado);

-- La versión vieja (3 parámetros) se reemplaza por la de 4; se borra para que no haya ambigüedad.
drop function if exists public.resolver_toque(text, text, text);

-- Un toque (NFC o QR): registra y devuelve a dónde mandar a la persona.
-- p_dispositivo_id viene de la cookie anónima nef_d (sin datos personales).
create or replace function public.resolver_toque(
  p_codigo text, p_medio text default 'nfc', p_dispositivo text default null, p_dispositivo_id uuid default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  t public.tags;
  n public.negocios;
begin
  select * into t from public.tags where codigo = lower(trim(p_codigo));
  if not found then
    return json_build_object('estado', 'no_existe');
  end if;
  if not t.activo or t.negocio_id is null then
    return json_build_object('estado', 'inactivo');
  end if;
  select * into n from public.negocios where id = t.negocio_id;
  if not n.activo or not public._negocio_habilitado(n.id) then  -- apagado o mensualidad vencida (+ gracia)
    return json_build_object('estado', 'inactivo');
  end if;

  -- Si el mismo dispositivo tocó este tag hace menos de 30 min, no se cuenta otra vez (pero igual entra)
  if p_dispositivo_id is null or not exists (
    select 1 from public.toques q
    where q.tag_id = t.id and q.dispositivo_id = p_dispositivo_id
      and q.creado > public._ahora() - interval '30 minutes'
  ) then
    insert into public.toques (tag_id, negocio_id, medio, dispositivo, dispositivo_id, creado)
    values (t.id, n.id, case when p_medio = 'qr' then 'qr' else 'nfc' end, left(p_dispositivo, 20),
            p_dispositivo_id, public._ahora());
  end if;

  return json_build_object(
    'estado', 'ok', 'destino', t.destino, 'slug', n.slug, 'url', t.url_personalizada, 'producto_id', t.producto_id,
    'menu_url', n.menu_url, 'resena_url', n.resena_url, 'whatsapp', n.whatsapp, 'instagram', n.instagram
  );
end $$;

-- Datos públicos para la página del negocio (nada privado: ni notas, ni contacto, ni empresa, ni tokens)
create or replace function public.negocio_publico(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'slug', slug, 'nombre', nombre, 'descripcion', descripcion, 'logo_url', logo_url, 'color', color,
    'menu_url', menu_url, 'resena_url', resena_url, 'whatsapp', whatsapp, 'instagram', instagram,
    'wifi_nombre', wifi_nombre, 'wifi_clave', wifi_clave, 'links', links,
    'sector', sector, 'servicios', servicios, 'ubicacion_etiqueta', ubicacion_etiqueta
  )
  from public.negocios where slug = lower(trim(p_slug)) and activo;
$$;

grant execute on function public.resolver_toque(text, text, text, uuid) to anon, authenticated;
grant execute on function public.negocio_publico(text)                  to anon, authenticated;

-- Nombre del tag ("Mesa 4", "Máquina 12") para la cabeza del portal; solo si el tag es de ese negocio
create or replace function public.tag_publico(p_slug text, p_codigo text)
returns text language sql stable security definer set search_path = public as $$
  select t.nombre
  from public.tags t join public.negocios n on n.id = t.negocio_id
  where n.slug = lower(trim(p_slug)) and n.activo and t.activo and t.codigo = lower(trim(p_codigo));
$$;
grant execute on function public.tag_publico(text, text) to anon, authenticated;

-- =====================================================================
-- ===== Fase 2 =====  club de monedas + caja (PIN, sesión, sin conexión)
-- Regla de oro: las monedas solo las suma la caja. Nada de valor se gana visitando un link.
-- =====================================================================

-- ---------- Negocios: reglas del club ---------------------------------
alter table public.negocios add column if not exists devolucion_pct int not null default 5 check (devolucion_pct in (3, 5, 8));
alter table public.negocios add column if not exists modo_monedas text not null default 'visita' check (modo_monedas in ('visita', 'valor'));
alter table public.negocios add column if not exists monedas_por_visita int not null default 10 check (monedas_por_visita between 0 and 1000);
alter table public.negocios add column if not exists bienvenida int not null default 50 check (bienvenida between 0 and 10000);
alter table public.negocios add column if not exists horas_entre_visitas int not null default 3 check (horas_entre_visitas between 0 and 72);
alter table public.negocios add column if not exists moneda_plural text not null default 'monedas';
alter table public.negocios add column if not exists moneda_singular text not null default 'moneda';
alter table public.negocios add column if not exists pin_caja_hash text;   -- privado: nunca sale por una RPC

-- Tags: destino nuevo "club" (abre la tarjeta del cliente)
alter table public.tags drop constraint if exists tags_destino_check;
alter table public.tags add constraint tags_destino_check
  check (destino in ('hub', 'menu', 'resena', 'whatsapp', 'instagram', 'wifi', 'url', 'club', 'producto', 'entrada'));  -- lista completa: el esquema se corre muchas veces

-- 1 moneda = $100 en premios. Costo de un premio = ceil(valor_pesos / 100).
-- Ganar en modo valor: compra × devolucion_pct / 100 / 100  (ej. $160.000 al 5 % = $8.000 = 80 monedas).
create or replace function public.valor_moneda()
returns int language sql immutable as $$ select 100 $$;
grant execute on function public.valor_moneda() to anon, authenticated;

create or replace function public.costo_premio(p_valor_pesos int)
returns int language sql immutable as $$ select ceil(p_valor_pesos::numeric / public.valor_moneda())::int $$;
grant execute on function public.costo_premio(int) to anon, authenticated;

-- Celular colombiano: 10 dígitos que empiezan por 3 → 57 + número. Otro formato → null.
create or replace function public._normalizar_telefono(p text)
returns text language sql immutable as $$
  select case
    when d ~ '^3[0-9]{9}$' then '57' || d
    when d ~ '^573[0-9]{9}$' then d
    else null end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x
$$;

-- ---------- Personas: clientes (global por celular) y membresías -----
create table if not exists public.clientes (
  id       uuid primary key default gen_random_uuid(),
  telefono text not null unique check (telefono ~ '^573[0-9]{9}$'),
  nombre   text not null check (char_length(nombre) between 2 and 60),
  creado   timestamptz not null default now()
);
alter table public.clientes enable row level security;
drop policy if exists admin_todo on public.clientes;
create policy admin_todo on public.clientes for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create table if not exists public.membresias (
  id                   uuid primary key default gen_random_uuid(),
  cliente_id           uuid not null references public.clientes(id) on delete cascade,
  negocio_id           uuid not null references public.negocios(id) on delete cascade,
  token                text not null unique default replace(gen_random_uuid()::text, '-', ''),
  saldo                int not null default 0 check (saldo >= 0),
  total_ganado         int not null default 0,
  visitas              int not null default 0,
  bienvenida_pendiente int not null default 0,
  ultima_visita        timestamptz,
  vence                timestamptz,
  acepto_datos_at      timestamptz not null,
  creado               timestamptz not null default now(),
  unique (cliente_id, negocio_id)
);
create index if not exists membresias_negocio_idx on public.membresias(negocio_id, creado);
alter table public.membresias enable row level security;
drop policy if exists admin_todo on public.membresias;
create policy admin_todo on public.membresias for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------- Premios (el dueño pone el valor en pesos; el costo se calcula)
create table if not exists public.premios (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 80),
  valor_pesos int not null check (valor_pesos > 0),
  activo      boolean not null default true,
  orden       int not null default 0,
  creado      timestamptz not null default now()
);
create index if not exists premios_negocio_idx on public.premios(negocio_id);
alter table public.premios enable row level security;
drop policy if exists admin_todo on public.premios;
create policy admin_todo on public.premios for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------- Hechos: movimientos de monedas y operaciones de caja -------
create table if not exists public.movimientos (
  id           bigint generated always as identity primary key,
  membresia_id uuid not null references public.membresias(id) on delete cascade,
  negocio_id   uuid not null references public.negocios(id) on delete cascade,
  tipo         text not null check (tipo in ('bienvenida', 'visita', 'bono_hora_dorada', 'bono_racha',
                                             'bono_ruleta', 'canje', 'ajuste', 'vencimiento')),
  monedas      int not null,              -- + gana, − canjea o vence
  valor_compra int,                       -- pesos, solo visitas en modo valor (para "devolución real")
  premio_id    uuid references public.premios(id) on delete set null,
  op_id        uuid unique,               -- id de la operación de caja (idempotencia)
  detalle      text,
  creado       timestamptz not null default now()
);
create index if not exists movimientos_negocio_idx on public.movimientos(negocio_id, creado);
create index if not exists movimientos_membresia_idx on public.movimientos(membresia_id, creado);
alter table public.movimientos enable row level security;
drop policy if exists admin_todo on public.movimientos;
create policy admin_todo on public.movimientos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Cada operación de la caja (sumar/canjear) con su resultado: reenviar el mismo op_id devuelve lo mismo
create table if not exists public.operaciones_caja (
  op_id        uuid primary key,
  negocio_id   uuid not null references public.negocios(id) on delete cascade,
  membresia_id uuid references public.membresias(id) on delete cascade,
  tipo         text not null check (tipo in ('visita', 'canje')),
  resultado    jsonb,
  creado       timestamptz not null default now()
);
create index if not exists operaciones_caja_negocio_idx on public.operaciones_caja(negocio_id, creado);
alter table public.operaciones_caja enable row level security;
drop policy if exists admin_todo on public.operaciones_caja;
create policy admin_todo on public.operaciones_caja for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------- Caja: sesiones e intentos de PIN --------------------------
create table if not exists public.sesiones_caja (
  token      text primary key default replace(gen_random_uuid()::text, '-', ''),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  expira     timestamptz not null,
  creado     timestamptz not null default now()
);
create index if not exists sesiones_caja_negocio_idx on public.sesiones_caja(negocio_id);
alter table public.sesiones_caja enable row level security;
drop policy if exists admin_todo on public.sesiones_caja;
create policy admin_todo on public.sesiones_caja for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create table if not exists public.intentos_pin (
  id         bigint generated always as identity primary key,
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  ok         boolean not null,
  creado     timestamptz not null default now()
);
create index if not exists intentos_pin_negocio_idx on public.intentos_pin(negocio_id, creado);
alter table public.intentos_pin enable row level security;
drop policy if exists admin_todo on public.intentos_pin;
create policy admin_todo on public.intentos_pin for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
--  RPC del club
-- =====================================================================

-- Premios activos de un negocio con su costo; "alcanzable" según un saldo
create or replace function public._premios_json(p_negocio uuid, p_saldo int default null)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', p.id, 'nombre', p.nombre, 'valor_pesos', p.valor_pesos, 'costo', public.costo_premio(p.valor_pesos),
    'alcanzable', p_saldo is not null and p_saldo >= public.costo_premio(p.valor_pesos)
  ) order by p.valor_pesos, p.orden, p.nombre), '[]'::json)
  from public.premios p where p.negocio_id = p_negocio and p.activo;
$$;

-- Condiciones públicas del club (página de registro y de términos — Ley 1480)
create or replace function public.club_publico(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'slug', n.slug, 'nombre', n.nombre, 'club', coalesce((n.servicios->>'club')::boolean, false),
    'bienvenida', n.bienvenida, 'moneda_plural', n.moneda_plural, 'moneda_singular', n.moneda_singular,
    'modo', n.modo_monedas, 'monedas_por_visita', n.monedas_por_visita, 'devolucion_pct', n.devolucion_pct,
    'horas_entre_visitas', n.horas_entre_visitas, 'valor_moneda', public.valor_moneda(),
    'premios', public._premios_json(n.id, null)
  )
  from public.negocios n where n.slug = lower(trim(p_slug)) and n.activo;
$$;

-- Inscripción del cliente (una vez). La bienvenida queda PENDIENTE hasta su primera visita en caja.
create or replace function public.club_registrar(p_slug text, p_nombre text, p_telefono text, p_acepta boolean)
returns json language plpgsql security definer set search_path = public as $$
declare
  n public.negocios;
  v_tel text := public._normalizar_telefono(p_telefono);
  v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_cliente public.clientes;
  v_token text;
begin
  select * into n from public.negocios where slug = lower(trim(p_slug)) and activo;
  if not found or not coalesce((n.servicios->>'club')::boolean, false) then
    return json_build_object('error', 'club');
  end if;
  if p_acepta is distinct from true then return json_build_object('error', 'autorizacion'); end if;
  if char_length(v_nombre) not between 2 and 60 then return json_build_object('error', 'nombre'); end if;
  if v_tel is null then return json_build_object('error', 'telefono'); end if;

  insert into public.clientes (telefono, nombre) values (v_tel, v_nombre) on conflict (telefono) do nothing;
  select * into v_cliente from public.clientes where telefono = v_tel;

  select m.token into v_token from public.membresias m where m.cliente_id = v_cliente.id and m.negocio_id = n.id;
  if v_token is not null then
    -- Ya era miembro: solo devolvemos su tarjeta si el primer nombre coincide (no basta con saber el celular)
    if lower(split_part(v_cliente.nombre, ' ', 1)) <> lower(split_part(v_nombre, ' ', 1)) then
      return json_build_object('error', 'ya_registrado');
    end if;
    return json_build_object('token', v_token, 'nuevo', false);
  end if;

  insert into public.membresias (cliente_id, negocio_id, bienvenida_pendiente, acepto_datos_at)
  values (v_cliente.id, n.id, n.bienvenida, public._ahora())
  returning token into v_token;
  return json_build_object('token', v_token, 'nuevo', true);
end $$;

-- Tarjeta del cliente (se abre con SU token). Nunca devuelve el teléfono.
-- No escribe nada: si las monedas vencieron, las muestra en 0 (el vencimiento lo registra la caja o el cálculo nocturno).
create or replace function public.club_tarjeta(p_slug text, p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  n public.negocios;
  m public.membresias;
  v_nombre text;
  v_saldo int;
  v_cercano json;
  v_semana date;
  v_racha json;
  v_dorada json;
begin
  select * into n from public.negocios where slug = lower(trim(p_slug)) and activo;
  if not found then return json_build_object('error', 'token'); end if;
  select * into m from public.membresias where token = p_token and negocio_id = n.id;
  if not found then return json_build_object('error', 'token'); end if;
  select c.nombre into v_nombre from public.clientes c where c.id = m.cliente_id;
  v_saldo := case when m.vence is not null and m.vence < public._ahora() then 0 else m.saldo end;

  select json_build_object('nombre', p.nombre, 'costo', public.costo_premio(p.valor_pesos),
                           'faltan', public.costo_premio(p.valor_pesos) - v_saldo)
    into v_cercano
  from public.premios p
  where p.negocio_id = n.id and p.activo and public.costo_premio(p.valor_pesos) > v_saldo
  order by p.valor_pesos, p.orden limit 1;

  v_semana := date_trunc('week', (public._ahora() at time zone 'America/Bogota')::date)::date;
  v_racha := public._racha_vigente(m.racha_semanas, m.ultima_semana, m.comodin_mes, v_semana);
  v_dorada := public._hora_dorada(n.id, public._ahora());

  return json_build_object(
    'negocio', n.nombre, 'nombre', v_nombre, 'saldo', v_saldo,
    'bienvenida_pendiente', m.bienvenida_pendiente, 'visitas', m.visitas,
    'ultima_visita', m.ultima_visita, 'vence', m.vence,
    'moneda_plural', n.moneda_plural, 'moneda_singular', n.moneda_singular,
    'premios', public._premios_json(n.id, v_saldo),
    'cercano', v_cercano,
    'nivel', public._nivel(n.id, m.total_ganado),
    'racha', v_racha,
    'hora_dorada', v_dorada,
    'proxima_hora_dorada', case when v_dorada is null then public._proxima_hora_dorada(n.id, public._ahora()) end,
    'aviso', public._aviso_tarjeta(m.bienvenida_pendiente, v_dorada,
      (select p.nombre from public.premios p where p.negocio_id = n.id and p.activo and public.costo_premio(p.valor_pesos) <= v_saldo
       order by p.valor_pesos desc limit 1),
      case when (v_racha->>'en_riesgo')::boolean then (v_racha->>'semanas')::int end,
      v_cercano),
    'movimientos', (
      select coalesce(json_agg(json_build_object('tipo', x.tipo, 'monedas', x.monedas, 'creado', x.creado) order by x.creado desc, x.id desc), '[]'::json)
      from (select mv.* from public.movimientos mv where mv.membresia_id = m.id order by mv.creado desc, mv.id desc limit 10) x
    )
  );
end $$;

grant execute on function public.club_publico(text)                        to anon, authenticated;
grant execute on function public.club_registrar(text, text, text, boolean) to anon, authenticated;
grant execute on function public.club_tarjeta(text, text)                  to anon, authenticated;

-- =====================================================================
--  RPC de la caja (PIN → sesión de 12 h; las operaciones reciben la sesión, no el PIN)
-- =====================================================================

-- Solo admin (luego, el dueño desde /panel): fija el PIN de 4 a 6 dígitos
create or replace function public.fijar_pin_caja(p_negocio uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.es_admin() then raise exception 'no autorizado'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4,6}$' then raise exception 'El PIN debe tener de 4 a 6 números'; end if;
  update public.negocios set pin_caja_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')) where id = p_negocio;
  delete from public.sesiones_caja where negocio_id = p_negocio;   -- cambiar el PIN cierra las sesiones abiertas
end $$;

create or replace function public.caja_entrar(p_slug text, p_pin text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  n public.negocios;
  v_fallos int;
  v_token text;
begin
  select * into n from public.negocios where slug = lower(trim(p_slug)) and activo;
  if not found or n.pin_caja_hash is null then return json_build_object('error', 'sin_caja'); end if;

  select count(*) into v_fallos from public.intentos_pin
  where negocio_id = n.id and not ok and creado > public._ahora() - interval '1 hour';
  if v_fallos >= 10 then return json_build_object('error', 'bloqueado'); end if;

  if coalesce(p_pin, '') ~ '^[0-9]{4,6}$' and extensions.crypt(p_pin, n.pin_caja_hash) = n.pin_caja_hash then
    insert into public.intentos_pin (negocio_id, ok, creado) values (n.id, true, public._ahora());
    insert into public.sesiones_caja (negocio_id, expira, creado)
    values (n.id, public._ahora() + interval '12 hours', public._ahora()) returning token into v_token;
    return json_build_object('sesion', v_token, 'expira', public._ahora() + interval '12 hours',
      'negocio', n.nombre, 'modo', n.modo_monedas, 'devolucion_pct', n.devolucion_pct,
      'monedas_por_visita', n.monedas_por_visita,
      'moneda_plural', n.moneda_plural, 'moneda_singular', n.moneda_singular,
      'premios', public._premios_json(n.id, null));
  end if;

  insert into public.intentos_pin (negocio_id, ok, creado) values (n.id, false, public._ahora());
  return json_build_object('error', 'pin', 'quedan', greatest(0, 10 - v_fallos - 1));
end $$;

-- Interna: negocio de una sesión vigente (o null)
create or replace function public._sesion_valida(p_sesion text)
returns uuid language sql stable security definer set search_path = public as $$
  select s.negocio_id from public.sesiones_caja s join public.negocios n on n.id = s.negocio_id
  where s.token = p_sesion and s.expira > public._ahora() and n.activo;
$$;

-- Interna: registra el vencimiento si pasaron 12 meses sin visitas
create or replace function public._vencer_membresia(p_membresia uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.membresias;
begin
  select * into m from public.membresias where id = p_membresia for update;
  if m.vence is not null and m.vence < public._ahora() and m.saldo > 0 then
    insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, detalle, creado)
    values (m.id, m.negocio_id, 'vencimiento', -m.saldo, '12 meses sin visitas', public._ahora());
    update public.membresias set saldo = 0 where id = m.id;
  end if;
end $$;

-- Interna (cálculo nocturno): vence las monedas de todas las membresías que toca
create or replace function public.vencer_monedas()
returns int language plpgsql security definer set search_path = public as $$
declare r record; v int := 0;
begin
  for r in select id from public.membresias where vence < public._ahora() and saldo > 0 loop
    perform public._vencer_membresia(r.id); v := v + 1;
  end loop;
  return v;
end $$;

-- Ficha del cliente para el cajero: por token de la tarjeta o por celular
create or replace function public.caja_buscar(p_sesion text, p_dato text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := public._sesion_valida(p_sesion);
  n public.negocios;
  m public.membresias;
  v_nombre text;
  v_desde timestamptz;
begin
  if v_negocio is null then return json_build_object('error', 'sesion'); end if;
  select * into n from public.negocios where id = v_negocio;
  if coalesce(p_dato, '') ~ '^[0-9a-f]{32}$' then
    select * into m from public.membresias where token = p_dato and negocio_id = v_negocio;
  else
    select mb.* into m from public.membresias mb join public.clientes c on c.id = mb.cliente_id
    where c.telefono = public._normalizar_telefono(p_dato) and mb.negocio_id = v_negocio;
  end if;
  if m.id is null then return json_build_object('error', 'no_existe'); end if;

  perform public._vencer_membresia(m.id);
  select * into m from public.membresias where id = m.id;
  select c.nombre into v_nombre from public.clientes c where c.id = m.cliente_id;
  v_desde := m.ultima_visita + make_interval(hours => n.horas_entre_visitas);

  return json_build_object(
    'token', m.token, 'nombre', v_nombre, 'saldo', m.saldo, 'bienvenida_pendiente', m.bienvenida_pendiente,
    'visitas', m.visitas, 'ultima_visita', m.ultima_visita,
    'puede_sumar', m.ultima_visita is null or public._ahora() >= v_desde,
    'desde', case when m.ultima_visita is not null and public._ahora() < v_desde then v_desde end,
    'premios', public._premios_json(v_negocio, m.saldo),
    'nivel', public._nivel(v_negocio, m.total_ganado),
    'racha', public._racha_vigente(m.racha_semanas, m.ultima_semana, m.comodin_mes,
                                   date_trunc('week', (public._ahora() at time zone 'America/Bogota')::date)::date)
  );
end $$;

-- Sumar una visita. Idempotente por p_op_id: reenviar la misma operación nunca suma dos veces.
create or replace function public.caja_visita(p_sesion text, p_token text, p_op_id uuid, p_valor int default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := public._sesion_valida(p_sesion);
  n public.negocios;
  m public.membresias;
  v_previo jsonb;
  v_monedas int;
  v_bienvenida int;
  v_res jsonb;
  v_dorada json;
  v_extra int;
  v_racha json;
  v_bono_racha int;
begin
  if v_negocio is null then return json_build_object('error', 'sesion'); end if;
  if p_op_id is null then return json_build_object('error', 'op_id'); end if;
  select o.resultado into v_previo from public.operaciones_caja o where o.op_id = p_op_id;
  if found then return coalesce(v_previo, '{"error":"en_proceso"}'::jsonb)::json; end if;

  select * into n from public.negocios where id = v_negocio;
  select * into m from public.membresias where token = p_token and negocio_id = v_negocio for update;
  if not found then return json_build_object('error', 'no_existe'); end if;
  perform public._vencer_membresia(m.id);
  select * into m from public.membresias where id = m.id;

  if m.ultima_visita is not null and public._ahora() < m.ultima_visita + make_interval(hours => n.horas_entre_visitas) then
    return json_build_object('error', 'muy_pronto', 'desde', m.ultima_visita + make_interval(hours => n.horas_entre_visitas));
  end if;

  if n.modo_monedas = 'valor' then
    if coalesce(p_valor, 0) <= 0 then return json_build_object('error', 'valor'); end if;
    v_monedas := floor(p_valor::numeric * n.devolucion_pct / 100 / public.valor_moneda());
  else
    v_monedas := n.monedas_por_visita;
  end if;
  v_bienvenida := m.bienvenida_pendiente;

  -- Hora dorada (Fase 6): base × multiplicador; el extra va como movimiento aparte
  v_dorada := public._hora_dorada(v_negocio, public._ahora());
  v_extra := case when v_dorada is null then 0
                  else floor(v_monedas * (v_dorada->>'multiplicador')::numeric)::int - v_monedas end;
  -- Racha semanal (Fase 6): semana = lunes en Bogotá; comodín una vez al mes; bono cada 4 semanas
  v_racha := public._avanzar_racha(m.racha_semanas, m.ultima_semana, m.comodin_mes,
                                   date_trunc('week', (public._ahora() at time zone 'America/Bogota')::date)::date);
  v_bono_racha := case when (v_racha->>'racha')::int > coalesce(m.racha_semanas, 0) and (v_racha->>'racha')::int % 4 = 0
                       then n.bono_racha else 0 end;

  insert into public.operaciones_caja (op_id, negocio_id, membresia_id, tipo, creado)
  values (p_op_id, v_negocio, m.id, 'visita', public._ahora());

  insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, valor_compra, op_id, creado)
  values (m.id, v_negocio, 'visita', v_monedas, case when n.modo_monedas = 'valor' then p_valor end, p_op_id, public._ahora());
  if v_bienvenida > 0 then
    insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, creado)
    values (m.id, v_negocio, 'bienvenida', v_bienvenida, public._ahora());
  end if;
  if v_extra > 0 then
    insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, detalle, creado)
    values (m.id, v_negocio, 'bono_hora_dorada', v_extra, '×' || (v_dorada->>'multiplicador'), public._ahora());
  end if;
  if v_bono_racha > 0 then
    insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, detalle, creado)
    values (m.id, v_negocio, 'bono_racha', v_bono_racha, (v_racha->>'racha') || ' semanas', public._ahora());
  end if;

  update public.membresias set
    saldo = saldo + v_monedas + v_bienvenida + v_extra + v_bono_racha,
    total_ganado = total_ganado + v_monedas + v_bienvenida + v_extra + v_bono_racha,
    visitas = visitas + 1,
    bienvenida_pendiente = 0,
    ultima_visita = public._ahora(),
    vence = public._ahora() + interval '12 months',
    racha_semanas = (v_racha->>'racha')::int,
    ultima_semana = (v_racha->>'semana')::date,
    comodin_mes = (v_racha->>'comodin_mes')::date
  where id = m.id
  returning * into m;

  v_res := jsonb_build_object('ok', true, 'monedas', v_monedas, 'bienvenida', v_bienvenida, 'hora_dorada', v_extra,
    'bono_racha', v_bono_racha, 'racha', m.racha_semanas, 'saldo', m.saldo,
    'nivel', public._nivel(v_negocio, m.total_ganado)::jsonb);
  update public.operaciones_caja set resultado = v_res where op_id = p_op_id;
  return v_res::json;
end $$;

-- Canjear un premio (el cajero, viendo al cliente). Idempotente por p_op_id.
create or replace function public.caja_canje(p_sesion text, p_token text, p_premio uuid, p_op_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_negocio uuid := public._sesion_valida(p_sesion);
  m public.membresias;
  p public.premios;
  v_previo jsonb;
  v_costo int;
  v_res jsonb;
begin
  if v_negocio is null then return json_build_object('error', 'sesion'); end if;
  if p_op_id is null then return json_build_object('error', 'op_id'); end if;
  select o.resultado into v_previo from public.operaciones_caja o where o.op_id = p_op_id;
  if found then return coalesce(v_previo, '{"error":"en_proceso"}'::jsonb)::json; end if;

  select * into m from public.membresias where token = p_token and negocio_id = v_negocio for update;
  if not found then return json_build_object('error', 'no_existe'); end if;
  select * into p from public.premios where id = p_premio and negocio_id = v_negocio and activo;
  if not found then return json_build_object('error', 'premio'); end if;
  perform public._vencer_membresia(m.id);
  select * into m from public.membresias where id = m.id;

  v_costo := public.costo_premio(p.valor_pesos);
  if m.saldo < v_costo then return json_build_object('error', 'saldo', 'faltan', v_costo - m.saldo); end if;

  insert into public.operaciones_caja (op_id, negocio_id, membresia_id, tipo, creado)
  values (p_op_id, v_negocio, m.id, 'canje', public._ahora());
  insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, premio_id, op_id, creado)
  values (m.id, v_negocio, 'canje', -v_costo, p.id, p_op_id, public._ahora());
  update public.membresias set saldo = saldo - v_costo where id = m.id returning * into m;

  v_res := jsonb_build_object('ok', true, 'premio', p.nombre, 'costo', v_costo, 'saldo', m.saldo);
  update public.operaciones_caja set resultado = v_res where op_id = p_op_id;
  return v_res::json;
end $$;

-- Permisos: internas cerradas; caja y cliente abiertas (cada una valida su sesión o su token)
revoke execute on function public._sesion_valida(text)           from public, anon, authenticated;
revoke execute on function public._vencer_membresia(uuid)        from public, anon, authenticated;
revoke execute on function public.vencer_monedas()               from public, anon, authenticated;
revoke execute on function public._premios_json(uuid, int)       from public, anon, authenticated;
revoke execute on function public._normalizar_telefono(text)     from public, anon, authenticated;
revoke execute on function public.fijar_pin_caja(uuid, text)     from public, anon;
grant  execute on function public.fijar_pin_caja(uuid, text)     to authenticated;
grant  execute on function public.caja_entrar(text, text)        to anon, authenticated;
grant  execute on function public.caja_buscar(text, text)        to anon, authenticated;
grant  execute on function public.caja_visita(text, text, uuid, int)  to anon, authenticated;
grant  execute on function public.caja_canje(text, text, uuid, uuid)  to anon, authenticated;

-- =====================================================================
-- ===== Fase 3 =====  paquete gimnasio: socios, entradas importadas, festivos,
-- métricas, horario legal (Ley 2300), máquinas y clases, entrada por NFC.
-- =====================================================================

-- ---------- Socios y entradas (importadas del torniquete o por NFC) ----
create table if not exists public.socios (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios(id) on delete cascade,
  codigo_externo text not null,
  nombre         text,
  telefono       text,
  plan           text,
  creado         timestamptz not null default now(),
  unique (negocio_id, codigo_externo)
);
alter table public.socios enable row level security;
drop policy if exists admin_todo on public.socios;
create policy admin_todo on public.socios for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create table if not exists public.entradas (
  id         bigint generated always as identity primary key,
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  socio_id   uuid not null references public.socios(id) on delete cascade,
  fecha_hora timestamptz not null,
  origen     text not null default 'importado' check (origen in ('importado', 'nfc')),
  creado     timestamptz not null default now(),
  unique (negocio_id, socio_id, fecha_hora)
);
create index if not exists entradas_negocio_fecha_idx on public.entradas(negocio_id, fecha_hora);
alter table public.entradas enable row level security;
drop policy if exists admin_todo on public.entradas;
create policy admin_todo on public.entradas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create table if not exists public.importaciones (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  archivo    text,
  filas      int not null default 0,
  nuevas     int not null default 0,
  repetidas  int not null default 0,
  invalidas  int not null default 0,
  mapeo      jsonb,
  creado     timestamptz not null default now()
);
create index if not exists importaciones_negocio_idx on public.importaciones(negocio_id, creado);
alter table public.importaciones enable row level security;
drop policy if exists admin_todo on public.importaciones;
create policy admin_todo on public.importaciones for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

alter table public.negocios add column if not exists mapeo_csv jsonb;
alter table public.negocios add column if not exists en_riesgo_dias int check (en_riesgo_dias between 1 and 365);  -- null = el del sector

-- ---------- Festivos de Colombia (Ley 2300: nunca se escribe en festivo) ----
create table if not exists public.festivos (
  fecha  date primary key,
  nombre text not null
);
alter table public.festivos enable row level security;
drop policy if exists admin_todo on public.festivos;
create policy admin_todo on public.festivos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
-- Calculados con la Ley 51 de 1983 (Emiliani). Revisar contra el calendario oficial (ver DECISIONES.md).
insert into public.festivos (fecha, nombre) values
  ('2026-01-01', 'Año Nuevo'), ('2026-01-12', 'Reyes Magos'), ('2026-03-23', 'San José'),
  ('2026-04-02', 'Jueves Santo'), ('2026-04-03', 'Viernes Santo'), ('2026-05-01', 'Día del Trabajo'),
  ('2026-05-18', 'Ascensión del Señor'), ('2026-06-08', 'Corpus Christi'), ('2026-06-15', 'Sagrado Corazón'),
  ('2026-06-29', 'San Pedro y San Pablo'), ('2026-07-20', 'Independencia'), ('2026-08-07', 'Batalla de Boyacá'),
  ('2026-08-17', 'Asunción de la Virgen'), ('2026-10-12', 'Día de la Raza'), ('2026-11-02', 'Todos los Santos'),
  ('2026-11-16', 'Independencia de Cartagena'), ('2026-12-08', 'Inmaculada Concepción'), ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Año Nuevo'), ('2027-01-11', 'Reyes Magos'), ('2027-03-22', 'San José'),
  ('2027-03-25', 'Jueves Santo'), ('2027-03-26', 'Viernes Santo'), ('2027-05-01', 'Día del Trabajo'),
  ('2027-05-10', 'Ascensión del Señor'), ('2027-05-31', 'Corpus Christi'), ('2027-06-07', 'Sagrado Corazón'),
  ('2027-07-05', 'San Pedro y San Pablo'), ('2027-07-20', 'Independencia'), ('2027-08-07', 'Batalla de Boyacá'),
  ('2027-08-16', 'Asunción de la Virgen'), ('2027-10-18', 'Día de la Raza'), ('2027-11-01', 'Todos los Santos'),
  ('2027-11-15', 'Independencia de Cartagena'), ('2027-12-08', 'Inmaculada Concepción'), ('2027-12-25', 'Navidad')
on conflict (fecha) do nothing;

-- ---------- Catálogo: categorías y productos (plato | clase | máquina | servicio) ----
create table if not exists public.categorias (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  nombre     text not null check (char_length(nombre) between 1 and 60),
  orden      int not null default 0,
  activo     boolean not null default true,
  creado     timestamptz not null default now()
);
create index if not exists categorias_negocio_idx on public.categorias(negocio_id);
alter table public.categorias enable row level security;
drop policy if exists admin_todo on public.categorias;
create policy admin_todo on public.categorias for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create table if not exists public.productos (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid not null references public.negocios(id) on delete cascade,
  categoria_id uuid references public.categorias(id) on delete set null,
  tipo         text not null default 'plato' check (tipo in ('plato', 'clase', 'maquina', 'servicio')),
  nombre       text not null check (char_length(nombre) between 1 and 80),
  descripcion  text check (descripcion is null or char_length(descripcion) <= 140),
  precio       int not null default 0 check (precio >= 0),
  foto_url     text,
  etiquetas    text[] not null default '{}',
  destacado    boolean not null default false,
  agotado      boolean not null default false,
  activo       boolean not null default true,
  orden        int not null default 0,
  video_url    text,
  pasos        jsonb not null default '[]'::jsonb check (jsonb_typeof(pasos) = 'array' and jsonb_array_length(pasos) <= 3),
  horario      jsonb not null default '[]'::jsonb check (jsonb_typeof(horario) = 'array'),  -- clases: [{dia:0-6 (0=domingo), hora:"18:00", duracion:60, cupo:20}]
  creado       timestamptz not null default now()
);
create index if not exists productos_negocio_idx on public.productos(negocio_id, tipo);
alter table public.productos enable row level security;
drop policy if exists admin_todo on public.productos;
create policy admin_todo on public.productos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Tags: destinos "producto" (ficha de máquina) y "entrada" (gimnasio sin torniquete)
alter table public.tags add column if not exists producto_id uuid references public.productos(id) on delete set null;
alter table public.tags drop constraint if exists tags_destino_check;
alter table public.tags add constraint tags_destino_check
  check (destino in ('hub', 'menu', 'resena', 'whatsapp', 'instagram', 'wifi', 'url', 'club', 'producto', 'entrada'));

-- =====================================================================
--  Importación de entradas (CSV del torniquete, mapeado en el navegador)
-- =====================================================================
create or replace function public.importar_entradas(p_negocio uuid, p_filas jsonb, p_mapeo jsonb default null, p_archivo text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  v_codigo text;
  v_ts timestamptz;
  v_socio uuid;
  v_n int;
  v_filas int := 0; v_nuevas int := 0; v_repetidas int := 0; v_invalidas int := 0;
begin
  if not public.es_admin() then raise exception 'no autorizado'; end if;
  if jsonb_typeof(p_filas) <> 'array' then raise exception 'p_filas debe ser un arreglo'; end if;
  if jsonb_array_length(p_filas) > 5000 then raise exception 'Máximo 5.000 filas por llamada'; end if;
  if not exists (select 1 from public.negocios where id = p_negocio) then raise exception 'negocio no existe'; end if;

  for r in select * from jsonb_array_elements(p_filas) loop
    v_filas := v_filas + 1;
    v_codigo := nullif(btrim(r->>'codigo'), '');
    v_ts := null;
    begin
      -- La fecha llega como hora local de Bogotá (AAAA-MM-DD HH:MM[:SS]); nunca se adivina
      if coalesce(r->>'fecha_hora', '') ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$' then
        v_ts := (r->>'fecha_hora')::timestamp at time zone 'America/Bogota';
      end if;
    exception when others then v_ts := null;
    end;
    if v_codigo is null or v_ts is null or char_length(v_codigo) > 60 then
      v_invalidas := v_invalidas + 1;
      continue;
    end if;

    insert into public.socios (negocio_id, codigo_externo, nombre, telefono, plan)
    values (p_negocio, v_codigo, nullif(btrim(left(r->>'nombre', 80)), ''), nullif(btrim(left(r->>'telefono', 20)), ''), nullif(btrim(left(r->>'plan', 40)), ''))
    on conflict (negocio_id, codigo_externo) do update set
      nombre   = coalesce(excluded.nombre, public.socios.nombre),
      telefono = coalesce(excluded.telefono, public.socios.telefono),
      plan     = coalesce(excluded.plan, public.socios.plan)
    returning id into v_socio;

    insert into public.entradas (negocio_id, socio_id, fecha_hora, origen)
    values (p_negocio, v_socio, v_ts, 'importado')
    on conflict (negocio_id, socio_id, fecha_hora) do nothing;
    get diagnostics v_n = row_count;
    if v_n > 0 then v_nuevas := v_nuevas + 1; else v_repetidas := v_repetidas + 1; end if;
  end loop;

  insert into public.importaciones (negocio_id, archivo, filas, nuevas, repetidas, invalidas, mapeo)
  values (p_negocio, left(p_archivo, 120), v_filas, v_nuevas, v_repetidas, v_invalidas, p_mapeo);
  if p_mapeo is not null then update public.negocios set mapeo_csv = p_mapeo where id = p_negocio; end if;

  return json_build_object('filas', v_filas, 'nuevas', v_nuevas, 'repetidas', v_repetidas, 'invalidas', v_invalidas);
end $$;
revoke execute on function public.importar_entradas(uuid, jsonb, jsonb, text) from public, anon;
grant  execute on function public.importar_entradas(uuid, jsonb, jsonb, text) to authenticated;

-- =====================================================================
--  Métricas (definiciones exactas: PRODUCTO.md §8). Internas: no las llama el público.
-- =====================================================================

-- Umbral de "en riesgo" por sector. ESPEJO de lib/sectores/*.json → en_riesgo_dias (hay prueba que lo compara).
create or replace function public._sector_en_riesgo_dias(p_sector text)
returns int language sql immutable as $$
  select case p_sector when 'gimnasio' then 10 else 21 end
$$;

-- Todas las visitas de un negocio: entradas (si el negocio importa o registra entradas) o visitas de caja.
-- persona = 's:<socio>' o 'c:<membresía>'. dia/dow/hora en hora de Bogotá.
create or replace function public._visitas(p_negocio uuid)
returns table (persona text, nombre text, telefono text, momento timestamptz, dia date, dow int, hora int)
language sql stable as $$
  with v as (
    select 's:' || s.id::text as persona, s.nombre, s.telefono, e.fecha_hora as momento
    from public.entradas e join public.socios s on s.id = e.socio_id
    where e.negocio_id = p_negocio
    union all
    select 'c:' || m.id::text, c.nombre, c.telefono, mv.creado
    from public.movimientos mv
    join public.membresias m on m.id = mv.membresia_id
    join public.clientes c on c.id = m.cliente_id
    where mv.negocio_id = p_negocio and mv.tipo = 'visita'
      and not exists (select 1 from public.entradas e2 where e2.negocio_id = p_negocio)
  )
  select v.persona, v.nombre, v.telefono, v.momento,
         (v.momento at time zone 'America/Bogota')::date,
         extract(dow from v.momento at time zone 'America/Bogota')::int,
         extract(hour from v.momento at time zone 'America/Bogota')::int
  from v
$$;

-- Activos: personas con ≥ 1 visita en los 14 días hasta p_fecha (incluida)
create or replace function public.metrica_activos(p_negocio uuid, p_fecha date)
returns int language sql stable as $$
  select count(distinct persona)::int from public._visitas(p_negocio)
  where dia between p_fecha - 13 and p_fecha
$$;

-- Abandono mensual (mes de p_fecha): activos al inicio del mes (≥ 1 visita en los 14 días anteriores al día 1)
-- que no registran visitas en todo el mes (hasta p_fecha) ÷ activos al inicio.
create or replace function public.metrica_abandono_mensual(p_negocio uuid, p_fecha date)
returns json language sql stable as $$
  with lim as (select date_trunc('month', p_fecha)::date as ini),
  v as (select * from public._visitas(p_negocio)),
  activos as (select distinct v.persona from v, lim where v.dia between lim.ini - 14 and lim.ini - 1),
  abandonaron as (
    select a.persona from activos a, lim
    where not exists (select 1 from v where v.persona = a.persona and v.dia between lim.ini and p_fecha)
  )
  select json_build_object(
    'mes', to_char((select ini from lim), 'YYYY-MM'),
    'activos_inicio', (select count(*) from activos),
    'abandonaron', (select count(*) from abandonaron),
    'tasa', case when (select count(*) from activos) = 0 then null
                 else round((select count(*) from abandonaron)::numeric / (select count(*) from activos), 4) end
  )
$$;

-- Días de "en riesgo" del negocio (el suyo o el de su sector)
create or replace function public._en_riesgo_dias(p_negocio uuid)
returns int language sql stable as $$
  select coalesce(n.en_riesgo_dias, public._sector_en_riesgo_dias(n.sector)) from public.negocios n where n.id = p_negocio
$$;

-- En riesgo: ≥ 4 visitas históricas y sin venir hace ≥ umbral días (a p_fecha). Incluye teléfono: SOLO para el admin.
create or replace function public.metrica_en_riesgo(p_negocio uuid, p_fecha date)
returns json language sql stable as $$
  with v as (select * from public._visitas(p_negocio) where dia <= p_fecha),
  p as (
    select persona, max(nombre) as nombre, max(telefono) as telefono, count(*) as visitas, max(dia) as ultima
    from v group by persona
  )
  select coalesce(json_agg(json_build_object('persona', persona, 'nombre', nombre, 'telefono', telefono,
           'visitas', visitas, 'dias', p_fecha - ultima) order by p_fecha - ultima, nombre), '[]'::json)
  from p
  where visitas >= 4 and p_fecha - ultima >= public._en_riesgo_dias(p_negocio)
$$;

-- Horas pico: matriz 7 × 24 (fila 0 = domingo) con las visitas de los 90 días hasta p_fecha
create or replace function public.metrica_horas_pico(p_negocio uuid, p_fecha date)
returns json language sql stable as $$
  with c as (
    select dow, hora, count(*)::int as n from public._visitas(p_negocio)
    where dia between p_fecha - 89 and p_fecha group by dow, hora
  )
  select json_agg(fila order by d) from (
    select d.d, (select json_agg(coalesce((select c.n from c where c.dow = d.d and c.hora = h.h), 0) order by h.h)
                 from generate_series(0, 23) h(h)) as fila
    from generate_series(0, 6) d(d)
  ) x
$$;

-- Racha: semanas seguidas (lunes a domingo, Bogotá) con ≥ 1 visita, contando hacia atrás desde la semana de p_fecha.
-- Si esta semana aún no ha venido, se cuenta desde la anterior (la racha sigue viva hasta el domingo).
create or replace function public._racha(p_negocio uuid, p_persona text, p_fecha date)
returns int language sql stable as $$
  with sem as (
    select distinct date_trunc('week', dia)::date as w from public._visitas(p_negocio)
    where persona = p_persona and dia <= p_fecha
  ),
  ini as (
    select case when exists (select 1 from sem where w = date_trunc('week', p_fecha)::date)
                then date_trunc('week', p_fecha)::date else date_trunc('week', p_fecha)::date - 7 end as w0
  ),
  ord as (select sem.w, row_number() over (order by sem.w desc) as rn from sem, ini where sem.w <= ini.w0)
  select count(*)::int from ord, ini where ini.w0 - ord.w = (ord.rn - 1) * 7
$$;

create or replace function public.metrica_racha(p_negocio uuid, p_fecha date)
returns json language sql stable as $$
  select coalesce(json_agg(json_build_object('persona', persona, 'racha', public._racha(p_negocio, persona, p_fecha))), '[]'::json)
  from (select distinct persona from public._visitas(p_negocio) where dia <= p_fecha) x
$$;

-- =====================================================================
--  Horario legal para escribir (Ley 2300): L–V 7–19, S 8–15, nunca domingo ni festivo (hora Bogotá)
-- =====================================================================
create or replace function public.puede_escribir(p_momento timestamptz default null)
returns boolean language sql stable security definer set search_path = public as $$
  with l as (select (coalesce(p_momento, public._ahora()) at time zone 'America/Bogota') as t)
  select case
    when exists (select 1 from public.festivos f, l where f.fecha = l.t::date) then false
    when extract(isodow from l.t) between 1 and 5 then l.t::time >= '07:00' and l.t::time < '19:00'
    when extract(isodow from l.t) = 6 then l.t::time >= '08:00' and l.t::time < '15:00'
    else false end
  from l
$$;

create or replace function public.proxima_hora_permitida(p_momento timestamptz default null)
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare
  v_ahora timestamptz := coalesce(p_momento, public._ahora());
  v_local timestamp := v_ahora at time zone 'America/Bogota';
  v_dia date := v_local::date;
  v_abre timestamp;
begin
  if public.puede_escribir(v_ahora) then return v_ahora; end if;
  for i in 0..30 loop
    if not exists (select 1 from public.festivos where fecha = v_dia + i) and extract(isodow from v_dia + i) <> 7 then
      v_abre := (v_dia + i) + case when extract(isodow from v_dia + i) = 6 then time '08:00' else time '07:00' end;
      if v_abre > v_local then return v_abre at time zone 'America/Bogota'; end if;
    end if;
  end loop;
  return null;
end $$;
grant execute on function public.puede_escribir(timestamptz)          to anon, authenticated;
grant execute on function public.proxima_hora_permitida(timestamptz)  to anon, authenticated;

-- =====================================================================
--  Bloque "gimnasio" de las estadísticas. Teléfonos SOLO para el admin; el link del dueño ve conteos.
-- =====================================================================
create or replace function public._stats_gimnasio(p_negocio uuid, p_con_contacto boolean)
returns json language sql stable as $$
  with hoy as (select (public._ahora() at time zone 'America/Bogota')::date as d),
  r as (select public.metrica_en_riesgo(p_negocio, (select d from hoy)) as lista)
  select json_build_object(
    'activos', public.metrica_activos(p_negocio, (select d from hoy)),
    'abandono', public.metrica_abandono_mensual(p_negocio, (select d from hoy)),
    'en_riesgo_dias', public._en_riesgo_dias(p_negocio),
    'en_riesgo_total', json_array_length((select lista from r)),
    'en_riesgo', case when p_con_contacto then (select lista from r) else null end,
    'puede_escribir', public.puede_escribir(),
    'proxima', public.proxima_hora_permitida()
  )
$$;

create or replace function public.stats_admin(p_negocio uuid, p_dias int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'no autorizado';
  end if;
  return (public._stats_negocio(p_negocio, p_dias)::jsonb
          || jsonb_build_object('gimnasio', public._stats_gimnasio(p_negocio, true)))::json;
end $$;

create or replace function public.stats_token(p_token text, p_dias int default 30)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('negocio', n.nombre, 'color', n.color,
    'stats', (public._stats_negocio(n.id, p_dias)::jsonb
              || jsonb_build_object('gimnasio', public._stats_gimnasio(n.id, false)))::json)
  from public.negocios n where n.token_stats = p_token;
$$;

-- =====================================================================
--  Catálogo público: ficha de producto (máquina) y clases de hoy
-- =====================================================================
create or replace function public.producto_publico(p_slug text, p_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', p.id, 'tipo', p.tipo, 'nombre', p.nombre, 'descripcion', p.descripcion,
    'precio', p.precio, 'foto_url', p.foto_url, 'video_url', p.video_url, 'pasos', p.pasos, 'horario', p.horario,
    'agotado', p.agotado)
  from public.productos p join public.negocios n on n.id = p.negocio_id
  where n.slug = lower(trim(p_slug)) and n.activo and p.id = p_id and p.activo
$$;

create or replace function public.clases_hoy(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  with hoy as (select extract(dow from public._ahora() at time zone 'America/Bogota')::int as d)
  select coalesce(json_agg(json_build_object('id', p.id, 'nombre', p.nombre, 'descripcion', p.descripcion,
           'hora', h->>'hora', 'duracion', (h->>'duracion')::int, 'cupo', (h->>'cupo')::int)
         order by h->>'hora', p.nombre), '[]'::json)
  from public.productos p
  join public.negocios n on n.id = p.negocio_id
  cross join lateral jsonb_array_elements(p.horario) h
  where n.slug = lower(trim(p_slug)) and n.activo and p.activo and p.tipo = 'clase'
    and (h->>'dia')::int = (select d from hoy)
$$;

-- Máquinas activas del negocio (para "Ver otras máquinas")
create or replace function public.maquinas_publicas(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', p.id, 'nombre', p.nombre) order by p.orden, p.nombre), '[]'::json)
  from public.productos p join public.negocios n on n.id = p.negocio_id
  where n.slug = lower(trim(p_slug)) and n.activo and p.activo and p.tipo = 'maquina'
$$;

grant execute on function public.producto_publico(text, uuid) to anon, authenticated;
grant execute on function public.clases_hoy(text)             to anon, authenticated;
grant execute on function public.maquinas_publicas(text)      to anon, authenticated;

-- =====================================================================
--  Entrada por NFC (solo gimnasios SIN torniquete: servicios.entrada_nfc). Suma asistencia, NUNCA monedas.
-- =====================================================================
create or replace function public.registrar_entrada_nfc(p_slug text, p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare
  n public.negocios;
  m public.membresias;
  c public.clientes;
  v_socio uuid;
  v_hoy date := (public._ahora() at time zone 'America/Bogota')::date;
  v_repetida boolean := false;
  v_racha int;
begin
  select * into n from public.negocios where slug = lower(trim(p_slug)) and activo;
  if not found or not coalesce((n.servicios->>'entrada_nfc')::boolean, false) then
    return json_build_object('error', 'sin_entrada');
  end if;
  select * into m from public.membresias where token = p_token and negocio_id = n.id;
  if not found then return json_build_object('error', 'token'); end if;
  select * into c from public.clientes where id = m.cliente_id;

  insert into public.socios (negocio_id, codigo_externo, nombre, telefono)
  values (n.id, 'club:' || m.id::text, c.nombre, c.telefono)
  on conflict (negocio_id, codigo_externo) do update set nombre = excluded.nombre
  returning id into v_socio;

  if exists (select 1 from public.entradas e where e.socio_id = v_socio
             and (e.fecha_hora at time zone 'America/Bogota')::date = v_hoy) then
    v_repetida := true;
  else
    insert into public.entradas (negocio_id, socio_id, fecha_hora, origen) values (n.id, v_socio, public._ahora(), 'nfc');
  end if;

  v_racha := public._racha(n.id, 's:' || v_socio::text, v_hoy);
  return json_build_object(
    'ok', true, 'repetida', v_repetida, 'hora', public._ahora(), 'sede', n.ubicacion_etiqueta, 'negocio', n.nombre,
    'racha', v_racha,
    'semanas', (
      select json_agg(exists (
        select 1 from public.entradas e where e.socio_id = v_socio
          and date_trunc('week', (e.fecha_hora at time zone 'America/Bogota')::date)::date = date_trunc('week', v_hoy)::date - 7 * k
      ) order by k desc)
      from generate_series(0, 7) k
    )
  );
end $$;
grant execute on function public.registrar_entrada_nfc(text, text) to anon, authenticated;

-- Permisos: métricas y ayudas internas cerradas al público
revoke execute on function public._sector_en_riesgo_dias(text)             from public, anon, authenticated;
revoke execute on function public._visitas(uuid)                           from public, anon, authenticated;
revoke execute on function public.metrica_activos(uuid, date)              from public, anon, authenticated;
revoke execute on function public.metrica_abandono_mensual(uuid, date)     from public, anon, authenticated;
revoke execute on function public._en_riesgo_dias(uuid)                    from public, anon, authenticated;
revoke execute on function public.metrica_en_riesgo(uuid, date)            from public, anon, authenticated;
revoke execute on function public.metrica_horas_pico(uuid, date)           from public, anon, authenticated;
revoke execute on function public._racha(uuid, text, date)                 from public, anon, authenticated;
revoke execute on function public.metrica_racha(uuid, date)                from public, anon, authenticated;
revoke execute on function public._stats_gimnasio(uuid, boolean)           from public, anon, authenticated;

-- =====================================================================
-- ===== Fase 4 =====  estadísticas nivel 1 (metricas_diarias), exportación anónima
-- para el estudio e informes en PDF. Definiciones exactas: PRODUCTO.md §8.
-- =====================================================================

create table if not exists public.metricas_diarias (
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  fecha      date not null,
  metrica    text not null,
  valor      numeric,
  detalle    jsonb,
  creado     timestamptz not null default now(),
  primary key (negocio_id, fecha, metrica)
);
alter table public.metricas_diarias enable row level security;
drop policy if exists admin_todo on public.metricas_diarias;
create policy admin_todo on public.metricas_diarias for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------- Métricas que faltaban (todas: p_negocio, p_fecha = día en hora Bogotá) ----------

-- Visitas al portal: toques + escaneos del día
create or replace function public.metrica_visitas_portal(p_negocio uuid, p_fecha date)
returns int language sql stable as $$
  select count(*)::int from public.toques q
  where q.negocio_id = p_negocio and (q.creado at time zone 'America/Bogota')::date = p_fecha
$$;

-- Clics en "Déjanos tu reseña" del día (numerador de la conversión a reseña)
create or replace function public.metrica_clics_resena(p_negocio uuid, p_fecha date)
returns int language sql stable as $$
  select count(*)::int from public.clicks c
  where c.negocio_id = p_negocio and c.boton = 'resena' and (c.creado at time zone 'America/Bogota')::date = p_fecha
$$;

-- Clientes inscritos: total hasta el día y nuevos ese día
create or replace function public.metrica_inscritos(p_negocio uuid, p_fecha date)
returns json language sql stable as $$
  select json_build_object(
    'total', count(*) filter (where (m.creado at time zone 'America/Bogota')::date <= p_fecha),
    'nuevos', count(*) filter (where (m.creado at time zone 'America/Bogota')::date = p_fecha))
  from public.membresias m where m.negocio_id = p_negocio
$$;

-- Visitas registradas (caja o entradas) del día
create or replace function public.metrica_visitas(p_negocio uuid, p_fecha date)
returns int language sql stable as $$
  select count(*)::int from public._visitas(p_negocio) where dia = p_fecha
$$;

-- Frecuencia: visitas registradas por cliente en los últimos 30 días (promedio y mediana), entre quienes vinieron
create or replace function public.metrica_frecuencia(p_negocio uuid, p_fecha date)
returns json language sql stable as $$
  with p as (select persona, count(*) as n from public._visitas(p_negocio) where dia between p_fecha - 29 and p_fecha group by persona)
  select json_build_object('clientes', count(*), 'promedio', round(avg(n), 2),
    'mediana', percentile_cont(0.5) within group (order by n)) from p
$$;

-- Retorno a 30 días: % de clientes con ≥ 2 visitas en 30 días (entre los que tuvieron ≥ 1)
create or replace function public.metrica_retorno_30(p_negocio uuid, p_fecha date)
returns numeric language sql stable as $$
  with p as (select persona, count(*) as n from public._visitas(p_negocio) where dia between p_fecha - 29 and p_fecha group by persona)
  select case when count(*) = 0 then null else round(count(*) filter (where n >= 2)::numeric / count(*), 4) end from p
$$;

-- Recencia: días desde la última visita, por cliente (promedio y mediana)
create or replace function public.metrica_recencia(p_negocio uuid, p_fecha date)
returns json language sql stable as $$
  with p as (select persona, p_fecha - max(dia) as d from public._visitas(p_negocio) where dia <= p_fecha group by persona)
  select json_build_object('clientes', count(*), 'promedio', round(avg(d), 2),
    'mediana', percentile_cont(0.5) within group (order by d)) from p
$$;

-- Devolución real (30 días): valor de premios canjeados ÷ ventas registradas en caja
create or replace function public.metrica_devolucion_real(p_negocio uuid, p_fecha date)
returns json language sql stable as $$
  with m as (
    select mv.* from public.movimientos mv
    where mv.negocio_id = p_negocio and (mv.creado at time zone 'America/Bogota')::date between p_fecha - 29 and p_fecha
  )
  select json_build_object(
    'premios', coalesce((select sum(-monedas) from m where tipo = 'canje'), 0) * public.valor_moneda(),
    'ventas', coalesce((select sum(valor_compra) from m where tipo = 'visita'), 0),
    'tasa', case when coalesce((select sum(valor_compra) from m where tipo = 'visita'), 0) = 0 then null
                 else round(coalesce((select sum(-monedas) from m where tipo = 'canje'), 0) * public.valor_moneda()::numeric
                            / (select sum(valor_compra) from m where tipo = 'visita'), 4) end)
$$;

-- Uso de máquinas: escaneos del día en tags que abren una máquina
create or replace function public.metrica_uso_maquinas(p_negocio uuid, p_fecha date)
returns json language sql stable as $$
  select coalesce(json_object_agg(x.producto_id, x.n), '{}'::json) from (
    select t.producto_id, count(*) as n from public.toques q join public.tags t on t.id = q.tag_id
    where q.negocio_id = p_negocio and t.producto_id is not null and (q.creado at time zone 'America/Bogota')::date = p_fecha
    group by t.producto_id
  ) x
$$;

-- Todas las métricas de un día (lo que se guarda en metricas_diarias)
create or replace function public._metricas_dia(p_negocio uuid, p_fecha date)
returns table (metrica text, valor numeric, detalle jsonb)
language sql stable as $$
  with ins as (select public.metrica_inscritos(p_negocio, p_fecha)::jsonb as j),
  fr as (select public.metrica_frecuencia(p_negocio, p_fecha)::jsonb as j),
  re as (select public.metrica_recencia(p_negocio, p_fecha)::jsonb as j),
  dv as (select public.metrica_devolucion_real(p_negocio, p_fecha)::jsonb as j),
  ab as (select public.metrica_abandono_mensual(p_negocio, p_fecha)::jsonb as j),
  um as (select public.metrica_uso_maquinas(p_negocio, p_fecha)::jsonb as j),
  hr as (
    select jsonb_build_object('dow', extract(dow from p_fecha)::int,
      'horas', (select jsonb_agg(coalesce((select count(*) from public._visitas(p_negocio) v where v.dia = p_fecha and v.hora = h), 0) order by h)
                from generate_series(0, 23) h)) as j
  )
  select 'visitas_portal', public.metrica_visitas_portal(p_negocio, p_fecha)::numeric, null::jsonb
  union all select 'clics_resena', public.metrica_clics_resena(p_negocio, p_fecha), null
  union all select 'visitas', public.metrica_visitas(p_negocio, p_fecha), null
  union all select 'inscritos_total', (select (j->>'total')::numeric from ins), null
  union all select 'inscritos_nuevos', (select (j->>'nuevos')::numeric from ins), null
  union all select 'activos', public.metrica_activos(p_negocio, p_fecha), null
  union all select 'en_riesgo', json_array_length(public.metrica_en_riesgo(p_negocio, p_fecha)), null
  union all select 'frecuencia', (select (j->>'promedio')::numeric from fr), (select j from fr)
  union all select 'retorno_30', public.metrica_retorno_30(p_negocio, p_fecha), null
  union all select 'recencia', (select (j->>'mediana')::numeric from re), (select j from re)
  union all select 'abandono_mensual', (select (j->>'tasa')::numeric from ab), (select j from ab)
  union all select 'devolucion_real', (select (j->>'tasa')::numeric from dv), (select j from dv)
  union all select 'ventas', coalesce((select sum(valor_compra) from public.movimientos mv
      where mv.negocio_id = p_negocio and mv.tipo = 'visita' and (mv.creado at time zone 'America/Bogota')::date = p_fecha), 0), null
  union all select 'premios_valor', coalesce((select sum(-monedas) from public.movimientos mv
      where mv.negocio_id = p_negocio and mv.tipo = 'canje' and (mv.creado at time zone 'America/Bogota')::date = p_fecha), 0) * public.valor_moneda(), null
  union all select 'uso_maquinas', (select coalesce(sum(value::numeric), 0) from um, jsonb_each_text(um.j)), (select j from um)
  union all select 'visitas_por_hora', (select sum(x::numeric) from hr, jsonb_array_elements_text(hr.j->'horas') x), (select j from hr)
$$;

-- Recalcula un rango (por defecto hasta ayer). Interna: el admin la llama con admin_recalcular.
create or replace function public.recalcular_metricas(p_negocio uuid, p_desde date, p_hasta date default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_hasta date := coalesce(p_hasta, (public._ahora() at time zone 'America/Bogota')::date - 1);
  v_dia date;
  v_n int := 0;
begin
  if p_desde is null or p_desde > v_hasta then return 0; end if;
  if v_hasta - p_desde > 800 then raise exception 'Rango demasiado largo'; end if;
  delete from public.metricas_diarias where negocio_id = p_negocio and fecha between p_desde and v_hasta;
  v_dia := p_desde;
  while v_dia <= v_hasta loop
    insert into public.metricas_diarias (negocio_id, fecha, metrica, valor, detalle)
    select p_negocio, v_dia, x.metrica, x.valor, x.detalle from public._metricas_dia(p_negocio, v_dia) x
    on conflict (negocio_id, fecha, metrica) do update set valor = excluded.valor, detalle = excluded.detalle, creado = now();
    v_n := v_n + 1;
    v_dia := v_dia + 1;
  end loop;
  return v_n;
end $$;

-- Cálculo nocturno (supabase/cron.sql): todos los negocios activos
create or replace function public.recalcular_todo(p_desde date)
returns int language plpgsql security definer set search_path = public as $$
declare r record; v int := 0;
begin
  perform public.vencer_monedas();
  for r in select id from public.negocios where activo loop
    v := v + public.recalcular_metricas(r.id, p_desde);
  end loop;
  return v;
end $$;

create or replace function public.admin_recalcular(p_negocio uuid, p_desde date)
returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'no autorizado'; end if;
  return public.recalcular_metricas(p_negocio, greatest(p_desde, (public._ahora() at time zone 'America/Bogota')::date - 400));
end $$;

-- ---------- Informes en PDF (Storage, bucket privado "informes"; ver supabase/storage.sql) ----------
create table if not exists public.informes (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  periodo    text not null check (char_length(periodo) between 2 and 40),   -- ej. "2026 · 4.º trimestre"
  ruta       text not null unique,                                         -- <negocio_id>/<uuid>.pdf (no adivinable)
  creado     timestamptz not null default now()
);
create index if not exists informes_negocio_idx on public.informes(negocio_id, creado);
alter table public.informes enable row level security;
drop policy if exists admin_todo on public.informes;
create policy admin_todo on public.informes for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------- Nivel 1 para los paneles: días pasados de metricas_diarias + hoy en vivo ----------
create or replace function public._nivel1(p_negocio uuid, p_dias int)
returns json language sql stable as $$
  with lim as (
    select (public._ahora() at time zone 'America/Bogota')::date as hoy,
           (public._ahora() at time zone 'America/Bogota')::date - (greatest(1, least(p_dias, 365)) - 1) as desde
  ),
  dias as (select generate_series(lim.desde, lim.hoy, interval '1 day')::date as d from lim),
  -- Día pasado guardado → se lee; día sin guardar o de hoy → se calcula en vivo
  m as (
    select d.d as fecha, md.metrica, md.valor, md.detalle
    from dias d join public.metricas_diarias md on md.negocio_id = p_negocio and md.fecha = d.d
    where d.d < (select hoy from lim)
    union all
    select d.d, x.metrica, x.valor, x.detalle
    from dias d cross join lateral public._metricas_dia(p_negocio, d.d) x
    where d.d = (select hoy from lim)
       or not exists (select 1 from public.metricas_diarias md2 where md2.negocio_id = p_negocio and md2.fecha = d.d)
  ),
  suma as (select metrica, sum(valor) as total from m group by metrica),
  hoy as (select metrica, valor, detalle from m where fecha = (select hoy from lim)),
  horas as (
    select dw, h, sum(n)::int as n from (
      select (m.detalle->>'dow')::int as dw, (x.ord - 1)::int as h, x.n::int as n
      from m, jsonb_array_elements_text(m.detalle->'horas') with ordinality x(n, ord)
      where m.metrica = 'visitas_por_hora'
    ) y group by dw, h
  ),
  maq as (
    select key as producto_id, sum(value::int) as n from m, jsonb_each_text(m.detalle)
    where m.metrica = 'uso_maquinas' group by key
  ),
  s as (select * from suma)
  select json_build_object(
    'desde', (select desde from lim), 'hasta', (select hoy from lim), 'dias', greatest(1, least(p_dias, 365)),
    'visitas_portal', coalesce((select total from s where metrica = 'visitas_portal'), 0),
    'clics_resena', coalesce((select total from s where metrica = 'clics_resena'), 0),
    'conversion_resena', case when coalesce((select total from s where metrica = 'visitas_portal'), 0) = 0 then null
      else round((select total from s where metrica = 'clics_resena') / (select total from s where metrica = 'visitas_portal'), 4) end,
    'visitas', coalesce((select total from s where metrica = 'visitas'), 0),
    'inscritos_total', (select valor from hoy where metrica = 'inscritos_total'),
    'inscritos_nuevos', coalesce((select total from s where metrica = 'inscritos_nuevos'), 0),
    'activos', (select valor from hoy where metrica = 'activos'),
    'en_riesgo', (select valor from hoy where metrica = 'en_riesgo'),
    'frecuencia', (select detalle from hoy where metrica = 'frecuencia'),
    'retorno_30', (select valor from hoy where metrica = 'retorno_30'),
    'recencia', (select detalle from hoy where metrica = 'recencia'),
    'abandono_mensual', (select detalle from hoy where metrica = 'abandono_mensual'),
    'devolucion_real', json_build_object(
      'premios', coalesce((select total from s where metrica = 'premios_valor'), 0),
      'ventas', coalesce((select total from s where metrica = 'ventas'), 0),
      'tasa', case when coalesce((select total from s where metrica = 'ventas'), 0) = 0 then null
        else round(coalesce((select total from s where metrica = 'premios_valor'), 0) / (select total from s where metrica = 'ventas'), 4) end),
    'uso_maquinas', (select coalesce(json_agg(json_build_object('nombre', p.nombre, 'n', maq.n) order by maq.n desc, p.nombre), '[]'::json)
                     from maq join public.productos p on p.id::text = maq.producto_id),
    'horas_pico', (select json_agg((select json_agg(coalesce((select horas.n from horas where horas.dw = d.d and horas.h = hh.h), 0) order by hh.h)
                                    from generate_series(0, 23) hh(h)) order by d.d) from generate_series(0, 6) d(d)),
    'serie_visitas_portal', (select json_agg(json_build_object('dia', d.d, 'n', coalesce((select valor from m where m.fecha = d.d and m.metrica = 'visitas_portal'), 0)) order by d.d) from dias d),
    'serie_visitas', (select json_agg(json_build_object('dia', d.d, 'n', coalesce((select valor from m where m.fecha = d.d and m.metrica = 'visitas'), 0)) order by d.d) from dias d)
  )
$$;

create or replace function public.stats_admin(p_negocio uuid, p_dias int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'no autorizado';
  end if;
  return (public._stats_negocio(p_negocio, p_dias)::jsonb
          || jsonb_build_object('sector', (select sector from public.negocios where id = p_negocio),
                                'nivel1', public._nivel1(p_negocio, p_dias),
                                'gimnasio', public._stats_gimnasio(p_negocio, true)))::json;
end $$;

create or replace function public.stats_token(p_token text, p_dias int default 30)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('negocio', n.nombre, 'color', n.color,
    'stats', (public._stats_negocio(n.id, p_dias)::jsonb
              || jsonb_build_object('sector', n.sector, 'nivel1', public._nivel1(n.id, p_dias),
                                    'gimnasio', public._stats_gimnasio(n.id, false)))::json,
    'informes', (select coalesce(json_agg(json_build_object('id', i.id, 'periodo', i.periodo, 'creado', i.creado) order by i.creado desc), '[]'::json)
                 from public.informes i where i.negocio_id = n.id))
  from public.negocios n where n.token_stats = p_token;
$$;

-- ---------- Exportar para el estudio (solo admin): ids anonimizados, sin nombres ni teléfonos ----------
create or replace function public.exportar_estudio(p_negocio uuid, p_desde date, p_hasta date)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_sal text := encode(extensions.gen_random_bytes(16), 'hex');   -- aleatoria por exportación; no se guarda
begin
  if not public.es_admin() then raise exception 'no autorizado'; end if;
  return json_build_object(
    'negocio', (select json_build_object('sector', sector, 'desde', p_desde, 'hasta', p_hasta) from public.negocios where id = p_negocio),
    'visitas', (
      select coalesce(json_agg(json_build_object(
        'cliente', md5(v.persona || v_sal), 'fecha', v.dia, 'hora', v.hora, 'dia_semana', v.dow,
        'origen', case when v.persona like 's:%' then 'entrada' else 'caja' end) order by v.momento), '[]'::json)
      from public._visitas(p_negocio) v where v.dia between p_desde and p_hasta),
    'clientes', (
      select coalesce(json_agg(json_build_object(
        'cliente', md5('c:' || m.id::text || v_sal), 'inscrito', (m.creado at time zone 'America/Bogota')::date,
        'visitas', m.visitas, 'saldo', m.saldo, 'total_ganado', m.total_ganado,
        'ultima_visita', (m.ultima_visita at time zone 'America/Bogota')::date) order by m.creado), '[]'::json)
      from public.membresias m where m.negocio_id = p_negocio),
    'canjes', (
      select coalesce(json_agg(json_build_object(
        'cliente', md5('c:' || mv.membresia_id::text || v_sal), 'fecha', (mv.creado at time zone 'America/Bogota')::date,
        'monedas', -mv.monedas, 'valor_pesos', -mv.monedas * public.valor_moneda(), 'premio', p.nombre) order by mv.creado), '[]'::json)
      from public.movimientos mv left join public.premios p on p.id = mv.premio_id
      where mv.negocio_id = p_negocio and mv.tipo = 'canje'
        and (mv.creado at time zone 'America/Bogota')::date between p_desde and p_hasta),
    'entradas', (
      select coalesce(json_agg(json_build_object(
        'socio', md5('s:' || e.socio_id::text || v_sal), 'fecha', (e.fecha_hora at time zone 'America/Bogota')::date,
        'hora', extract(hour from e.fecha_hora at time zone 'America/Bogota')::int, 'origen', e.origen,
        'plan', s.plan) order by e.fecha_hora), '[]'::json)
      from public.entradas e join public.socios s on s.id = e.socio_id
      where e.negocio_id = p_negocio and (e.fecha_hora at time zone 'America/Bogota')::date between p_desde and p_hasta)
  );
end $$;

-- El link del dueño pide la ruta de UN informe con su token; un token de otro negocio no obtiene nada
create or replace function public.informe_ruta(p_token text, p_informe uuid)
returns text language sql stable security definer set search_path = public as $$
  select i.ruta from public.informes i join public.negocios n on n.id = i.negocio_id
  where n.token_stats = p_token and i.id = p_informe
$$;

-- Permisos
revoke execute on function public.metrica_visitas_portal(uuid, date)   from public, anon, authenticated;
revoke execute on function public.metrica_clics_resena(uuid, date)     from public, anon, authenticated;
revoke execute on function public.metrica_inscritos(uuid, date)        from public, anon, authenticated;
revoke execute on function public.metrica_visitas(uuid, date)          from public, anon, authenticated;
revoke execute on function public.metrica_frecuencia(uuid, date)       from public, anon, authenticated;
revoke execute on function public.metrica_retorno_30(uuid, date)       from public, anon, authenticated;
revoke execute on function public.metrica_recencia(uuid, date)         from public, anon, authenticated;
revoke execute on function public.metrica_devolucion_real(uuid, date)  from public, anon, authenticated;
revoke execute on function public.metrica_uso_maquinas(uuid, date)     from public, anon, authenticated;
revoke execute on function public._metricas_dia(uuid, date)            from public, anon, authenticated;
revoke execute on function public.recalcular_metricas(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.recalcular_todo(date)                from public, anon, authenticated;
revoke execute on function public._nivel1(uuid, int)                   from public, anon, authenticated;
revoke execute on function public.admin_recalcular(uuid, date)         from public, anon;
grant  execute on function public.admin_recalcular(uuid, date)         to authenticated;
revoke execute on function public.exportar_estudio(uuid, date, date)   from public, anon;
grant  execute on function public.exportar_estudio(uuid, date, date)   to authenticated;
grant  execute on function public.informe_ruta(text, uuid)             to anon, authenticated;

-- Para la política de Storage (storage.sql): ¿esta ruta es un informe registrado? (anon no puede leer la tabla)
create or replace function public.informe_existe(p_ruta text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.informes where ruta = p_ruta)
$$;
grant execute on function public.informe_existe(text) to anon, authenticated;

-- =====================================================================
-- ===== Fase 5 =====  carta del café (catálogo de platos) + "Elige por mí"
-- categorias y productos se crearon en la Fase 3; aquí: eventos, carta pública y "tiene carta".
-- =====================================================================
create table if not exists public.eventos_carta (
  id          bigint generated always as identity primary key,
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  tipo        text not null check (tipo in ('ver_carta', 'ver_producto', 'girar', 'ruleta_acepto')),
  tag_codigo  text,
  creado      timestamptz not null default now()
);
create index if not exists eventos_carta_negocio_idx on public.eventos_carta(negocio_id, creado);
alter table public.eventos_carta enable row level security;
drop policy if exists admin_todo on public.eventos_carta;
create policy admin_todo on public.eventos_carta for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Antojos de "Elige por mí" y filtros de la carta (valores permitidos en productos.etiquetas)
alter table public.productos drop constraint if exists productos_etiquetas_check;
alter table public.productos add constraint productos_etiquetas_check
  check (etiquetas <@ array['vegetariano', 'vegano', 'picante', 'sin_gluten', 'nuevo', 'dulce', 'salado', 'bebida']::text[]);

-- ¿El negocio tiene carta propia? (platos o servicios activos) — decide a dónde va "Ver la carta"
create or replace function public._tiene_carta(p_negocio uuid)
returns boolean language sql stable as $$
  select exists (select 1 from public.productos p where p.negocio_id = p_negocio and p.activo and p.tipo in ('plato', 'servicio'))
$$;
revoke execute on function public._tiene_carta(uuid) from public, anon, authenticated;

-- negocio_publico + tiene_carta (sigue sin nada privado)
create or replace function public.negocio_publico(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'slug', slug, 'nombre', nombre, 'descripcion', descripcion, 'logo_url', logo_url, 'color', color,
    'menu_url', menu_url, 'resena_url', resena_url, 'whatsapp', whatsapp, 'instagram', instagram,
    'wifi_nombre', wifi_nombre, 'wifi_clave', wifi_clave, 'links', links,
    'sector', sector, 'servicios', servicios, 'ubicacion_etiqueta', ubicacion_etiqueta,
    'tiene_carta', public._tiene_carta(id)
  )
  from public.negocios where slug = lower(trim(p_slug)) and activo;
$$;

-- La carta en UNA llamada: categorías activas en orden + platos activos (destacados primero, agotados al final)
create or replace function public.carta_publica(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  with n as (select id from public.negocios where slug = lower(trim(p_slug)) and activo),
  p as (
    select pr.* from public.productos pr, n
    where pr.negocio_id = n.id and pr.activo and pr.tipo in ('plato', 'servicio')
  ),
  item as (
    select p.categoria_id, json_build_object('id', p.id, 'nombre', p.nombre, 'descripcion', p.descripcion, 'precio', p.precio,
      'foto_url', p.foto_url, 'etiquetas', p.etiquetas, 'destacado', p.destacado, 'agotado', p.agotado) as j,
      p.agotado, p.destacado, p.orden, p.nombre
    from p
  )
  select json_build_object(
    'categorias', (
      select coalesce(json_agg(json_build_object('id', c.id, 'nombre', c.nombre,
        'productos', (select json_agg(i.j order by i.agotado, i.destacado desc, i.orden, i.nombre) from item i where i.categoria_id = c.id))
        order by c.orden, c.nombre), '[]'::json)
      from public.categorias c, n
      where c.negocio_id = n.id and c.activo and exists (select 1 from item i where i.categoria_id = c.id)
    ),
    'otros', (select json_agg(i.j order by i.agotado, i.destacado desc, i.orden, i.nombre) from item i
              where i.categoria_id is null or not exists (select 1 from public.categorias c where c.id = i.categoria_id and c.activo))
  )
  where exists (select 1 from n)
$$;

create or replace function public.registrar_evento_carta(p_slug text, p_tipo text, p_producto uuid default null, p_tag text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_negocio uuid;
begin
  if p_tipo not in ('ver_carta', 'ver_producto', 'girar', 'ruleta_acepto') then return; end if;
  select id into v_negocio from public.negocios where slug = lower(trim(p_slug)) and activo;
  if v_negocio is null then return; end if;
  if p_producto is not null and not exists (select 1 from public.productos where id = p_producto and negocio_id = v_negocio) then
    p_producto := null;
  end if;
  insert into public.eventos_carta (negocio_id, producto_id, tipo, tag_codigo, creado)
  values (v_negocio, p_producto, p_tipo, left(nullif(regexp_replace(coalesce(p_tag, ''), '[^a-z0-9]', '', 'g'), ''), 16), public._ahora());
end $$;

grant execute on function public.carta_publica(text)                          to anon, authenticated;
grant execute on function public.registrar_evento_carta(text, text, uuid, text) to anon, authenticated;

-- =====================================================================
-- ===== Fase 6 =====  club que engancha: hora dorada, racha con comodín, niveles y aviso único.
-- (caja_visita, club_tarjeta y caja_buscar, definidas en la Fase 2, ya llaman a estas funciones)
-- =====================================================================
alter table public.negocios add column if not exists bono_racha int not null default 30 check (bono_racha between 0 and 10000);
alter table public.negocios add column if not exists niveles jsonb not null default
  '[{"nombre":"Visitante","desde":0},{"nombre":"Habitual","desde":200},{"nombre":"De la casa","desde":600},{"nombre":"Leyenda","desde":1500}]'::jsonb;
alter table public.membresias add column if not exists racha_semanas int not null default 0;
alter table public.membresias add column if not exists ultima_semana date;   -- lunes (Bogotá) de la última semana con visita
alter table public.membresias add column if not exists comodin_mes date;     -- primer día del mes en que usó el comodín

create table if not exists public.horas_doradas (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios(id) on delete cascade,
  dia_semana    int not null check (dia_semana between 0 and 6),   -- 0 = domingo
  hora_inicio   time not null,
  hora_fin      time not null check (hora_fin > hora_inicio),
  multiplicador numeric not null default 2 check (multiplicador between 1 and 3),
  activo        boolean not null default true,
  creado        timestamptz not null default now()
);
create index if not exists horas_doradas_negocio_idx on public.horas_doradas(negocio_id);
alter table public.horas_doradas enable row level security;
drop policy if exists admin_todo on public.horas_doradas;
create policy admin_todo on public.horas_doradas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Hora dorada activa en un momento (hora Bogotá) o null
create or replace function public._hora_dorada(p_negocio uuid, p_momento timestamptz)
returns json language sql stable as $$
  select json_build_object('multiplicador', h.multiplicador, 'desde', to_char(h.hora_inicio, 'HH24:MI'), 'hasta', to_char(h.hora_fin, 'HH24:MI'))
  from public.horas_doradas h
  where h.negocio_id = p_negocio and h.activo
    and h.dia_semana = extract(dow from p_momento at time zone 'America/Bogota')::int
    and (p_momento at time zone 'America/Bogota')::time >= h.hora_inicio
    and (p_momento at time zone 'America/Bogota')::time < h.hora_fin
  order by h.multiplicador desc limit 1
$$;

-- Próxima hora dorada en los 7 días siguientes (para "Próxima hora dorada: martes 3–5 p. m.")
create or replace function public._proxima_hora_dorada(p_negocio uuid, p_momento timestamptz)
returns json language sql stable as $$
  with l as (select (p_momento at time zone 'America/Bogota') as t)
  select json_build_object('dia', h.dia_semana, 'desde', to_char(h.hora_inicio, 'HH24:MI'), 'hasta', to_char(h.hora_fin, 'HH24:MI'),
                           'multiplicador', h.multiplicador)
  from public.horas_doradas h, l
  where h.negocio_id = p_negocio and h.activo
  order by ((h.dia_semana - extract(dow from l.t)::int + 7) % 7)
           + case when h.dia_semana = extract(dow from l.t)::int and h.hora_inicio <= l.t::time then 7 else 0 end,
           h.hora_inicio
  limit 1
$$;

-- Nivel por monedas GANADAS en total (canjear no baja el nivel). Se calcula, no se guarda.
create or replace function public._nivel(p_negocio uuid, p_total int)
returns json language sql stable as $$
  with nv as (
    select x.nombre, x.desde, row_number() over (order by x.desde) as i
    from public.negocios n, jsonb_to_recordset(n.niveles) as x(nombre text, desde int)
    where n.id = p_negocio
  ),
  actual as (select * from nv where desde <= coalesce(p_total, 0) order by desde desc limit 1),
  sig as (select * from nv where desde > coalesce(p_total, 0) order by desde limit 1)
  select json_build_object('nombre', (select nombre from actual), 'desde', (select desde from actual),
    'siguiente', (select json_build_object('nombre', nombre, 'desde', desde, 'faltan', desde - coalesce(p_total, 0)) from sig))
$$;

-- Avanzar la racha con una visita en la semana p_semana (lunes). Pura: la prueban los 4 casos.
--   misma semana → igual · semana siguiente → +1 · saltó 1 semana y no usó comodín este mes → +1 y gasta el comodín · si no → 1
create or replace function public._avanzar_racha(p_racha int, p_ultima date, p_comodin date, p_semana date)
returns json language sql immutable as $$
  select case
    when p_ultima is null then json_build_object('racha', 1, 'semana', p_semana, 'comodin_mes', p_comodin, 'uso_comodin', false)
    when p_semana = p_ultima then json_build_object('racha', greatest(coalesce(p_racha, 0), 1), 'semana', p_semana, 'comodin_mes', p_comodin, 'uso_comodin', false)
    when p_semana = p_ultima + 7 then json_build_object('racha', coalesce(p_racha, 0) + 1, 'semana', p_semana, 'comodin_mes', p_comodin, 'uso_comodin', false)
    when p_semana = p_ultima + 14 and (p_comodin is null or p_comodin <> date_trunc('month', p_semana)::date)
      then json_build_object('racha', coalesce(p_racha, 0) + 1, 'semana', p_semana, 'comodin_mes', date_trunc('month', p_semana)::date, 'uso_comodin', true)
    else json_build_object('racha', 1, 'semana', p_semana, 'comodin_mes', p_comodin, 'uso_comodin', false)
  end
$$;

-- Racha que se le muestra al cliente hoy: viva si vino esta semana, la pasada, o hace 2 con comodín disponible
create or replace function public._racha_vigente(p_racha int, p_ultima date, p_comodin date, p_semana date)
returns json language sql immutable as $$
  select case
    when p_ultima is null or coalesce(p_racha, 0) = 0 then json_build_object('semanas', 0, 'esta_semana', false, 'en_riesgo', false)
    when p_ultima = p_semana then json_build_object('semanas', p_racha, 'esta_semana', true, 'en_riesgo', false)
    when p_ultima = p_semana - 7 then json_build_object('semanas', p_racha, 'esta_semana', false, 'en_riesgo', true)
    when p_ultima = p_semana - 14 and (p_comodin is null or p_comodin <> date_trunc('month', p_semana)::date)
      then json_build_object('semanas', p_racha, 'esta_semana', false, 'en_riesgo', true)
    else json_build_object('semanas', 0, 'esta_semana', false, 'en_riesgo', false)
  end
$$;

-- Aviso ÚNICO de la tarjeta, con prioridad fija:
-- (1) bienvenida pendiente → (2) hora dorada activa → (3) premio alcanzable → (4) racha en riesgo → (5) te faltan N
create or replace function public._aviso_tarjeta(p_bienvenida int, p_dorada json, p_premio text, p_racha_riesgo int, p_cercano json)
returns json language sql immutable as $$
  select case
    when coalesce(p_bienvenida, 0) > 0 then json_build_object('tipo', 'bienvenida', 'n', p_bienvenida)
    when p_dorada is not null then json_build_object('tipo', 'hora_dorada', 'hasta', p_dorada->>'hasta', 'multiplicador', (p_dorada->>'multiplicador')::numeric)
    when p_premio is not null then json_build_object('tipo', 'premio', 'nombre', p_premio)
    when coalesce(p_racha_riesgo, 0) > 0 then json_build_object('tipo', 'racha', 'semanas', p_racha_riesgo)
    when p_cercano is not null then json_build_object('tipo', 'faltan', 'n', (p_cercano->>'faltan')::int, 'nombre', p_cercano->>'nombre')
    else null end
$$;

revoke execute on function public._hora_dorada(uuid, timestamptz)                 from public, anon, authenticated;
revoke execute on function public._proxima_hora_dorada(uuid, timestamptz)         from public, anon, authenticated;
revoke execute on function public._nivel(uuid, int)                               from public, anon, authenticated;
revoke execute on function public._avanzar_racha(int, date, date, date)           from public, anon, authenticated;
revoke execute on function public._racha_vigente(int, date, date, date)           from public, anon, authenticated;
revoke execute on function public._aviso_tarjeta(int, json, text, int, json)      from public, anon, authenticated;

-- =====================================================================
-- ===== Pieles y "Lo más pedido" (2026-11-23) =====
-- Cada negocio puede elegir el estilo de su portal (null = el de su sector) y la carta muestra arriba lo más pedido.
-- =====================================================================
alter table public.negocios add column if not exists tema text check (tema in ('calido', 'limpio', 'noche', 'energia'));

-- negocio_publico + tema (sigue sin nada privado)
create or replace function public.negocio_publico(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'slug', slug, 'nombre', nombre, 'descripcion', descripcion, 'logo_url', logo_url, 'color', color,
    'menu_url', menu_url, 'resena_url', resena_url, 'whatsapp', whatsapp, 'instagram', instagram,
    'wifi_nombre', wifi_nombre, 'wifi_clave', wifi_clave, 'links', links,
    'sector', sector, 'servicios', servicios, 'ubicacion_etiqueta', ubicacion_etiqueta,
    'tiene_carta', public._tiene_carta(id), 'tema', tema
  )
  from public.negocios where slug = lower(trim(p_slug)) and activo;
$$;

-- Lo más pedido: platos disponibles con más "ver producto" + "lo pido" en 30 días; si no hay datos, los destacados
create or replace function public.carta_populares(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  with n as (select id from public.negocios where slug = lower(trim(p_slug)) and activo),
  vistas as (
    select e.producto_id, count(*) * (case when e.tipo = 'ruleta_acepto' then 3 else 1 end) as puntos
    from public.eventos_carta e, n
    where e.negocio_id = n.id and e.producto_id is not null and e.tipo in ('ver_producto', 'ruleta_acepto')
      and e.creado > public._ahora() - interval '30 days'
    group by e.producto_id, e.tipo
  ),
  p as (
    select pr.id, pr.nombre, pr.precio, pr.foto_url, pr.destacado,
           coalesce((select sum(v.puntos) from vistas v where v.producto_id = pr.id), 0) as puntos
    from public.productos pr, n
    where pr.negocio_id = n.id and pr.activo and not pr.agotado and pr.tipo in ('plato', 'servicio')
  )
  select coalesce(json_agg(json_build_object('id', id, 'nombre', nombre, 'precio', precio, 'foto_url', foto_url)
                  order by puntos desc, destacado desc, nombre), '[]'::json)
  from (select * from p where puntos > 0 or destacado order by puntos desc, destacado desc, nombre limit 6) x
$$;
grant execute on function public.carta_populares(text) to anon, authenticated;

-- =====================================================================
-- ===== Fase 7 =====  mensualidades: vencimiento + gracia apagan el portal
-- =====================================================================
alter table public.empresas add column if not exists vence date;                       -- hasta cuándo está pagado
alter table public.empresas add column if not exists dias_gracia int not null default 5 check (dias_gracia between 0 and 60);

-- ¿El negocio puede mostrarse? Activo y su empresa al día (o dentro de la gracia). Sin empresa o sin fecha = al día.
create or replace function public._negocio_habilitado(p_negocio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select n.activo and (e.id is null or e.vence is null
           or (public._ahora() at time zone 'America/Bogota')::date <= e.vence + e.dias_gracia)
    from public.negocios n left join public.empresas e on e.id = n.empresa_id
    where n.id = p_negocio), false)
$$;
revoke execute on function public._negocio_habilitado(uuid) from public, anon, authenticated;

-- Estado de pago para el admin: al_dia | por_vencer (≤ 5 días) | gracia | vencido
create or replace function public._estado_pago(p_vence date, p_gracia int)
returns json language sql stable set search_path = public as $$
  with h as (select (public._ahora() at time zone 'America/Bogota')::date as hoy)
  select case
    when p_vence is null then json_build_object('estado', 'al_dia', 'dias', null)
    when (select hoy from h) <= p_vence - 6 then json_build_object('estado', 'al_dia', 'dias', p_vence - (select hoy from h))
    when (select hoy from h) <= p_vence then json_build_object('estado', 'por_vencer', 'dias', p_vence - (select hoy from h))
    when (select hoy from h) <= p_vence + p_gracia then json_build_object('estado', 'gracia', 'dias', p_vence + p_gracia - (select hoy from h))
    else json_build_object('estado', 'vencido', 'dias', (select hoy from h) - p_vence) end
$$;

create or replace function public.mensualidades_admin()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'no autorizado'; end if;
  return (
    select coalesce(json_agg(json_build_object('id', e.id, 'nombre', e.nombre, 'plan', e.plan, 'vence', e.vence, 'dias_gracia', e.dias_gracia,
      'estado', public._estado_pago(e.vence, e.dias_gracia),
      'negocios', (select coalesce(json_agg(json_build_object('nombre', n.nombre, 'slug', n.slug) order by n.nombre), '[]'::json)
                   from public.negocios n where n.empresa_id = e.id)) order by e.vence nulls last, e.nombre), '[]'::json)
    from public.empresas e);
end $$;

-- Registrar un pago: corre el vencimiento N meses (desde hoy si ya estaba vencido)
create or replace function public.registrar_pago(p_empresa uuid, p_meses int default 1)
returns date language plpgsql security definer set search_path = public as $$
declare v_hoy date := (public._ahora() at time zone 'America/Bogota')::date; v date;
begin
  if not public.es_admin() then raise exception 'no autorizado'; end if;
  if p_meses not between 1 and 24 then raise exception 'meses inválidos'; end if;
  update public.empresas set vence = (greatest(coalesce(vence, v_hoy), v_hoy) + make_interval(months => p_meses))::date,
         estado_pago = 'al_dia'
  where id = p_empresa returning vence into v;
  return v;
end $$;
revoke execute on function public.mensualidades_admin() from public, anon;
grant execute on function public.mensualidades_admin() to authenticated;
revoke execute on function public.registrar_pago(uuid, int) from public, anon;
grant execute on function public.registrar_pago(uuid, int) to authenticated;
revoke execute on function public._estado_pago(date, int) from public, anon, authenticated;

-- El portal y el toque respetan la mensualidad (vencido + gracia → /inactivo)
create or replace function public.negocio_publico(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'slug', slug, 'nombre', nombre, 'descripcion', descripcion, 'logo_url', logo_url, 'color', color,
    'menu_url', menu_url, 'resena_url', resena_url, 'whatsapp', whatsapp, 'instagram', instagram,
    'wifi_nombre', wifi_nombre, 'wifi_clave', wifi_clave, 'links', links,
    'sector', sector, 'servicios', servicios, 'ubicacion_etiqueta', ubicacion_etiqueta,
    'tiene_carta', public._tiene_carta(id), 'tema', tema
  )
  from public.negocios where slug = lower(trim(p_slug)) and activo and public._negocio_habilitado(id);
$$;

-- Todo negocio nuevo sin empresa recibe una con su mismo nombre (quien paga la mensualidad)
create or replace function public._empresa_por_defecto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.empresa_id is null then
    insert into public.empresas (nombre) values (new.nombre) returning id into new.empresa_id;
  end if;
  return new;
end $$;
revoke execute on function public._empresa_por_defecto() from public, anon, authenticated;
drop trigger if exists negocios_empresa on public.negocios;
create trigger negocios_empresa before insert on public.negocios for each row execute function public._empresa_por_defecto();
