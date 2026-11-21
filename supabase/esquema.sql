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

-- Un toque (NFC o QR): registra y devuelve a dónde mandar a la persona
create or replace function public.resolver_toque(p_codigo text, p_medio text default 'nfc', p_dispositivo text default null)
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

  insert into public.toques (tag_id, negocio_id, medio, dispositivo)
  values (t.id, n.id, case when p_medio = 'qr' then 'qr' else 'nfc' end, left(p_dispositivo, 20));

  return json_build_object(
    'estado', 'ok', 'destino', t.destino, 'slug', n.slug, 'url', t.url_personalizada,
    'menu_url', n.menu_url, 'resena_url', n.resena_url, 'whatsapp', n.whatsapp, 'instagram', n.instagram
  );
end $$;

-- Datos públicos para la página del negocio
create or replace function public.negocio_publico(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'slug', slug, 'nombre', nombre, 'descripcion', descripcion, 'logo_url', logo_url, 'color', color,
    'menu_url', menu_url, 'resena_url', resena_url, 'whatsapp', whatsapp, 'instagram', instagram,
    'wifi_nombre', wifi_nombre, 'wifi_clave', wifi_clave, 'links', links
  )
  from public.negocios where slug = lower(trim(p_slug)) and activo;
$$;

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

grant execute on function public.resolver_toque(text, text, text)  to anon, authenticated;
grant execute on function public.negocio_publico(text)             to anon, authenticated;
grant execute on function public.registrar_click(text, text, text) to anon, authenticated;
grant execute on function public.stats_token(text, int)            to anon, authenticated;
grant execute on function public.stats_admin(uuid, int)            to authenticated;
grant execute on function public.es_admin()                        to authenticated;
