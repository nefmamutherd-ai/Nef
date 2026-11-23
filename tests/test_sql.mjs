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
  create table auth.users (id uuid primary key);
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
  await db.exec(sql); // otra vez: no crea empresas repetidas
  assert.equal((await q(`select count(*)::int n from empresas`))[0].n, 1);
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
      and p.prosrc ~* 'insert\\s+into\\s+(public\\.)?movimientos'`);
  assert.deepEqual(filas.map((f) => f.proname).sort(), ['caja_canje', 'caja_visita']);
  const antes = (await q(`select count(*)::int n from movimientos`))[0].n;
  await como('anon');
  await q(`select registrar_click('cafe-luna','resena',null)`);
  await db.exec('reset role;');
  assert.equal((await q(`select count(*)::int n from movimientos`))[0].n, antes);
});

console.log(`\n${ok} pruebas OK`);
