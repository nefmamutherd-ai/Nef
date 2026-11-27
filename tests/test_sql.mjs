// Prueba el esquema en un Postgres embebido (pglite). Falla (exit 1) si algo no cumple.
// Uso: npm run test:sql
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
  create role anon; create role authenticated;
  create schema extensions; create extension pgcrypto schema extensions;  -- como en Supabase
  grant usage on schema extensions to anon, authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);
const sql = fs.readFileSync(process.argv[2] || new URL('../supabase/esquema.sql', import.meta.url), 'utf8');
await db.exec(sql);
await db.exec(sql); // el esquema debe poder correrse dos veces
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);

const q = async (s, p) => (await db.query(s, p)).rows;
const como = async (rol, uid = '') => db.exec(`reset role; set role ${rol}; set test.uid = '${uid}';`);
let ok = 0;
const caso = async (nombre, fn) => { await fn(); ok++; console.log('  ✓', nombre); };

const ADMIN = '11111111-1111-1111-1111-111111111111';
await db.exec(`insert into auth.users values ('${ADMIN}'); insert into public.admins values ('${ADMIN}');`);
const [neg] = await q(`insert into negocios (slug, nombre, menu_url, resena_url, whatsapp, links)
  values ('cafe-luna','Café Luna','https://menu.ejemplo/luna','https://g.page/r/xyz/review','3001234567',
  '[{"titulo":"Domicilios","url":"https://rappi.com"}]') returning id, token_stats`);
const tags = await q(`insert into tags (negocio_id, nombre) select $1, 'Mesa '||g from generate_series(1,3) g returning codigo, id`, [neg.id]);
const [libre] = await q(`insert into tags (nombre) values ('sin asignar') returning codigo`);

console.log('Esquema v1');
await como('anon');
await caso('toque NFC resuelve a la página del negocio', async () => {
  const [{ r }] = await q(`select resolver_toque($1,'nfc','android') r`, [tags[0].codigo.toUpperCase()]);
  assert.equal(r.estado, 'ok'); assert.equal(r.destino, 'hub'); assert.equal(r.slug, 'cafe-luna');
});
await caso('código inexistente y tag sin asignar', async () => {
  assert.equal((await q(`select resolver_toque('noexiste','nfc',null) r`))[0].r.estado, 'no_existe');
  assert.equal((await q(`select resolver_toque($1,'nfc',null) r`, [libre.codigo]))[0].r.estado, 'inactivo');
});
await caso('anónimo no lee tablas directo (RLS)', async () => {
  assert.equal((await q(`select count(*)::int n from negocios`))[0].n, 0);
  assert.equal((await q(`select count(*)::int n from tags`))[0].n, 0);
});
await caso('datos públicos no filtran notas ni token', async () => {
  const [{ r }] = await q(`select negocio_publico('cafe-luna') r`);
  assert.ok(!('notas' in r)); assert.ok(!('token_stats' in r));
});
await caso('clic válido se registra, botón inválido no', async () => {
  await q(`select registrar_click('cafe-luna','resena',$1)`, [tags[0].codigo]);
  await q(`select registrar_click('cafe-luna','<script>',null)`);
});
await caso('anónimo no accede a stats_admin ni a funciones internas', async () => {
  await assert.rejects(q(`select stats_admin($1, 30)`, [neg.id]), /no autorizado/);
  await assert.rejects(q(`select _stats_negocio($1, 30)`, [neg.id]), /permission denied/);
});
await caso('stats por token', async () => {
  await q(`select resolver_toque($1,'qr','ios')`, [tags[1].codigo]);
  const [{ r }] = await q(`select stats_token($1, 7) r`, [neg.token_stats]);
  assert.equal(r.stats.total, 2); assert.equal(r.stats.qr, 1); assert.equal(r.stats.resenas, 1);
  assert.equal(r.stats.por_dia.length, 7); assert.equal(r.stats.por_hora.length, 24);
  assert.equal((await q(`select stats_token('malo', 7) r`))[0].r, null);
});

await como('authenticated', ADMIN);
await caso('admin ve y crea', async () => {
  assert.equal((await q(`select count(*)::int n from negocios`))[0].n, 1);
  const [t] = await q(`insert into tags (nombre) values ('nuevo') returning codigo`);
  assert.match(t.codigo, /^[a-z0-9]{7}$/);
});
await caso('negocio inactivo apaga sus tags', async () => {
  await db.exec(`update negocios set activo=false`);
  await como('anon');
  assert.equal((await q(`select resolver_toque($1,'nfc',null) r`, [tags[0].codigo]))[0].r.estado, 'inactivo');
  await como('authenticated', ADMIN); await db.exec(`update negocios set activo=true`);
});
await caso('usuario logueado que no es admin no ve nada', async () => {
  await como('authenticated', '22222222-2222-2222-2222-222222222222');
  assert.equal((await q(`select count(*)::int n from tags`))[0].n, 0);
});

// ── Agrega aquí las pruebas de cada fase nueva (carta, ruleta, club…) ──

console.log('Fase 1 · cuentas, sector y antispam');
await caso('un negocio creado antes recibe empresa al correr el esquema', async () => {
  await db.exec('reset role;');
  await db.exec(`update negocios set empresa_id = null`);
  await db.exec(sql);
  const [n] = await q(`select n.empresa_id, e.nombre from negocios n join empresas e on e.id = n.empresa_id where n.slug = 'cafe-luna'`);
  assert.ok(n && n.empresa_id); assert.equal(n.nombre, 'Café Luna');
  const antes = (await q(`select count(*)::int n from empresas`))[0].n;
  await db.exec(sql); // otra vez: no crea empresas repetidas
  assert.equal((await q(`select count(*)::int n from empresas`))[0].n, antes);
});
await caso('negocio_publico trae sector y servicios, no empresa ni notas', async () => {
  await como('anon');
  const [{ r }] = await q(`select negocio_publico('cafe-luna') r`);
  assert.equal(r.sector, 'cafe'); assert.equal(r.servicios.base, true); assert.equal(r.servicios.club, false);
  assert.ok('ubicacion_etiqueta' in r);
  for (const k of ['empresa_id', 'notas', 'contacto_telefono', 'token_stats']) assert.ok(!(k in r), 'expone ' + k);
});
await caso('anónimo no lee empresas ni accesos', async () => {
  await como('anon');
  assert.equal((await q(`select count(*)::int n from empresas`))[0].n, 0);
  assert.equal((await q(`select count(*)::int n from accesos`))[0].n, 0);
  await como('authenticated', '22222222-2222-2222-2222-222222222222');
  assert.equal((await q(`select count(*)::int n from empresas`))[0].n, 0);
});
await caso('_ahora() obedece a nef.ahora', async () => {
  await db.exec(`set nef.ahora = '2026-01-01 00:00-05'`);
  const [{ r }] = await q(`select _ahora() = '2026-01-01 00:00-05'::timestamptz r`);
  assert.equal(r, true);
  await db.exec(`reset nef.ahora`);
  assert.equal((await q(`select abs(extract(epoch from _ahora() - now())) < 5 r`))[0].r, true);
});
await caso('antispam: un toque por dispositivo y tag cada 30 min', async () => {
  await como('anon');
  const disp = 'aaaaaaaa-0000-4000-8000-000000000001';
  const contar = async () => { await db.exec('reset role;'); const n = (await q(`select count(*)::int n from toques where dispositivo_id = $1`, [disp]))[0].n; await como('anon'); return n; };
  await db.exec(`set nef.ahora = '2026-01-10 10:00-05'`);
  await q(`select resolver_toque($1,'nfc','ios',$2)`, [tags[2].codigo, disp]);
  await db.exec(`set nef.ahora = '2026-01-10 10:05-05'`);
  const [{ r }] = await q(`select resolver_toque($1,'nfc','ios',$2) r`, [tags[2].codigo, disp]);
  assert.equal(r.estado, 'ok'); // igual entra al portal
  assert.equal(await contar(), 1);
  await db.exec(`set nef.ahora = '2026-01-10 10:31-05'`);
  await q(`select resolver_toque($1,'nfc','ios',$2)`, [tags[2].codigo, disp]);
  assert.equal(await contar(), 2);
  await db.exec(`reset nef.ahora`);
});
await caso('tag_publico solo da el nombre si el tag es del negocio', async () => {
  await como('anon');
  assert.equal((await q(`select tag_publico('cafe-luna', $1) r`, [tags[0].codigo]))[0].r, 'Mesa 1');
  assert.equal((await q(`select tag_publico('otro-negocio', $1) r`, [tags[0].codigo]))[0].r, null);
  assert.equal((await q(`select tag_publico('cafe-luna', $1) r`, [libre.codigo]))[0].r, null);
});
await caso('antispam: sin dispositivo_id se cuenta siempre', async () => {
  await db.exec('reset role;');
  const antes = (await q(`select count(*)::int n from toques where tag_id = $1`, [tags[2].id]))[0].n;
  await como('anon');
  await q(`select resolver_toque($1,'qr',null)`, [tags[2].codigo]);
  await q(`select resolver_toque($1,'qr',null)`, [tags[2].codigo]);
  await db.exec('reset role;');
  assert.equal((await q(`select count(*)::int n from toques where tag_id = $1`, [tags[2].id]))[0].n, antes + 2);
});

console.log('Fase 2 · club y caja');
const uid = () => crypto.randomUUID();
await db.exec('reset role;');
await db.exec(`update negocios set servicios = servicios || '{"club":true}' where slug = 'cafe-luna'`);
const [premio8k] = await q(`insert into premios (negocio_id, nombre, valor_pesos) values ($1, 'Capuchino', 8000) returning id`, [neg.id]);
const [premio20k] = await q(`insert into premios (negocio_id, nombre, valor_pesos) values ($1, 'Desayuno', 20000) returning id`, [neg.id]);
await como('authenticated', ADMIN);
await q(`select fijar_pin_caja($1, '4321')`, [neg.id]);

await caso('anónimo no lee ninguna tabla del club', async () => {
  await como('anon');
  for (const t of ['clientes', 'membresias', 'movimientos', 'premios', 'sesiones_caja', 'intentos_pin', 'operaciones_caja'])
    assert.equal((await q(`select count(*)::int n from ${t}`))[0].n, 0, t);
});
await caso('costo del premio = ceil(valor / 100): $8.000 = 80 monedas', async () => {
  await como('anon');
  assert.equal((await q(`select costo_premio(8000) r`))[0].r, 80);
  assert.equal((await q(`select costo_premio(8050) r`))[0].r, 81);
});
await caso('registro sin autorización → error y no crea filas', async () => {
  await como('anon');
  const [{ r }] = await q(`select club_registrar('cafe-luna','Laura','3001112233', false) r`);
  assert.equal(r.error, 'autorizacion');
  await db.exec('reset role;');
  assert.equal((await q(`select count(*)::int n from clientes`))[0].n, 0);
});
await caso('registro valida celular y nombre', async () => {
  await como('anon');
  assert.equal((await q(`select club_registrar('cafe-luna','Laura','12345', true) r`))[0].r.error, 'telefono');
  assert.equal((await q(`select club_registrar('cafe-luna','L','3001112233', true) r`))[0].r.error, 'nombre');
});
let tokenLaura;
await caso('registrarse dos veces con el mismo celular → 1 membresía, mismo token', async () => {
  await como('anon');
  const [{ r: a }] = await q(`select club_registrar('cafe-luna','Laura Martínez','300 111 2233', true) r`);
  const [{ r: b }] = await q(`select club_registrar('cafe-luna','laura','3001112233', true) r`);
  assert.ok(a.token); assert.equal(a.token, b.token); assert.equal(b.nuevo, false);
  tokenLaura = a.token;
  await db.exec('reset role;');
  assert.equal((await q(`select count(*)::int n from membresias`))[0].n, 1);
});
await caso('con el celular de otra persona y otro nombre no se obtiene su tarjeta', async () => {
  await como('anon');
  const [{ r }] = await q(`select club_registrar('cafe-luna','Pedro','3001112233', true) r`);
  assert.equal(r.error, 'ya_registrado'); assert.ok(!r.token);
});
await caso('recién registrado: saldo 0 y bienvenida pendiente 50; la tarjeta no trae teléfono', async () => {
  await como('anon');
  const [{ r }] = await q(`select club_tarjeta('cafe-luna', $1) r`, [tokenLaura]);
  assert.equal(r.saldo, 0); assert.equal(r.bienvenida_pendiente, 50); assert.equal(r.nombre, 'Laura Martínez');
  assert.ok(!JSON.stringify(r).includes('3001112233'));
  assert.ok(!('telefono' in r));
  assert.equal(r.cercano.nombre, 'Capuchino'); assert.equal(r.cercano.faltan, 80);
});
await caso('club_tarjeta con token de otro negocio → error', async () => {
  await db.exec('reset role;');
  await q(`insert into negocios (slug, nombre, servicios) values ('gym-forja','Forja Gym','{"base":true,"club":true}')`);
  await como('anon');
  assert.equal((await q(`select club_tarjeta('gym-forja', $1) r`, [tokenLaura]))[0].r.error, 'token');
  assert.equal((await q(`select club_tarjeta('cafe-luna', 'inventado') r`))[0].r.error, 'token');
});
await caso('negocio sin servicio de club no inscribe', async () => {
  await db.exec('reset role;');
  await q(`insert into negocios (slug, nombre) values ('sin-club','Sin Club')`);
  await como('anon');
  assert.equal((await q(`select club_registrar('sin-club','Ana','3009998877', true) r`))[0].r.error, 'club');
});

let sesion;
await caso('PIN malo dice cuántos intentos quedan; PIN bueno abre sesión', async () => {
  await como('anon');
  const [{ r: malo }] = await q(`select caja_entrar('cafe-luna','0000') r`);
  assert.equal(malo.error, 'pin'); assert.equal(malo.quedan, 9);
  const [{ r: bueno }] = await q(`select caja_entrar('cafe-luna','4321') r`);
  assert.ok(bueno.sesion); assert.equal(bueno.modo, 'visita'); assert.equal(bueno.premios.length, 2);
  assert.ok(!JSON.stringify(bueno).includes('pin_caja_hash'));
  sesion = bueno.sesion;
});
await caso('anónimo no puede ejecutar _sesion_valida ni fijar el PIN', async () => {
  await como('anon');
  await assert.rejects(q(`select _sesion_valida('x')`), /permission denied/);
  await assert.rejects(q(`select fijar_pin_caja($1,'1111')`, [neg.id]), /permission denied/);
});
await caso('caja busca por celular y por token', async () => {
  await como('anon');
  const [{ r: a }] = await q(`select caja_buscar($1, '300 111 2233') r`, [sesion]);
  assert.equal(a.nombre, 'Laura Martínez'); assert.equal(a.puede_sumar, true); assert.equal(a.token, tokenLaura);
  const [{ r: b }] = await q(`select caja_buscar($1, $2) r`, [sesion, tokenLaura]);
  assert.equal(b.nombre, 'Laura Martínez');
  assert.equal((await q(`select caja_buscar($1, '3005550000') r`, [sesion]))[0].r.error, 'no_existe');
  assert.equal((await q(`select caja_buscar('mala', '3001112233') r`))[0].r.error, 'sesion');
});
await caso('primera visita activa la bienvenida (50 + 10 = 60) y la misma op_id no suma dos veces', async () => {
  await como('anon');
  await db.exec(`set nef.ahora = '2026-11-22 10:00-05'`);
  // la sesión se creó con la hora real; se renueva con la hora simulada
  sesion = (await q(`select caja_entrar('cafe-luna','4321') r`))[0].r.sesion;
  const op = uid();
  const [{ r: a }] = await q(`select caja_visita($1, $2, $3) r`, [sesion, tokenLaura, op]);
  assert.equal(a.ok, true); assert.equal(a.monedas, 10); assert.equal(a.bienvenida, 50); assert.equal(a.saldo, 60);
  const [{ r: b }] = await q(`select caja_visita($1, $2, $3) r`, [sesion, tokenLaura, op]);
  assert.deepEqual(b, a);
  const [{ r: t }] = await q(`select club_tarjeta('cafe-luna', $1) r`, [tokenLaura]);
  assert.equal(t.saldo, 60); assert.equal(t.bienvenida_pendiente, 0);
});
await caso('segunda visita antes de 3 h → muy_pronto; a las 3 h suma', async () => {
  await como('anon');
  await db.exec(`set nef.ahora = '2026-11-22 11:00-05'`);
  const [{ r: a }] = await q(`select caja_visita($1, $2, $3) r`, [sesion, tokenLaura, uid()]);
  assert.equal(a.error, 'muy_pronto'); assert.ok(a.desde);
  await db.exec(`set nef.ahora = '2026-11-22 13:00-05'`);
  const [{ r: b }] = await q(`select caja_visita($1, $2, $3) r`, [sesion, tokenLaura, uid()]);
  assert.equal(b.saldo, 70);
});
await caso('canje sin saldo → error y no crea movimiento; con saldo descuenta', async () => {
  await como('anon');
  const [{ r: a }] = await q(`select caja_canje($1, $2, $3, $4) r`, [sesion, tokenLaura, premio20k.id, uid()]);
  assert.equal(a.error, 'saldo'); assert.equal(a.faltan, 130);
  await db.exec('reset role;');
  assert.equal((await q(`select count(*)::int n from movimientos where tipo = 'canje'`))[0].n, 0);
  await db.exec(`update membresias set saldo = 100, total_ganado = 100 where token = '${tokenLaura}'`);
  await como('anon');
  const op = uid();
  const [{ r: b }] = await q(`select caja_canje($1, $2, $3, $4) r`, [sesion, tokenLaura, premio8k.id, op]);
  assert.equal(b.ok, true); assert.equal(b.costo, 80); assert.equal(b.saldo, 20);
  const [{ r: c }] = await q(`select caja_canje($1, $2, $3, $4) r`, [sesion, tokenLaura, premio8k.id, op]);
  assert.equal(c.saldo, 20);
  await db.exec('reset role;');
  const [mb] = await q(`select saldo, total_ganado from membresias where token = $1`, [tokenLaura]);
  assert.equal(mb.saldo, 20); assert.equal(mb.total_ganado, 100); // canjear no baja el total ganado
});
await caso('modo valor: $160.000 al 5 % = 80 monedas', async () => {
  await db.exec('reset role;');
  await db.exec(`update negocios set modo_monedas = 'valor', devolucion_pct = 5 where slug = 'cafe-luna'`);
  await como('anon');
  await db.exec(`set nef.ahora = '2026-11-22 18:00-05'`);
  assert.equal((await q(`select caja_visita($1, $2, $3) r`, [sesion, tokenLaura, uid()]))[0].r.error, 'valor');
  const [{ r }] = await q(`select caja_visita($1, $2, $3, 160000) r`, [sesion, tokenLaura, uid()]);
  assert.equal(r.monedas, 80);
  await db.exec('reset role;');
  await db.exec(`update negocios set modo_monedas = 'visita' where slug = 'cafe-luna'`);
});
await caso('sesión vencida (+13 h) → error', async () => {
  await como('anon');
  await db.exec(`set nef.ahora = '2026-11-23 00:00-05'`);
  assert.equal((await q(`select caja_buscar($1, $2) r`, [sesion, tokenLaura]))[0].r.error, 'sesion');
});
await caso('11.º intento de PIN en una hora → bloqueado aunque el PIN sea correcto', async () => {
  await como('anon');
  await db.exec(`set nef.ahora = '2026-11-24 09:00-05'`);
  for (let i = 0; i < 10; i++) await q(`select caja_entrar('cafe-luna','9999')`);
  assert.equal((await q(`select caja_entrar('cafe-luna','4321') r`))[0].r.error, 'bloqueado');
  await db.exec(`set nef.ahora = '2026-11-24 10:01-05'`);
  assert.ok((await q(`select caja_entrar('cafe-luna','4321') r`))[0].r.sesion, 'una hora después se desbloquea');
});
await caso('las monedas vencen tras 12 meses sin visitas', async () => {
  await como('anon');
  await db.exec(`set nef.ahora = '2027-12-01 10:00-05'`);
  const [{ r: t }] = await q(`select club_tarjeta('cafe-luna', $1) r`, [tokenLaura]);
  assert.equal(t.saldo, 0);
  await db.exec('reset role;');
  assert.equal((await q(`select vencer_monedas() r`))[0].r, 1);
  const [mb] = await q(`select saldo from membresias where token = $1`, [tokenLaura]);
  assert.equal(mb.saldo, 0);
  assert.equal((await q(`select count(*)::int n from movimientos where tipo = 'vencimiento'`))[0].n, 1);
  await db.exec(`reset nef.ahora`);
});
await caso('ninguna RPC pública crea monedas salvo la caja (con sesión); reseñas no dan nada', async () => {
  await db.exec('reset role;');
  const filas = await q(`select p.proname from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
      and p.prosrc ~* '(insert\\s+into\\s+(public\\.)?movimientos|_sumar_visita\\s*\\()'`);
  // club_reclamar_compra y club_rapido solo canjean códigos que crea la caja (con sesión); club_maquina_terminar exige haber
  // registrado la llegada ese día en recepción, 15 min y 8 h entre premios (ver DECISIONES)
  assert.deepEqual(filas.map((f) => f.proname).sort(), ['caja_canje', 'caja_visita', 'club_maquina_terminar', 'club_rapido', 'club_reclamar_compra']);
  const antes = (await q(`select count(*)::int n from movimientos`))[0].n;
  await como('anon');
  await q(`select registrar_click('cafe-luna','resena',null)`);
  await db.exec('reset role;');
  assert.equal((await q(`select count(*)::int n from movimientos`))[0].n, antes);
});

console.log('Fase 3 · gimnasio');
const { leerCSV, mapeoSugerido, mapearFilas, fechaHora } = await import('../public/assets/csv.js');
await db.exec('reset role;');
const [gym] = await q(`select id from negocios where slug = 'gym-forja'`);
await db.exec(`update negocios set sector = 'gimnasio' where slug = 'gym-forja'`);
const csv = leerCSV(fs.readFileSync(new URL('./fixtures/entradas.csv', import.meta.url), 'utf8'));
const mapeo = mapeoSugerido(csv.cabecera);
const filasGym = mapearFilas(csv.filas, mapeo);
const importar = async (filas) => {
  const tot = { filas: 0, nuevas: 0, repetidas: 0, invalidas: 0 };
  for (let i = 0; i < filas.length; i += 5000) {
    const [{ r }] = await q(`select importar_entradas($1, $2::jsonb, $3::jsonb, 'entradas.csv') r`, [gym.id, JSON.stringify(filas.slice(i, i + 5000)), JSON.stringify(mapeo)]);
    for (const k in tot) tot[k] += r[k];
  }
  return tot;
};

await caso('el CSV se lee con ";" y se mapea solo (documento, fecha y hora aparte)', async () => {
  assert.equal(csv.separador, ';'); assert.equal(csv.filas.length, 5780);
  assert.equal(mapeo.codigo, 0); assert.equal(mapeo.fecha, 4); assert.equal(mapeo.hora, 5); assert.equal(mapeo.telefono, 2);
  assert.ok(filasGym.every((f) => f.fecha_hora));
  assert.equal(fechaHora('02/09/2026 6:05 p. m.'), '2026-09-02 18:05');
  assert.equal(fechaHora('2026-09-02 07:30'), '2026-09-02 07:30');
  assert.equal(fechaHora('12/01/2026 12:10 am'), '2026-01-12 00:10');
  assert.equal(fechaHora('31/02/2026 10:00'), null); // nunca adivinar
  assert.equal(fechaHora('ayer'), null);
});
await caso('anónimo no lee socios, entradas, importaciones ni el catálogo', async () => {
  await como('anon');
  for (const t of ['socios', 'entradas', 'importaciones', 'productos', 'categorias', 'festivos'])
    assert.equal((await q(`select count(*)::int n from ${t}`))[0].n, 0, t);
  await assert.rejects(q(`select importar_entradas($1, '[]'::jsonb)`, [gym.id]), /permission denied/);
  await assert.rejects(q(`select metrica_activos($1, '2026-11-30')`, [gym.id]), /permission denied/);
});
await caso('importar entradas: 5.780 nuevas; el mismo archivo otra vez → 0 nuevas', async () => {
  await como('authenticated', ADMIN);
  const a = await importar(filasGym);
  assert.deepEqual(a, { filas: 5780, nuevas: 5780, repetidas: 0, invalidas: 0 });
  const b = await importar(filasGym);
  assert.deepEqual(b, { filas: 5780, nuevas: 0, repetidas: 5780, invalidas: 0 });
  await db.exec('reset role;');
  assert.equal((await q(`select count(*)::int n from socios where negocio_id = $1`, [gym.id]))[0].n, 200);
  assert.ok((await q(`select mapeo_csv from negocios where id = $1`, [gym.id]))[0].mapeo_csv);
});
await caso('fecha inválida cuenta como inválida y no rompe el lote', async () => {
  await como('authenticated', ADMIN);
  const [{ r }] = await q(`select importar_entradas($1, $2::jsonb) r`, [gym.id, JSON.stringify([
    { codigo: '9001', fecha_hora: '2026-11-29 08:00' }, { codigo: '9001', fecha_hora: null },
    { codigo: '', fecha_hora: '2026-11-29 08:00' }, { codigo: '9002', fecha_hora: '2026-13-40 99:99' }])]);
  assert.deepEqual(r, { filas: 4, nuevas: 1, repetidas: 0, invalidas: 3 });
  await db.exec('reset role;');
  await db.exec(`delete from entradas where socio_id in (select id from socios where codigo_externo = '9001'); delete from socios where codigo_externo in ('9001','9002')`);
});
await caso('métricas al 30 nov 2026 = lo escrito en el generador', async () => {
  await db.exec('reset role;');
  assert.equal((await q(`select metrica_activos($1, '2026-11-30') r`, [gym.id]))[0].r, 160);
  const riesgo = (await q(`select metrica_en_riesgo($1, '2026-11-30') r`, [gym.id]))[0].r;
  assert.equal(riesgo.length, 40);
  assert.ok(riesgo.every((x) => x.dias === 61 && x.visitas === 13 && x.telefono));
  assert.deepEqual((await q(`select metrica_abandono_mensual($1, '2026-11-30') r`, [gym.id]))[0].r,
    { mes: '2026-11', activos_inicio: 120, abandonaron: 0, tasa: 0 });
  const rachas = (await q(`select metrica_racha($1, '2026-11-30') r`, [gym.id]))[0].r;
  const cuenta = {};
  for (const x of rachas) cuenta[x.racha] = (cuenta[x.racha] || 0) + 1;
  assert.deepEqual(cuenta, { 0: 40, 1: 20, 5: 20, 14: 120 });
  const pico = (await q(`select metrica_horas_pico($1, '2026-11-30') r`, [gym.id]))[0].r;
  assert.equal(pico.length, 7); assert.equal(pico[0].length, 24);
  assert.equal(pico[1][6], 1900); assert.equal(pico[3][18], 1940); assert.equal(pico[5][7], 1880); assert.equal(pico[4][12], 60);
  assert.equal(pico.flat().reduce((a, b) => a + b, 0), 5780);
});
await caso('abandono de octubre = 60 de 180 (0,3333)', async () => {
  assert.deepEqual((await q(`select metrica_abandono_mensual($1, '2026-10-31') r`, [gym.id]))[0].r,
    { mes: '2026-10', activos_inicio: 180, abandonaron: 60, tasa: 0.3333 });
});
await caso('umbral de "en riesgo" en SQL = el de lib/sectores/*.json', async () => {
  for (const s of ['cafe', 'gimnasio']) {
    const pq = (await import(`../lib/sectores/${s}.js`)).default;
    assert.equal((await q(`select _sector_en_riesgo_dias($1) r`, [s]))[0].r, pq.en_riesgo_dias, s);
  }
});
await caso('horario legal (Ley 2300)', async () => {
  await como('anon');
  const pe = async (t) => (await q(`select puede_escribir($1::timestamptz) r`, [t]))[0].r;
  assert.equal(await pe('2026-11-22 10:00-05'), false);  // domingo
  assert.equal(await pe('2026-11-21 15:30-05'), false);  // sábado 3:30 p. m.
  assert.equal(await pe('2026-11-21 14:59-05'), true);   // sábado 2:59 p. m.
  assert.equal(await pe('2026-11-24 08:00-05'), true);   // martes no festivo
  assert.equal(await pe('2026-11-24 19:00-05'), false);  // martes 7 p. m.
  assert.equal(await pe('2026-12-08 10:00-05'), false);  // Inmaculada Concepción
  assert.equal(await pe('2026-11-16 10:00-05'), false);  // lunes festivo
  const prox = async (t) => (await q(`select to_char(proxima_hora_permitida($1::timestamptz) at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') r`, [t]))[0].r;
  assert.equal(await prox('2026-11-22 10:00-05'), '2026-11-23 07:00');  // domingo → lunes 7
  assert.equal(await prox('2026-11-21 16:00-05'), '2026-11-23 07:00');  // sábado tarde → lunes 7
  assert.equal(await prox('2026-11-15 10:00-05'), '2026-11-17 07:00');  // domingo antes de lunes festivo → martes
  assert.equal(await prox('2026-11-24 06:00-05'), '2026-11-24 07:00');
});
await caso('estadísticas: el admin ve la lista con teléfonos; el link del dueño solo el conteo', async () => {
  await db.exec(`set nef.ahora = '2026-11-30 10:00-05'`);
  await como('authenticated', ADMIN);
  const [{ r: a }] = await q(`select stats_admin($1, 30) r`, [gym.id]);
  assert.equal(a.gimnasio.activos, 160); assert.equal(a.gimnasio.en_riesgo_total, 40);
  assert.ok(a.gimnasio.en_riesgo[0].telefono); assert.equal(a.gimnasio.puede_escribir, true);
  await db.exec('reset role;');
  const [g] = await q(`select token_stats from negocios where id = $1`, [gym.id]);
  await como('anon');
  const [{ r: t }] = await q(`select stats_token($1, 30) r`, [g.token_stats]);
  assert.equal(t.stats.gimnasio.en_riesgo_total, 40); assert.equal(t.stats.gimnasio.en_riesgo, null);
  assert.ok(!JSON.stringify(t).includes('telefono')); assert.ok(!JSON.stringify(t).includes('300100'));
  await db.exec(`set nef.ahora = '2026-11-29 10:00-05'`);  // domingo
  await como('authenticated', ADMIN);
  const [{ r: d }] = await q(`select stats_admin($1, 30) r`, [gym.id]);
  assert.equal(d.gimnasio.puede_escribir, false); assert.ok(d.gimnasio.proxima);
  await db.exec(`reset nef.ahora`);
});
await caso('máquinas y clases: ficha pública y solo las clases de hoy', async () => {
  await db.exec('reset role;');
  const [maq] = await q(`insert into productos (negocio_id, tipo, nombre, video_url, pasos) values ($1, 'maquina', 'Prensa', 'https://www.youtube.com/watch?v=abc123', '["Ajusta el asiento","Empuja sin bloquear","Baja despacio"]') returning id`, [gym.id]);
  await q(`insert into productos (negocio_id, tipo, nombre, horario) values
    ($1, 'clase', 'Spinning', '[{"dia":1,"hora":"18:00","duracion":45,"cupo":20},{"dia":3,"hora":"07:00","duracion":45,"cupo":20}]'),
    ($1, 'clase', 'Yoga', '[{"dia":2,"hora":"09:00","duracion":60,"cupo":15}]')`, [gym.id]);
  await db.exec(`set nef.ahora = '2026-11-23 08:00-05'`); // lunes
  await como('anon');
  const [{ r: f }] = await q(`select producto_publico('gym-forja', $1) r`, [maq.id]);
  assert.equal(f.nombre, 'Prensa'); assert.equal(f.pasos.length, 3);
  const [{ r: c }] = await q(`select clases_hoy('gym-forja') r`);
  assert.deepEqual(c.map((x) => x.nombre), ['Spinning']); assert.equal(c[0].hora, '18:00');
  assert.equal((await q(`select producto_publico('cafe-luna', $1) r`, [maq.id]))[0].r, null);
  await db.exec(`reset nef.ahora`);
});
await caso('entrada por NFC: una por día, sin monedas; sin entrada_nfc no registra', async () => {
  await como('anon');
  const [{ r: reg }] = await q(`select club_registrar('gym-forja','Camilo','3157778899', true) r`);
  assert.equal((await q(`select registrar_entrada_nfc('gym-forja', $1) r`, [reg.token]))[0].r.error, 'sin_entrada');
  await db.exec('reset role;');
  await db.exec(`update negocios set servicios = servicios || '{"entrada_nfc":true}' where slug = 'gym-forja'`);
  const movAntes = (await q(`select count(*)::int n from movimientos`))[0].n;
  await como('anon');
  await db.exec(`set nef.ahora = '2026-11-23 06:30-05'`);
  const [{ r: a }] = await q(`select registrar_entrada_nfc('gym-forja', $1) r`, [reg.token]);
  assert.equal(a.ok, true); assert.equal(a.repetida, false); assert.equal(a.racha, 1); assert.equal(a.semanas.length, 8);
  await db.exec(`set nef.ahora = '2026-11-23 18:00-05'`);
  const [{ r: b }] = await q(`select registrar_entrada_nfc('gym-forja', $1) r`, [reg.token]);
  assert.equal(b.repetida, true);
  await db.exec('reset role;');
  assert.equal((await q(`select count(*)::int n from entradas where origen = 'nfc'`))[0].n, 1);
  assert.equal((await q(`select count(*)::int n from movimientos`))[0].n, movAntes);
  await db.exec(`reset nef.ahora`);
});

console.log('Fase 4 · estadísticas y estudio');
await db.exec('reset role;');
const [ge] = await q(`insert into negocios (slug, nombre, sector) values ('gym-estudio','Gym Estudio','gimnasio') returning id, token_stats`);
await como('authenticated', ADMIN);
for (let i = 0; i < filasGym.length; i += 5000)
  await q(`select importar_entradas($1, $2::jsonb) r`, [ge.id, JSON.stringify(filasGym.slice(i, i + 5000))]);
await db.exec('reset role;');
// Hechos con fecha fija: 3 escaneos de una máquina el 30 nov, 1 toque el 29, 1 clic de reseña, una venta y un canje
const [maqE] = await q(`insert into productos (negocio_id, tipo, nombre) values ($1, 'maquina', 'Remo') returning id`, [ge.id]);
const [tagE] = await q(`insert into tags (negocio_id, nombre, destino, producto_id) values ($1, 'Remo', 'producto', $2) returning id`, [ge.id, maqE.id]);
await q(`insert into toques (tag_id, negocio_id, medio, creado) values
  ($1,$2,'nfc','2026-11-30 10:00-05'), ($1,$2,'qr','2026-11-30 11:00-05'), ($1,$2,'nfc','2026-11-30 19:00-05'), ($1,$2,'nfc','2026-11-29 23:30-05')`, [tagE.id, ge.id]);
await q(`insert into clicks (negocio_id, boton, creado) values ($1, 'resena', '2026-11-30 12:00-05')`, [ge.id]);
const [cliE] = await q(`insert into clientes (telefono, nombre) values ('573209998877', 'Estudio Prueba') returning id`);
const [memE] = await q(`insert into membresias (cliente_id, negocio_id, acepto_datos_at, creado) values ($1, $2, now(), '2026-11-30 09:00-05') returning id`, [cliE.id, ge.id]);
await q(`insert into movimientos (membresia_id, negocio_id, tipo, monedas, valor_compra, creado) values
  ($1, $2, 'visita', 100, 200000, '2026-11-30 09:00-05'), ($1, $2, 'canje', -100, null, '2026-11-30 09:05-05')`, [memE.id, ge.id]);

await caso('frecuencia, retorno a 30 días y recencia al 30 nov = lo esperado del CSV', async () => {
  assert.deepEqual((await q(`select metrica_frecuencia($1, '2026-11-30') r`, [ge.id]))[0].r, { clientes: 160, promedio: 11.5, mediana: 13 });
  assert.equal(Number((await q(`select metrica_retorno_30($1, '2026-11-30') r`, [ge.id]))[0].r), 0.875);
  assert.deepEqual((await q(`select metrica_recencia($1, '2026-11-30') r`, [ge.id]))[0].r, { clientes: 200, promedio: 12.6, mediana: 0 });
  assert.equal((await q(`select metrica_visitas($1, '2026-11-30') r`, [ge.id]))[0].r, 140);
});
await caso('visitas al portal, inscritos, uso de máquinas y devolución real', async () => {
  assert.equal((await q(`select metrica_visitas_portal($1, '2026-11-30') r`, [ge.id]))[0].r, 3);
  assert.equal((await q(`select metrica_visitas_portal($1, '2026-11-29') r`, [ge.id]))[0].r, 1);
  assert.equal((await q(`select metrica_clics_resena($1, '2026-11-30') r`, [ge.id]))[0].r, 1);
  assert.deepEqual((await q(`select metrica_inscritos($1, '2026-11-30') r`, [ge.id]))[0].r, { total: 1, nuevos: 1 });
  assert.deepEqual((await q(`select metrica_inscritos($1, '2026-11-29') r`, [ge.id]))[0].r, { total: 0, nuevos: 0 });
  assert.deepEqual((await q(`select metrica_uso_maquinas($1, '2026-11-30') r`, [ge.id]))[0].r, { [maqE.id]: 3 });
  assert.deepEqual((await q(`select metrica_devolucion_real($1, '2026-11-30') r`, [ge.id]))[0].r, { premios: 10000, ventas: 200000, tasa: 0.05 });
});
await caso('recalcular dos veces da los mismos valores; el panel lee lo guardado + hoy en vivo', async () => {
  await db.exec(`set nef.ahora = '2026-12-01 09:00-05'`);
  const foto = async () => JSON.stringify(await q(`select fecha, metrica, valor, detalle from metricas_diarias where negocio_id = $1 order by fecha, metrica`, [ge.id]));
  assert.equal((await q(`select recalcular_metricas($1, '2026-11-28') r`, [ge.id]))[0].r, 3);
  const a = await foto();
  await q(`select recalcular_metricas($1, '2026-11-28')`, [ge.id]);
  assert.equal(await foto(), a);
  const fila = async (f, m) => (await q(`select valor, detalle from metricas_diarias where negocio_id = $1 and fecha = $2 and metrica = $3`, [ge.id, f, m]))[0];
  assert.equal(Number((await fila('2026-11-30', 'activos')).valor), 160);
  assert.equal(Number((await fila('2026-11-30', 'en_riesgo')).valor), 40);
  assert.equal(Number((await fila('2026-11-30', 'visitas_portal')).valor), 3);
  const n1 = (await q(`select _nivel1($1, 3) r`, [ge.id]))[0].r;
  assert.equal(n1.desde, '2026-11-29'); assert.equal(n1.visitas_portal, 4); assert.equal(n1.clics_resena, 1);
  assert.equal(n1.conversion_resena, 0.25); assert.equal(n1.inscritos_nuevos, 1);
  assert.deepEqual(n1.devolucion_real, { premios: 10000, ventas: 200000, tasa: 0.05 });
  assert.deepEqual(n1.uso_maquinas, [{ nombre: 'Remo', n: 4 }]); // 3 del 30 nov + 1 del 29 (mismo tag)
  assert.equal(n1.horas_pico[1][6], 140); assert.equal(n1.serie_visitas_portal.length, 3);
  // Si se borra lo guardado, el panel calcula en vivo y da lo mismo
  await q(`delete from metricas_diarias where negocio_id = $1`, [ge.id]);
  const n2 = (await q(`select _nivel1($1, 3) r`, [ge.id]))[0].r;
  assert.deepEqual(n2, n1);
  assert.ok((await q(`select recalcular_todo('2026-11-30') r`))[0].r >= 1);
  await db.exec(`reset nef.ahora`);
});
await caso('anónimo no lee metricas_diarias ni llama recalcular, exportar o las métricas', async () => {
  await como('anon');
  assert.equal((await q(`select count(*)::int n from metricas_diarias`))[0].n, 0);
  await assert.rejects(q(`select recalcular_metricas($1, '2026-11-01')`, [ge.id]), /permission denied/);
  await assert.rejects(q(`select exportar_estudio($1, '2026-09-01', '2026-11-30')`, [ge.id]), /permission denied/);
  await assert.rejects(q(`select metrica_frecuencia($1, '2026-11-30')`, [ge.id]), /permission denied/);
  await como('authenticated', '22222222-2222-2222-2222-222222222222');
  await assert.rejects(q(`select admin_recalcular($1, '2026-11-01')`, [ge.id]), /no autorizado/);
  await assert.rejects(q(`select exportar_estudio($1, '2026-09-01', '2026-11-30')`, [ge.id]), /no autorizado/);
});
await caso('exportar para el estudio: sin nombres ni teléfonos, ids anonimizados distintos en cada exportación', async () => {
  await como('authenticated', ADMIN);
  const [{ r }] = await q(`select exportar_estudio($1, '2026-09-01', '2026-11-30') r`, [ge.id]);
  assert.equal(r.visitas.length, 5780); assert.equal(r.entradas.length, 5780); assert.equal(r.clientes.length, 1); assert.equal(r.canjes.length, 1);
  const txt = JSON.stringify(r);
  for (const prohibido of ['telefono', 'nombre', '573209998877', '3001000', 'Estudio Prueba', 'Laura', 'Gómez']) assert.ok(!txt.includes(prohibido), 'contiene ' + prohibido);
  assert.match(r.visitas[0].cliente, /^[0-9a-f]{32}$/);
  const [{ r: r2 }] = await q(`select exportar_estudio($1, '2026-09-01', '2026-11-30') r`, [ge.id]);
  assert.notEqual(r.visitas[0].cliente, r2.visitas[0].cliente, 'la sal cambia en cada exportación');
});
await caso('informes: el token de otro negocio no obtiene la ruta', async () => {
  await db.exec('reset role;');
  const [inf] = await q(`insert into informes (negocio_id, periodo, ruta) values ($1, '2026 · 4.º trimestre', $2) returning id`, [ge.id, ge.id + '/' + uid() + '.pdf']);
  await como('anon');
  assert.match((await q(`select informe_ruta($1, $2) r`, [ge.token_stats, inf.id]))[0].r, /\.pdf$/);
  assert.equal((await q(`select informe_ruta($1, $2) r`, [neg.token_stats, inf.id]))[0].r, null);
  assert.equal((await q(`select informe_ruta('inventado', $1) r`, [inf.id]))[0].r, null);
  const [{ r: t }] = await q(`select stats_token($1, 7) r`, [ge.token_stats]);
  assert.equal(t.informes.length, 1); assert.ok(!('ruta' in t.informes[0]));
  assert.equal((await q(`select count(*)::int n from informes`))[0].n, 0);
});

console.log('Fase 5 · carta y "Elige por mí"');
await db.exec('reset role;');
const [catDes] = await q(`insert into categorias (negocio_id, nombre, orden) values ($1, 'Desayunos', 1) returning id`, [neg.id]);
const [catBeb] = await q(`insert into categorias (negocio_id, nombre, orden) values ($1, 'Bebidas', 2) returning id`, [neg.id]);
await q(`insert into categorias (negocio_id, nombre, orden, activo) values ($1, 'Oculta', 3, false)`, [neg.id]);
await q(`insert into productos (negocio_id, categoria_id, nombre, precio, destacado, agotado, activo, etiquetas) values
  ($1, $2, 'Calentado', 18500, false, false, true, '{salado}'),
  ($1, $2, 'Huevos rancheros', 17500, true, false, true, '{salado,picante}'),
  ($1, $2, 'Croissant', 9500, false, true, true, '{dulce}'),
  ($1, $2, 'Plato viejo', 1000, false, false, false, '{}'),
  ($1, $3, 'Capuchino', 7000, false, false, true, '{bebida}')`, [neg.id, catDes.id, catBeb.id]);

await caso('carta_publica: sin inactivos, destacados primero, agotados al final', async () => {
  await como('anon');
  const [{ r }] = await q(`select carta_publica('cafe-luna') r`);
  assert.deepEqual(r.categorias.map((c) => c.nombre), ['Desayunos', 'Bebidas']);
  assert.deepEqual(r.categorias[0].productos.map((p) => p.nombre), ['Huevos rancheros', 'Calentado', 'Croissant']);
  assert.ok(!JSON.stringify(r).includes('Plato viejo'));
  assert.equal(r.otros, null);
  assert.equal((await q(`select carta_publica('no-existe') r`))[0].r, null);
  assert.equal((await q(`select negocio_publico('cafe-luna') r`))[0].r.tiene_carta, true);
  assert.equal((await q(`select negocio_publico('sin-club') r`))[0].r.tiene_carta, false);
});
await caso('eventos de la carta: tipo inválido no inserta; producto de otro negocio se ignora', async () => {
  await como('anon');
  await q(`select registrar_evento_carta('cafe-luna', 'ver_carta', null, 'abc')`);
  await q(`select registrar_evento_carta('cafe-luna', 'hackear', null, null)`);
  const [otroProd] = await (async () => { await db.exec('reset role;'); return q(`select id from productos where negocio_id <> $1 limit 1`, [neg.id]); })();
  await como('anon');
  await q(`select registrar_evento_carta('cafe-luna', 'ver_producto', $1, null)`, [otroProd.id]);
  assert.equal((await q(`select count(*)::int n from eventos_carta`))[0].n, 0, 'anon no lee eventos');
  await db.exec('reset role;');
  const ev = await q(`select tipo, producto_id from eventos_carta order by id`);
  assert.deepEqual(ev.map((e) => e.tipo), ['ver_carta', 'ver_producto']);
  assert.equal(ev[1].producto_id, null);
});
await caso('etiquetas solo de la lista permitida', async () => {
  await db.exec('reset role;');
  await assert.rejects(q(`insert into productos (negocio_id, nombre, etiquetas) values ($1, 'Raro', '{inventada}')`, [neg.id]), /productos_etiquetas_check/);
});
await caso('Elige por mí: nunca agotados; destacado ≈ el doble en 10.000 tiradas (±5 %)', async () => {
  const { elegir, candidatos, generador } = await import('../public/assets/elegir.js');
  const prods = [
    { id: 'a', destacado: true, etiquetas: ['dulce'] }, { id: 'b', etiquetas: ['dulce'] }, { id: 'c', etiquetas: ['dulce'] },
    { id: 'x', agotado: true, destacado: true, etiquetas: ['dulce'] }, { id: 'd', etiquetas: ['salado'] },
  ];
  const azar = generador(42);
  const n = {};
  for (let i = 0; i < 10000; i++) { const p = elegir(prods, 'dulce', azar); n[p.id] = (n[p.id] || 0) + 1; }
  assert.ok(!n.x, 'eligió un agotado'); assert.ok(!n.d, 'eligió algo que no es dulce');
  const razon = n.a / ((n.b + n.c) / 2);
  assert.ok(Math.abs(razon - 2) <= 0.1, 'razón destacado/normal = ' + razon.toFixed(3));
  assert.equal(elegir(prods, 'bebida', azar), null);
  assert.equal(candidatos(prods, 'sorpresa').length, 4);
  const a1 = generador(7), a2 = generador(7);
  assert.equal(elegir(prods, 'sorpresa', a1).id, elegir(prods, 'sorpresa', a2).id, 'misma semilla, mismo resultado');
});

console.log('Fase 6 · club que engancha');
await db.exec('reset role;');
const [cr] = await q(`insert into negocios (slug, nombre, servicios, bienvenida, monedas_por_visita, bono_racha)
  values ('cafe-racha','Café Racha','{"base":true,"club":true}', 0, 10, 30) returning id`);
await q(`insert into horas_doradas (negocio_id, dia_semana, hora_inicio, hora_fin, multiplicador) values ($1, 2, '15:00', '17:00', 2)`, [cr.id]);
await como('authenticated', ADMIN);
await q(`select fijar_pin_caja($1, '1357')`, [cr.id]);

await caso('racha: misma semana, semana siguiente, salto con comodín, salto sin comodín, salto doble', async () => {
  await db.exec('reset role;');
  const av = async (r, u, c, s) => (await q(`select _avanzar_racha($1, $2::date, $3::date, $4::date) r`, [r, u, c, s]))[0].r;
  assert.equal((await av(3, '2026-11-30', null, '2026-11-30')).racha, 3);
  assert.equal((await av(3, '2026-11-23', null, '2026-11-30')).racha, 4);
  const conComodin = await av(3, '2026-11-16', null, '2026-11-30');
  assert.equal(conComodin.racha, 4); assert.equal(conComodin.uso_comodin, true); assert.equal(conComodin.comodin_mes, '2026-11-01');
  assert.equal((await av(3, '2026-11-16', '2026-11-01', '2026-11-30')).racha, 1, 'el comodín ya se usó este mes');
  assert.equal((await av(3, '2026-11-16', '2026-10-01', '2026-11-30')).racha, 4, 'el comodín de octubre no cuenta en noviembre');
  assert.equal((await av(3, '2026-11-09', null, '2026-11-30')).racha, 1, 'saltó dos semanas');
  assert.equal((await av(0, null, null, '2026-11-30')).racha, 1);
});
await caso('hora dorada: dentro de la franja = base × 2 (extra aparte); fuera = base', async () => {
  await como('anon');
  const [{ r: reg }] = await q(`select club_registrar('cafe-racha','Sofía','3112223344', true) r`);
  await db.exec(`set nef.ahora = '2026-12-01 16:00-05'`); // martes 4 p. m.
  const ses = (await q(`select caja_entrar('cafe-racha','1357') r`))[0].r.sesion;
  const [{ r: a }] = await q(`select caja_visita($1, $2, $3) r`, [ses, reg.token, uid()]);
  assert.equal(a.monedas, 10); assert.equal(a.hora_dorada, 10); assert.equal(a.saldo, 20); assert.equal(a.racha, 1);
  await db.exec(`set nef.ahora = '2026-12-01 19:30-05'`); // mismo martes, 7:30 p. m.: fuera de la franja
  const [{ r: b }] = await q(`select caja_visita($1, $2, $3) r`, [ses, reg.token, uid()]);
  assert.equal(b.hora_dorada, 0); assert.equal(b.saldo, 30); assert.equal(b.racha, 1, 'misma semana no sube la racha');
  await db.exec('reset role;');
  assert.equal((await q(`select count(*)::int n from movimientos where tipo = 'bono_hora_dorada' and negocio_id = $1`, [cr.id]))[0].n, 1);
  await db.exec(`reset nef.ahora`);
});
await caso('bono de racha al llegar a 4 semanas seguidas; la tarjeta muestra racha y nivel', async () => {
  await como('anon');
  const [{ r: reg }] = await q(`select club_registrar('cafe-racha','Mateo','3125556677', true) r`);
  let ultimo;
  for (const dia of ['2026-11-11', '2026-11-18', '2026-11-25', '2026-12-02']) { // miércoles seguidos, 10 a. m.
    await db.exec(`set nef.ahora = '${dia} 10:00-05'`);
    const ses = (await q(`select caja_entrar('cafe-racha','1357') r`))[0].r.sesion;
    ultimo = (await q(`select caja_visita($1, $2, $3) r`, [ses, reg.token, uid()]))[0].r;
  }
  assert.equal(ultimo.racha, 4); assert.equal(ultimo.bono_racha, 30); assert.equal(ultimo.saldo, 4 * 10 + 30);
  assert.equal(ultimo.nivel.nombre, 'Visitante'); assert.equal(ultimo.nivel.siguiente.nombre, 'Habitual'); assert.equal(ultimo.nivel.siguiente.faltan, 130);
  await db.exec(`set nef.ahora = '2026-12-09 09:00-05'`); // la semana siguiente, aún sin venir: racha en riesgo
  const [{ r: t }] = await q(`select club_tarjeta('cafe-racha', $1) r`, [reg.token]);
  assert.deepEqual(t.racha, { semanas: 4, esta_semana: false, en_riesgo: true });
  assert.equal(t.nivel.nombre, 'Visitante');
  assert.equal(t.aviso.tipo, 'racha');
  await db.exec(`reset nef.ahora`);
});
await caso('niveles por total ganado (canjear no baja el nivel)', async () => {
  await db.exec('reset role;');
  const nv = async (t) => (await q(`select _nivel($1, $2) r`, [cr.id, t]))[0].r;
  assert.equal((await nv(0)).nombre, 'Visitante');
  assert.equal((await nv(200)).nombre, 'Habitual');
  assert.equal((await nv(599)).siguiente.faltan, 1);
  const top = await nv(5000);
  assert.equal(top.nombre, 'Leyenda'); assert.equal(top.siguiente, null);
});
await caso('aviso único: prioridad bienvenida → hora dorada → premio → racha → te faltan', async () => {
  await db.exec('reset role;');
  const av = async (b, d, p, r, c) => (await q(`select _aviso_tarjeta($1, $2::json, $3, $4, $5::json) r`, [b, d, p, r, c]))[0].r;
  const dorada = JSON.stringify({ multiplicador: 2, desde: '15:00', hasta: '17:00' });
  const cerca = JSON.stringify({ nombre: 'Capuchino', costo: 80, faltan: 30 });
  assert.equal((await av(50, dorada, 'Galleta', 3, cerca)).tipo, 'bienvenida');
  assert.equal((await av(0, dorada, 'Galleta', 3, cerca)).tipo, 'hora_dorada');
  assert.equal((await av(0, null, 'Galleta', 3, cerca)).tipo, 'premio');
  assert.equal((await av(0, null, null, 3, cerca)).tipo, 'racha');
  assert.deepEqual(await av(0, null, null, null, cerca), { tipo: 'faltan', n: 30, nombre: 'Capuchino' });
  assert.equal(await av(0, null, null, null, null), null);
});

console.log('Fase 7 · vender y cobrar');
await caso('demo.sql corre dos veces y crea demo-cafe (12 platos, 3 premios) y demo-gym (6 máquinas, 4 clases)', async () => {
  await db.exec('reset role;');
  const demo = fs.readFileSync(new URL('../supabase/demo.sql', import.meta.url), 'utf8');
  await db.exec(demo);
  await db.exec(demo);
  await db.exec(sql); // el esquema se vuelve a correr con datos ya cargados (como en producción): no debe chocar
  await como('anon');
  const [{ r: c }] = await q(`select carta_publica('demo-cafe') r`);
  assert.equal(c.categorias.flatMap((x) => x.productos).length, 12);
  assert.equal((await q(`select club_publico('demo-cafe') r`))[0].r.premios.length, 3);
  assert.equal((await q(`select maquinas_publicas('demo-gym') r`))[0].r.length, 6);
  const [{ r: t }] = await q(`select resolver_toque('demoprensa','nfc',null) r`);
  assert.equal(t.destino, 'producto'); assert.ok(t.producto_id);
  assert.ok((await q(`select caja_entrar('demo-cafe','1234') r`))[0].r.sesion, 'la caja demo abre con 1234');
  await db.exec('reset role;');
  assert.equal((await q(`select count(*)::int n from productos where negocio_id = 'd0000000-0000-4000-8000-0000000000a2' and tipo = 'clase'`))[0].n, 4);
});

console.log('Diseño · pieles y "Lo más pedido"');
await caso('"Lo más pedido": destacados si no hay datos; luego lo más visto; nunca agotados', async () => {
  await como('anon');
  const antes = (await q(`select carta_populares('cafe-luna') r`))[0].r;
  assert.deepEqual(antes.map((p) => p.nombre), ['Huevos rancheros'], 'sin vistas: solo los destacados');
  const [{ id: calentado }] = await (async () => { await db.exec('reset role;'); return q(`select id from productos where nombre = 'Calentado' and negocio_id = $1`, [neg.id]); })();
  const [{ id: croissant }] = await q(`select id from productos where nombre = 'Croissant' and negocio_id = $1`, [neg.id]);
  await como('anon');
  for (let i = 0; i < 3; i++) await q(`select registrar_evento_carta('cafe-luna', 'ver_producto', $1, null)`, [calentado]);
  for (let i = 0; i < 5; i++) await q(`select registrar_evento_carta('cafe-luna', 'ver_producto', $1, null)`, [croissant]);
  const despues = (await q(`select carta_populares('cafe-luna') r`))[0].r.map((p) => p.nombre);
  assert.equal(despues[0], 'Calentado', 'lo más visto primero');
  assert.ok(!despues.includes('Croissant'), 'un agotado nunca sale en "Lo más pedido"');
});
await caso('el negocio puede elegir su piel; null = la de su sector', async () => {
  await como('anon');
  assert.equal((await q(`select negocio_publico('cafe-luna') r`))[0].r.tema, null);
  await db.exec('reset role;');
  await db.exec(`update negocios set tema = 'noche' where slug = 'cafe-luna'`);
  await assert.rejects(q(`update negocios set tema = 'inventado' where slug = 'cafe-luna'`), /tema_check/);
  await como('anon');
  assert.equal((await q(`select negocio_publico('cafe-luna') r`))[0].r.tema, 'noche');
  await db.exec('reset role;');
  await db.exec(`update negocios set tema = null where slug = 'cafe-luna'`);
});

console.log('Fase 7 · mensualidades');
const empLuna = async () => { await db.exec('reset role;'); return (await q(`select empresa_id id from negocios where slug = 'cafe-luna'`))[0].id; };
await caso('vencido + gracia apaga el toque y el portal; registrar el pago los prende otra vez', async () => {
  const emp = await empLuna();
  await db.exec(`update empresas set vence = '2026-12-10', dias_gracia = 5 where id = '${emp}'`);
  await como('anon');
  await db.exec(`set nef.ahora = '2026-12-15 20:00-05'`); // último día de gracia: sigue prendido
  assert.equal((await q(`select resolver_toque($1,'nfc',null) r`, [tags[0].codigo]))[0].r.estado, 'ok');
  assert.ok((await q(`select negocio_publico('cafe-luna') r`))[0].r, 'en gracia el portal se ve');
  await db.exec(`set nef.ahora = '2026-12-16 08:00-05'`); // se acabó la gracia
  assert.equal((await q(`select resolver_toque($1,'nfc',null) r`, [tags[0].codigo]))[0].r.estado, 'inactivo');
  assert.equal((await q(`select negocio_publico('cafe-luna') r`))[0].r, null, 'vencido: el portal no se muestra');
  await como('authenticated', ADMIN);
  const m = (await q(`select mensualidades_admin() r`))[0].r.find((e) => e.id === emp);
  assert.deepEqual(m.estado, { estado: 'vencido', dias: 6 });
  assert.equal((await q(`select registrar_pago($1, 1)::text v`, [emp]))[0].v, '2027-01-16', 'vencido: el mes se cuenta desde hoy');
  await como('anon');
  assert.equal((await q(`select resolver_toque($1,'nfc',null) r`, [tags[0].codigo]))[0].r.estado, 'ok');
  await db.exec('reset role; reset nef.ahora;');
  await db.exec(`update empresas set vence = null where id = '${emp}'`);
});
await caso('estados: al día, por vencer (≤ 5 días), gracia; pagar antes de vencer suma al vencimiento', async () => {
  const emp = await empLuna();
  await db.exec(`update empresas set vence = '2026-12-10', dias_gracia = 3 where id = '${emp}'`);
  await como('authenticated', ADMIN);
  const estado = async (dia) => { await db.exec(`set nef.ahora = '${dia} 12:00-05'`);
    return (await q(`select mensualidades_admin() r`))[0].r.find((e) => e.id === emp).estado; };
  assert.deepEqual(await estado('2026-12-01'), { estado: 'al_dia', dias: 9 });
  assert.deepEqual(await estado('2026-12-07'), { estado: 'por_vencer', dias: 3 });
  assert.deepEqual(await estado('2026-12-12'), { estado: 'gracia', dias: 1 });
  await db.exec(`set nef.ahora = '2026-12-05 12:00-05'`);
  assert.equal((await q(`select registrar_pago($1, 2)::text v`, [emp]))[0].v, '2027-02-10', 'al día: suma sobre el vencimiento');
  await db.exec('reset role; reset nef.ahora;');
  await db.exec(`update empresas set vence = null, dias_gracia = 5 where id = '${emp}'`);
});
await caso('un negocio nuevo recibe su propia empresa (para cobrarle)', async () => {
  await db.exec('reset role;');
  const [n] = await q("insert into negocios (slug, nombre) values ('pan-sol', 'Pan del Sol') returning empresa_id");
  assert.ok(n.empresa_id);
  assert.equal((await q('select nombre from empresas where id = $1', [n.empresa_id]))[0].nombre, 'Pan del Sol');
  await db.exec("delete from negocios where slug = 'pan-sol'");
});
await caso('solo el admin ve y registra mensualidades', async () => {
  const emp = await empLuna();
  await como('anon');
  await assert.rejects(q(`select registrar_pago($1, 1)`, [emp]), /permission denied/);
  await assert.rejects(q(`select mensualidades_admin()`), /permission denied/);
  await como('authenticated', '22222222-2222-2222-2222-222222222222');
  await assert.rejects(q(`select registrar_pago($1, 1)`, [emp]), /no autorizado/);
  await assert.rejects(q(`select _negocio_habilitado(gen_random_uuid())`), /permission denied/);
  await db.exec('reset role;');
});

console.log('QR de compra');
{
  await db.exec('reset role;');
  await db.exec(`set nef.ahora = '2026-03-02 10:00-05'`);
  const [nq] = await q(`insert into negocios (slug, nombre, modo_monedas, devolucion_pct, bienvenida, servicios) values ('qr-cafe', 'QR Café', 'valor', 8, 50, '{"base":true,"club":true,"catalogo":true}') returning id`);
  const [otro] = await q(`insert into negocios (slug, nombre) values ('qr-otro', 'Otro') returning id`);
  await como('authenticated', ADMIN);
  await q(`select fijar_pin_caja($1, '2468')`, [nq.id]);
  await db.exec('reset role;');
  const [pa] = await q(`insert into productos (negocio_id, nombre, precio) values ($1, 'Tinto', 3000) returning id`, [nq.id]);
  const [pb] = await q(`insert into productos (negocio_id, nombre, precio) values ($1, 'Croissant', 7000) returning id`, [nq.id]);
  const [pz] = await q(`insert into productos (negocio_id, nombre, precio) values ($1, 'Ajeno', 999000) returning id`, [otro.id]);
  await como('anon');
  const ses = (await q(`select caja_entrar('qr-cafe', '2468') r`))[0].r.sesion;
  const tokA = (await q(`select club_registrar('qr-cafe', 'Ana', '3005550001', true) r`))[0].r.token;
  const tokB = (await q(`select club_registrar('qr-cafe', 'Beto', '3005550002', true) r`))[0].r.token;
  const crear = async (items) => (await q(`select caja_crear_compra($1, $2::jsonb) r`, [ses, JSON.stringify(items)]))[0].r;

  await caso('QR de compra: el valor sale de la carta (no del celular) e ignora productos de otro negocio', async () => {
    const c = await crear([{ producto_id: pa.id, cantidad: 2, precio: 1 }, { producto_id: pb.id }, { producto_id: pz.id, cantidad: 5 }]);
    assert.equal(c.valor, 13000, '2 tintos + 1 croissant; el ajeno no cuenta y el precio enviado se ignora');
    assert.equal(c.monedas, 10, '8 % de $13.000 = $1.040 = 10 monedas');
    assert.match(c.codigo, /^[0-9a-f]{32}$/);
    assert.equal((await crear([{ producto_id: pz.id }])).error, 'items', 'solo productos ajenos: no crea nada');
    assert.equal((await q(`select caja_crear_compra('sesion-falsa', '[]'::jsonb) r`))[0].r.error, 'sesion');
  });
  await caso('QR de compra: el cliente lo reclama una vez (bienvenida incluida); otro cliente no puede; repetir es idempotente', async () => {
    const c = await crear([{ producto_id: pb.id, cantidad: 2 }]);
    const r1 = (await q(`select club_reclamar_compra('qr-cafe', $1, $2) r`, [tokA, c.codigo]))[0].r;
    assert.equal(r1.ok, true, JSON.stringify(r1));
    assert.equal(r1.monedas, 11, '8 % de $14.000');
    assert.equal(r1.bienvenida, 50);
    assert.equal(r1.saldo, 61);
    const r2 = (await q(`select club_reclamar_compra('qr-cafe', $1, $2) r`, [tokA, c.codigo]))[0].r;
    assert.equal(r2.saldo, 61, 'reclamar otra vez no suma dos veces');
    assert.equal((await q(`select club_reclamar_compra('qr-cafe', $1, $2) r`, [tokB, c.codigo]))[0].r.error, 'usado');
    assert.equal((await q(`select caja_estado_compra($1, $2) r`, [ses, c.codigo]))[0].r.usado, true, 'la caja ve que ya se usó');
  });
  await caso('QR de compra: vence a los 10 minutos; respeta las horas entre visitas; código o negocio equivocados no sirven', async () => {
    const c = await crear([{ producto_id: pa.id }]);
    await db.exec(`set nef.ahora = '2026-03-02 10:11-05'`);
    assert.equal((await q(`select club_reclamar_compra('qr-cafe', $1, $2) r`, [tokB, c.codigo]))[0].r.error, 'vencido');
    const c2 = await crear([{ producto_id: pa.id }]);
    assert.equal((await q(`select club_reclamar_compra('qr-cafe', $1, $2) r`, [tokA, c2.codigo]))[0].r.error, 'muy_pronto', 'Ana ya sumó hace 11 minutos');
    assert.equal((await q(`select club_reclamar_compra('qr-otro', $1, $2) r`, [tokB, c2.codigo]))[0].r.error, 'no_existe');
    assert.equal((await q(`select club_reclamar_compra('qr-cafe', $1, 'nada') r`, [tokB]))[0].r.error, 'no_existe');
    assert.equal((await q(`select club_reclamar_compra('qr-cafe', $1, $2) r`, [tokB, c2.codigo]))[0].r.ok, true, 'Beto sí puede');
  });
  await caso('QR de compra: la tabla no se lee desde afuera y la función interna no se puede llamar', async () => {
    assert.equal((await q(`select count(*)::int n from compras_qr`))[0].n, 0);
    await assert.rejects(q(`select _sumar_visita($1, $2, gen_random_uuid(), 1000)`, [nq.id, tokA]), /permission denied/);
  });
  await db.exec('reset role;');
  await db.exec(`reset nef.ahora; delete from negocios where slug in ('qr-cafe', 'qr-otro')`);
}

console.log('Modo rápido (hora pico)');
{
  await db.exec('reset role;');
  await db.exec(`set nef.ahora = '2026-03-03 12:00-05'`);
  const [nr] = await q(`insert into negocios (slug, nombre, bienvenida, horas_entre_visitas, rapido_activo, rapido_monedas, rapido_desde, rapido_hasta, servicios)
    values ('rap-cafe', 'Rápido Café', 0, 6, true, 15, '11:00', '15:00', '{"base":true,"club":true}') returning id`);
  const [otro] = await q(`insert into negocios (slug, nombre, rapido_activo) values ('rap-otro', 'Otro', true) returning id`);
  await como('authenticated', ADMIN);
  await q(`select fijar_pin_caja($1, '1357')`, [nr.id]);
  await q(`select fijar_pin_caja($1, '1357')`, [otro.id]);
  await como('anon');
  const ses = (await q(`select caja_entrar('rap-cafe', '1357') r`))[0].r.sesion;
  const sesOtro = (await q(`select caja_entrar('rap-otro', '1357') r`))[0].r.sesion;
  const tokA = (await q(`select club_registrar('rap-cafe', 'Ana', '3005551001', true) r`))[0].r.token;
  const tokB = (await q(`select club_registrar('rap-cafe', 'Beto', '3005551002', true) r`))[0].r.token;
  const codigo = async (sesion) => (await q(`select caja_rapido_codigo($1) r`, [sesion]))[0].r;
  const reclamar = async (tok, cod) => (await q(`select club_rapido('rap-cafe', $1, $2) r`, [tok, cod]))[0].r;

  await caso('modo rápido: la caja muestra un código; el cliente lo escanea y gana las monedas fijas', async () => {
    const c = await codigo(ses);
    assert.match(c.codigo, /^[0-9a-f]{32}$/);
    assert.equal(c.monedas, 15);
    const r = await reclamar(tokA, c.codigo);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.monedas, 15);
    assert.equal((await reclamar(tokA, c.codigo)).saldo, 15, 'el mismo código otra vez no suma doble');
    assert.equal((await q(`select caja_rapido_codigo('falsa') r`))[0].r.error, 'sesion');
  });
  await caso('modo rápido: una vez cada "horas entre visitas"; el código cambia cada 30 s (uno viejo no sirve); otro negocio no sirve', async () => {
    await db.exec(`set nef.ahora = '2026-03-03 12:00:40-05'`);
    const c2 = await codigo(ses);
    assert.equal((await reclamar(tokA, c2.codigo)).error, 'muy_pronto', 'Ana ya sumó hace menos de 6 horas');
    const viejo = c2.codigo;
    await db.exec(`set nef.ahora = '2026-03-03 12:01:50-05'`);
    assert.equal((await reclamar(tokB, viejo)).error, 'vencido', 'una foto del QR de hace un minuto no sirve');
    assert.equal((await reclamar(tokB, (await codigo(sesOtro)).codigo)).error, 'vencido', 'el código de otro negocio no sirve');
    assert.equal((await reclamar(tokB, (await codigo(ses)).codigo)).ok, true, 'Beto sí');
    await db.exec(`set nef.ahora = '2026-03-03 18:30-05'`);
    assert.equal((await codigo(ses)).error, 'fuera_de_horario', 'fuera de la franja la caja no muestra QR');
  });
  await caso('modo rápido: apagado no da nada; la función interna no se llama desde afuera', async () => {
    await db.exec('reset role;');
    await q(`update negocios set rapido_activo = false where id = $1`, [nr.id]);
    await db.exec(`set nef.ahora = '2026-03-03 13:00-05'`);
    await como('anon');
    assert.equal((await codigo(ses)).error, 'inactivo');
    assert.equal((await reclamar(tokB, 'x')).error, 'inactivo');
    await assert.rejects(q(`select _rapido_codigo('s', 1)`), /permission denied/);
  });
  await db.exec('reset role;');
  await db.exec(`reset nef.ahora; delete from negocios where slug in ('rap-cafe', 'rap-otro')`);
}

console.log('Gimnasio: entrenar con tutorial y meta del mes');
{
  await db.exec('reset role;');
  await db.exec(`set nef.ahora = '2026-04-06 07:00-05'`);
  const [g] = await q(`insert into negocios (slug, nombre, sector, bienvenida, horas_entre_visitas, rapido_activo, rapido_monedas,
    maquina_monedas, maquina_minutos, maquina_horas, meta_mes_llegadas, meta_mes_bono, servicios)
    values ('gym-t', 'Gym T', 'gimnasio', 0, 12, true, 10, 5, 15, 8, 2, 100, '{"base":true,"club":true,"catalogo":true}') returning id`);
  const [maq] = await q(`insert into productos (negocio_id, tipo, nombre) values ($1, 'maquina', 'Prensa') returning id`, [g.id]);
  const [maq2] = await q(`insert into productos (negocio_id, tipo, nombre) values ($1, 'maquina', 'Remo') returning id`, [g.id]);
  await como('authenticated', ADMIN);
  await q(`select fijar_pin_caja($1, '2580')`, [g.id]);
  await como('anon');
  const tok = (await q(`select club_registrar('gym-t', 'Sofi', '3005552001', true) r`))[0].r.token;
  // La recepción entra a la caja (la sesión dura 12 h) y muestra el QR; el socio lo escanea
  const llegar = async () => {
    const sx = (await q(`select caja_entrar('gym-t', '2580') r`))[0].r.sesion;
    return (await q(`select club_rapido('gym-t', $1, $2) r`, [tok, (await q(`select caja_rapido_codigo($1) r`, [sx]))[0].r.codigo]))[0].r;
  };
  const empezar = async (p) => (await q(`select club_maquina_empezar('gym-t', $1, $2) r`, [tok, p]))[0].r;
  const terminar = async (sesion) => (await q(`select club_maquina_terminar('gym-t', $1, $2) r`, [tok, sesion]))[0].r;

  await caso('gimnasio: sin registrar la llegada del día no se puede ganar en una máquina (una foto del sticker no sirve desde la casa)', async () => {
    assert.equal((await empezar(maq.id)).error, 'sin_llegada');
    assert.equal((await llegar()).monedas, 10, 'llegar con el QR de recepción da 10');
  });
  await caso('gimnasio: 15 minutos y "Terminé" → +5; antes de tiempo no; repetir el mismo código no suma doble', async () => {
    const e = await empezar(maq.id);
    assert.ok(e.sesion, JSON.stringify(e));
    assert.equal(e.minutos, 15);
    await db.exec(`set nef.ahora = '2026-04-06 07:10-05'`);
    assert.equal((await terminar(e.sesion)).error, 'falta', 'a los 10 minutos todavía no');
    await db.exec(`set nef.ahora = '2026-04-06 07:16-05'`);
    const t = await terminar(e.sesion);
    assert.equal(t.ok, true); assert.equal(t.monedas, 5); assert.equal(t.saldo, 15);
    assert.equal((await terminar(e.sesion)).saldo, 15, 'tocar "Terminé" otra vez no suma doble');
  });
  await caso('gimnasio: otra máquina antes de 8 horas no da; después sí (si llegó ese día); la sesión vence a las 3 horas', async () => {
    await db.exec(`set nef.ahora = '2026-04-06 09:00-05'`);
    assert.equal((await empezar(maq2.id)).error, 'muy_pronto', 'no se farmea escaneando otra máquina');
    await db.exec(`set nef.ahora = '2026-04-06 15:30-05'`);
    const e = await empezar(maq2.id);
    assert.ok(e.sesion, 'pasadas 8 horas y con llegada hoy, sí');
    await db.exec(`set nef.ahora = '2026-04-06 19:00-05'`);
    assert.equal((await terminar(e.sesion)).error, 'vencida', 'no se deja abierta para cobrarla después');
    await db.exec(`set nef.ahora = '2026-04-07 08:00-05'`);
    assert.equal((await empezar(maq.id)).error, 'sin_llegada', 'al otro día hay que registrar la llegada otra vez');
    assert.equal((await empezar('00000000-0000-4000-8000-000000000000')).error, 'maquina');
  });
  await caso('gimnasio: meta del mes (2 llegadas) da su bono una sola vez; la tarjeta muestra las llegadas del mes', async () => {
    const r = await llegar();   // 2.ª llegada del mes (la 1.ª fue el 6/4)
    assert.equal(r.bono_meta, 100, JSON.stringify(r));
    const t = (await q(`select club_tarjeta('gym-t', $1) r`, [tok]))[0].r;
    assert.equal(t.llegadas_mes, 2); assert.equal(t.meta_mes.llegadas, 2); assert.equal(t.meta_mes.bono, 100);
    await db.exec(`set nef.ahora = '2026-04-08 08:00-05'`);
    assert.equal((await llegar()).bono_meta, 0, 'la 3.ª llegada no repite el bono');
    assert.equal((await q(`select count(*)::int n from sesiones_maquina`))[0].n, 0, 'anon no lee las sesiones');
  });
  await db.exec('reset role;');
  await db.exec(`reset nef.ahora; delete from negocios where slug = 'gym-t'`);
}

console.log('Legal · responsable del tratamiento');
await caso('datos legales del negocio: públicos en negocio_publico, solo el admin los escribe', async () => {
  await db.exec('reset role;');
  await db.exec(`insert into negocios (slug, nombre, legal_nombre, legal_documento, legal_direccion, legal_correo)
    values ('legal-x', 'Café X', 'Café X S.A.S.', 'NIT 901.000.000-1', 'Cra. 7 # 1-2, Bogotá', 'datos@cafex.co')`);
  await como('anon');
  const n = (await q(`select negocio_publico('legal-x') r`))[0].r;
  assert.deepEqual(n.legal, { nombre: 'Café X S.A.S.', documento: 'NIT 901.000.000-1', direccion: 'Cra. 7 # 1-2, Bogotá', correo: 'datos@cafex.co' });
  assert.equal((await q(`update negocios set legal_nombre = 'x' where slug = 'legal-x' returning id`)).length, 0);
  await db.exec('reset role;');
  await assert.rejects(q(`update negocios set legal_correo = 'no es correo' where slug = 'legal-x'`), /check/);
  await db.exec(`delete from negocios where slug = 'legal-x'`);
});
console.log('Fase 8 · panel del dueño (aislamiento por empresa)');
const DUENO_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const DUENO_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
await db.exec('reset role;');
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values
  ('${DUENO_A}', 'ana@cafe-a.co', now()), ('${DUENO_B}', 'beto@gym-b.co', now())`);
const [na] = await q(`insert into negocios (slug, nombre, notas, sector) values ('cafe-a', 'Café A', 'nota privada A', 'cafe') returning id, empresa_id, token_stats`);
const [nb] = await q(`insert into negocios (slug, nombre, notas, sector) values ('gym-b', 'Gym B', 'nota privada B', 'gimnasio') returning id, empresa_id, token_stats`);
await q(`insert into tags (negocio_id, nombre) values ($1, 'Mesa A'), ($2, 'Recepción B')`, [na.id, nb.id]);
await q(`insert into productos (negocio_id, nombre, precio) values ($1, 'Tinto A', 3000), ($2, 'Batido B', 9000)`, [na.id, nb.id]);
await q(`insert into premios (negocio_id, nombre, valor_pesos) values ($1, 'Café gratis', 4000), ($2, 'Clase gratis', 20000)`, [na.id, nb.id]);
await q(`insert into informes (negocio_id, periodo, ruta) values ($1, '2026 · T4', $3), ($2, '2026 · T4', $4)`, [na.id, nb.id, na.id + '/a.pdf', nb.id + '/b.pdf']);
const [cl] = await q(`insert into clientes (telefono, nombre) values ('573009998877', 'Cliente B') returning id`);
await q(`insert into membresias (cliente_id, negocio_id, acepto_datos_at) values ($1, $2, now())`, [cl.id, nb.id]);
await como('authenticated', ADMIN);
await assert.rejects(q(`select dar_acceso('nadie@x.co', $1, 'dueno')`, [na.empresa_id]), /todavía no tiene cuenta/);
assert.equal((await q(`select dar_acceso(' ANA@cafe-a.co ', $1, 'dueno') r`, [na.empresa_id]))[0].r.user_id, DUENO_A);
await q(`select dar_acceso('beto@gym-b.co', $1, 'gerente')`, [nb.empresa_id]);
assert.equal((await q(`select accesos_admin() r`))[0].r.filter((a) => [DUENO_A, DUENO_B].includes(a.user_id)).length, 2);

const cuenta = async (tabla, negocio) => (await q(`select count(*)::int n from ${tabla} where negocio_id = $1`, [negocio]))[0].n;
await caso('el admin abre /panel y ve todos los negocios como su dueño (rol admin)', async () => {
  await como('authenticated', ADMIN);
  const todos = (await q(`select panel_negocios() r`))[0].r;
  assert.ok(todos.some((n) => n.slug === 'cafe-a') && todos.some((n) => n.id === nb.id), 've A y B');
  assert.ok(todos.every((n) => n.rol === 'admin' || n.rol === 'dueno' || n.rol === 'gerente'));
  assert.equal((await q(`select es_mi_negocio($1) r`, [nb.id]))[0].r, true);
  await db.exec('reset role;');
});
await caso('negocios: el dueño A solo ve SU sede, por RPC y sin nada privado; la tabla directa no se abre', async () => {
  await como('authenticated', DUENO_A);
  const mios = (await q(`select panel_negocios() r`))[0].r;
  assert.deepEqual(mios.map((n) => n.slug), ['cafe-a']);
  for (const k of ['notas', 'token_stats', 'pin_caja_hash', 'contacto_telefono']) assert.ok(!(k in mios[0]), k);
  assert.equal((await q(`select count(*)::int n from negocios`))[0].n, 0);
  assert.equal((await q(`update negocios set nombre = 'hackeado' where id = $1 returning id`, [nb.id])).length, 0);
  await db.exec('reset role;');
  assert.equal((await q(`select nombre from negocios where id = $1`, [nb.id]))[0].nombre, 'Gym B');
});
await caso('tags: A ve los suyos y ninguno de B; no los modifica', async () => {
  await como('authenticated', DUENO_A);
  assert.equal(await cuenta('tags', na.id), 1);
  assert.equal(await cuenta('tags', nb.id), 0);
  assert.equal((await q(`update tags set nombre = 'x' where negocio_id = $1 returning id`, [nb.id])).length, 0);
  assert.equal((await q(`update tags set nombre = 'x' where negocio_id = $1 returning id`, [na.id])).length, 0, 'tags: solo lectura');
});
await caso('productos: A edita su carta; no lee, no crea ni mueve nada a la de B', async () => {
  await como('authenticated', DUENO_A);
  assert.equal(await cuenta('productos', nb.id), 0);
  assert.equal((await q(`update productos set agotado = true where negocio_id = $1 returning id`, [na.id])).length, 1);
  assert.equal((await q(`update productos set precio = 1 where negocio_id = $1 returning id`, [nb.id])).length, 0);
  assert.equal((await q(`delete from productos where negocio_id = $1 returning id`, [nb.id])).length, 0);
  await assert.rejects(q(`insert into productos (negocio_id, nombre) values ($1, 'intruso')`, [nb.id]), /row-level security/);
  await assert.rejects(q(`update productos set negocio_id = $1 where negocio_id = $2`, [nb.id, na.id]), /row-level security/);
  await q(`insert into productos (negocio_id, nombre, precio) values ($1, 'Pandebono A', 2500)`, [na.id]);
  await q(`insert into categorias (negocio_id, nombre) values ($1, 'Panadería')`, [na.id]);
  await assert.rejects(q(`insert into categorias (negocio_id, nombre) values ($1, 'x')`, [nb.id]), /row-level security/);
});
await caso('premios: A crea y cambia los suyos; los de B ni los ve', async () => {
  await como('authenticated', DUENO_A);
  assert.equal(await cuenta('premios', nb.id), 0);
  assert.equal((await q(`update premios set valor_pesos = 1 where negocio_id = $1 returning id`, [nb.id])).length, 0);
  await q(`insert into premios (negocio_id, nombre, valor_pesos) values ($1, 'Croissant', 6000)`, [na.id]);
  assert.equal(await cuenta('premios', na.id), 2);
  await assert.rejects(q(`insert into premios (negocio_id, nombre, valor_pesos) values ($1, 'x', 100)`, [nb.id]), /row-level security/);
});
await caso('membresias y clientes: el dueño no los lee directo (ni los suyos ni los de B)', async () => {
  await como('authenticated', DUENO_B);
  assert.equal(await cuenta('membresias', nb.id), 0);
  assert.equal((await q(`select count(*)::int n from clientes`))[0].n, 0);
  await como('authenticated', DUENO_A);
  assert.equal(await cuenta('membresias', nb.id), 0);
});
await caso('informes: A ve solo los suyos (con la ruta para firmar el PDF)', async () => {
  await como('authenticated', DUENO_A);
  const r = await q(`select negocio_id, ruta from informes`);
  assert.deepEqual(r.map((x) => x.negocio_id), [na.id]);
  assert.equal(await cuenta('informes', nb.id), 0);
  await assert.rejects(q(`insert into informes (negocio_id, periodo, ruta) values ($1, 'x', 'y')`, [na.id]), /row-level security/);
});
await caso('empresas y accesos: cada uno ve solo lo suyo', async () => {
  await como('authenticated', DUENO_A);
  assert.deepEqual((await q(`select id from empresas`)).map((e) => e.id), [na.empresa_id]);
  assert.deepEqual((await q(`select user_id from accesos`)).map((a) => a.user_id), [DUENO_A]);
  assert.equal((await q(`update empresas set vence = '2099-01-01' where id = $1 returning id`, [na.empresa_id])).length, 0, 'no se paga solo');
});
await caso('RPC del dueño: stats, PIN e importar solo sobre lo suyo; nada de admin', async () => {
  await como('authenticated', DUENO_B);
  const s = (await q(`select stats_dueno($1, 30) r`, [nb.id]))[0].r;
  assert.equal(s.negocio, 'Gym B');
  assert.ok(Array.isArray(s.stats.gimnasio.en_riesgo), 'el dueño con sesión ve la lista en riesgo');
  await assert.rejects(q(`select stats_dueno($1, 30)`, [na.id]), /no autorizado/);
  await q(`select fijar_pin_caja($1, '4321')`, [nb.id]);
  await assert.rejects(q(`select fijar_pin_caja($1, '4321')`, [na.id]), /no autorizado/);
  const imp = (await q(`select importar_entradas($1, '[{"codigo":"77","fecha_hora":"2026-11-20 07:00"}]'::jsonb) r`, [nb.id]))[0].r;
  assert.equal(imp.nuevas, 1);
  await assert.rejects(q(`select importar_entradas($1, '[]'::jsonb)`, [na.id]), /no autorizado/);
  await assert.rejects(q(`select admin_recalcular($1, '2026-11-01')`, [na.id]), /no autorizado/);
  for (const f of [`stats_admin('${nb.id}', 30)`, `dar_acceso('beto@gym-b.co', '${na.empresa_id}', 'dueno')`, `accesos_admin()`, `exportar_estudio('${nb.id}', '2026-01-01', '2026-12-31')`, `mensualidades_admin()`])
    await assert.rejects(q(`select ${f}`), /no autorizado/, f);
  assert.ok((await q(`select panel_negocios() r`))[0].r[0].tiene_pin);
});
await caso('fotos: el dueño solo puede escribir en la carpeta de su negocio', async () => {
  await como('authenticated', DUENO_A);
  assert.equal((await q(`select foto_es_mia($1) v`, [na.id + '/x.webp']))[0].v, true);
  assert.equal((await q(`select foto_es_mia($1) v`, [nb.id + '/x.webp']))[0].v, false);
  assert.equal((await q(`select foto_es_mia('../x.webp') v`))[0].v, false);
  await como('anon');
  await assert.rejects(q(`select foto_es_mia('x')`), /permission denied/);
  await assert.rejects(q(`select panel_negocios()`), /permission denied/);
  await assert.rejects(q(`select es_mi_negocio($1)`, [na.id]), /permission denied/);
});
await caso('admin por correo: solo cuando la cuenta se confirma', async () => {
  await db.exec('reset role;');
  await db.exec(`insert into admins_correos values ('jefe@nef.co')`);
  const J = 'cccccccc-0000-4000-8000-00000000000c';
  await db.exec(`insert into auth.users (id, email) values ('${J}', 'Jefe@nef.co')`);
  assert.equal((await q(`select count(*)::int n from admins where user_id = $1`, [J]))[0].n, 0, 'sin confirmar no es admin');
  await db.exec(`update auth.users set email_confirmed_at = now() where id = '${J}'`);
  await como('authenticated', J);
  assert.equal((await q(`select es_admin() v`))[0].v, true);
  await como('authenticated', DUENO_A);
  assert.equal((await q(`select count(*)::int n from admins_correos`))[0].n, 0, 'la lista no se ve');
  await assert.rejects(q(`insert into admins_correos values ('ana@cafe-a.co')`), /row-level security/);
});
await caso('interruptor: los links viejos /stats?k= siguen hasta que Jacobo los apague', async () => {
  await como('anon');
  assert.ok((await q(`select stats_token($1, 7) r`, [nb.token_stats]))[0].r);
  assert.equal((await q(`select stats_token($1, 7) r`, [nb.token_stats]))[0].r.stats.gimnasio.en_riesgo, null, 'el link no trae teléfonos');
  await db.exec('reset role;');
  await db.exec(`update interruptores set encendido = false where nombre = 'links_stats_viejos'`);
  await como('anon');
  assert.equal((await q(`select stats_token($1, 7) r`, [nb.token_stats]))[0].r, null);
  assert.equal((await q(`select informe_ruta($1, gen_random_uuid()) r`, [nb.token_stats]))[0].r, null);
  await db.exec('reset role;');
  await db.exec(`update interruptores set encendido = true where nombre = 'links_stats_viejos'`);
  await db.exec(`delete from negocios where slug in ('cafe-a', 'gym-b'); delete from clientes where id = '${cl.id}'`);
});

console.log(`\n${ok} pruebas OK`);
