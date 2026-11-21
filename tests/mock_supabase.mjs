// Supabase "de mentiras" para probar: Postgres real (pglite) + un subconjunto de PostgREST y Auth
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import http from 'node:http';
import fs from 'node:fs';

const ADMIN = '11111111-1111-1111-1111-111111111111';
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
  create role anon; create role authenticated;
  create schema extensions; create extension pgcrypto schema extensions;  -- como en Supabase
  grant usage on schema extensions to anon, authenticated;
  create schema auth; create table auth.users (id uuid primary key);
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);
await db.exec(fs.readFileSync(process.argv[2] || new URL('../supabase/esquema.sql', import.meta.url), 'utf8'));
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  insert into auth.users values ('${ADMIN}'); insert into public.admins values ('${ADMIN}');`);

const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('bad ident ' + s); return s; };
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
function send(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', ...cors });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
function where(params) {
  const conds = [], vals = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit'].includes(k)) continue;
    const m = /^(eq|in)\.(.*)$/.exec(v);
    if (!m) continue;
    if (m[1] === 'eq') { vals.push(m[2]); conds.push(`${ident(k)}::text = $${vals.length + 1}`); }
    else { vals.push(m[2].replace(/^\(|\)$/g, '').split(',')); conds.push(`${ident(k)}::text = any($${vals.length + 1})`); }
  }
  return { sql: conds.length ? ' where ' + conds.join(' and ') : '', vals };
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  let body = '';
  for await (const c of req) body += c;
  const url = new URL(req.url, 'http://x');
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const role = token === 'admintoken' ? 'authenticated' : 'anon';
  const uid = token === 'admintoken' ? ADMIN : '';
  try {
    if (url.pathname === '/auth/v1/token') {
      const b = JSON.parse(body);
      if (b.password !== 'clave123') return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials' });
      const user = { id: ADMIN, email: b.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
      return send(res, 200, { access_token: 'admintoken', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user });
    }
    if (url.pathname.startsWith('/auth/v1/logout')) return send(res, 204);
    if (url.pathname.startsWith('/auth/v1/user')) return send(res, 200, { id: ADMIN, aud: 'authenticated', role: 'authenticated' });

    const out = await db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}; select set_config('test.uid', '${uid}', true);`);
      const rpc = /^\/rest\/v1\/rpc\/(\w+)$/.exec(url.pathname);
      if (rpc) {
        const args = body ? JSON.parse(body) : {};
        const keys = Object.keys(args);
        const r = await tx.query(`select public.${ident(rpc[1])}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ')}) as r`, keys.map((k) => args[k]));
        return [200, r.rows[0].r];
      }
      const tbl = /^\/rest\/v1\/(\w+)$/.exec(url.pathname);
      if (!tbl) return [404, { message: 'no route' }];
      const t = ident(tbl[1]);
      const w = where(url.searchParams);
      if (req.method === 'GET') {
        const order = (url.searchParams.get('order') || '').split(',').filter(Boolean).map((o) => { const [c, d] = o.split('.'); return `${ident(c)} ${d === 'desc' ? 'desc' : 'asc'}`; });
        const r = await tx.query(`select * from public.${t}${w.sql.replace(/\$(\d+)/g, (_, n) => '$' + (n - 1))}${order.length ? ' order by ' + order.join(', ') : ''}`, w.vals);
        return [200, r.rows];
      }
      const data = body ? JSON.parse(body) : null;
      if (req.method === 'POST') {
        const rows = Array.isArray(data) ? data : [data];
        const cols = Object.keys(rows[0]).map(ident);
        await tx.query(`insert into public.${t} (${cols.join(',')}) select ${cols.join(',')} from json_populate_recordset(null::public.${t}, $1)`, [JSON.stringify(rows)]);
        return [201, undefined];
      }
      if (req.method === 'PATCH') {
        const cols = Object.keys(data).map(ident);
        const set = cols.map((c) => `${c} = (select ${c} from json_populate_record(null::public.${t}, $1))`).join(', ');
        await tx.query(`update public.${t} set ${set}${w.sql}`, [JSON.stringify(data), ...w.vals]);
        return [204, undefined];
      }
      if (req.method === 'DELETE') {
        await tx.query(`delete from public.${t}${w.sql.replace(/\$(\d+)/g, (_, n) => '$' + (n - 1))}`, w.vals);
        return [204, undefined];
      }
      return [405, { message: 'method' }];
    });
    send(res, out[0], out[1]);
  } catch (e) {
    const code = e.code || 'XX000';
    send(res, code === '23505' ? 409 : 400, { code, message: e.message });
  }
}).listen(54321, () => console.log('mock supabase en :54321'));
