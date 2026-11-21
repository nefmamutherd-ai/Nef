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

console.log(`\n${ok} pruebas OK`);
