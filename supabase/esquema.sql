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
  if not n.activo then
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
    'estado', 'ok', 'destino', t.destino, 'slug', n.slug, 'url', t.url_personalizada,
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
  check (destino in ('hub', 'menu', 'resena', 'whatsapp', 'instagram', 'wifi', 'url', 'club'));

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

  return json_build_object(
    'negocio', n.nombre, 'nombre', v_nombre, 'saldo', v_saldo,
    'bienvenida_pendiente', m.bienvenida_pendiente, 'visitas', m.visitas,
    'ultima_visita', m.ultima_visita, 'vence', m.vence,
    'moneda_plural', n.moneda_plural, 'moneda_singular', n.moneda_singular,
    'premios', public._premios_json(n.id, v_saldo),
    'cercano', v_cercano,
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
    'premios', public._premios_json(v_negocio, m.saldo)
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

  insert into public.operaciones_caja (op_id, negocio_id, membresia_id, tipo, creado)
  values (p_op_id, v_negocio, m.id, 'visita', public._ahora());

  insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, valor_compra, op_id, creado)
  values (m.id, v_negocio, 'visita', v_monedas, case when n.modo_monedas = 'valor' then p_valor end, p_op_id, public._ahora());
  if v_bienvenida > 0 then
    insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, creado)
    values (m.id, v_negocio, 'bienvenida', v_bienvenida, public._ahora());
  end if;

  update public.membresias set
    saldo = saldo + v_monedas + v_bienvenida,
    total_ganado = total_ganado + v_monedas + v_bienvenida,
    visitas = visitas + 1,
    bienvenida_pendiente = 0,
    ultima_visita = public._ahora(),
    vence = public._ahora() + interval '12 months'
  where id = m.id
  returning * into m;

  v_res := jsonb_build_object('ok', true, 'monedas', v_monedas, 'bienvenida', v_bienvenida, 'saldo', m.saldo);
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
