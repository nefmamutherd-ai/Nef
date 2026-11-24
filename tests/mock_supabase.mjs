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
  create schema auth; create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);
await db.exec(fs.readFileSync(process.argv[2] || new URL('../supabase/esquema.sql', import.meta.url), 'utf8'));
// Opcional (demo local): SQL extra separado por ';' en MOCK_SQL_EXTRA, ej. supabase/demo.sql
for (const extra of (process.env.MOCK_SQL_EXTRA || '').split(';').filter(Boolean)) await db.exec(fs.readFileSync(extra, 'utf8'));
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

const archivos = new Map(); // Storage en memoria: 'bucket/ruta' → { crudo, tipo }
// supabase-js sube los Blob como multipart/form-data: se guarda la parte del archivo con su propio tipo
function archivoSubido(crudo, tipoPeticion) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(tipoPeticion || '');
  if (!/^multipart\//i.test(tipoPeticion || '') || !m) return { crudo, tipo: tipoPeticion || 'application/octet-stream' };
  const limite = Buffer.from('--' + (m[1] || m[2]));
  let i = crudo.indexOf(limite);
  while (i >= 0) {
    const sig = crudo.indexOf(limite, i + limite.length);
    if (sig < 0) break;
    const parte = crudo.subarray(i + limite.length + 2, sig - 2);
    const fin = parte.indexOf('\r\n\r\n');
    const cabeceras = parte.subarray(0, fin).toString();
    if (/filename=/i.test(cabeceras) || /content-type:\s*(?!text\/plain)/i.test(cabeceras)) {
      const t = /content-type:\s*([^\r\n]+)/i.exec(cabeceras);
      return { crudo: parte.subarray(fin + 4), tipo: t ? t[1].trim() : 'application/octet-stream' };
    }
    i = sig;
  }
  return { crudo, tipo: 'application/octet-stream' };
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  let body = '';
  const trozos = [];
  for await (const c of req) trozos.push(c);
  const crudo = Buffer.concat(trozos);
  body = crudo.toString();
  const url = new URL(req.url, 'http://x');
  // Tokens: 'admintoken' = el admin de prueba; 'u:<uuid>' = un usuario registrado (dueños, Fase 8)
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const uid = token === 'admintoken' ? ADMIN : /^u:[0-9a-f-]{36}$/.test(token) ? token.slice(2) : '';
  const role = uid ? 'authenticated' : 'anon';
  const usuario = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
  const sesion = (tk, user) => ({ access_token: tk, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: tk, user });
  const malas = () => send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials' });
  try {
    if (url.pathname === '/auth/v1/token') {
      const b = JSON.parse(body);
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        const tk = b.refresh_token;
        const id = tk === 'admintoken' ? ADMIN : String(tk).slice(2);
        const u = (await db.query('select email from auth.users where id::text = $1', [id])).rows[0];
        return u ? send(res, 200, sesion(tk, usuario(id, u.email))) : malas();
      }
      if (b.password !== 'clave123') return malas();
      const email = String(b.email || '').trim().toLowerCase();
      if (email.startsWith('admin')) return send(res, 200, sesion('admintoken', usuario(ADMIN, email))); // como antes: admin*@… = admin
      const u = (await db.query('select id from auth.users where lower(email) = $1', [email])).rows[0];
      return u ? send(res, 200, sesion('u:' + u.id, usuario(u.id, email))) : malas();
    }
    if (url.pathname === '/auth/v1/signup') {
      const b = JSON.parse(body);
      const email = String(b.email || '').trim().toLowerCase();
      if (String(b.password || '').length < 6) return send(res, 422, { code: 'weak_password', msg: 'Password should be at least 6 characters.' });
      if ((await db.query('select 1 from auth.users where lower(email) = $1', [email])).rows.length) return send(res, 422, { code: 'user_already_exists', msg: 'User already registered' });
      // Se confirma al instante (en Supabase real llega un correo con el link de confirmación)
      const id = (await db.query('insert into auth.users (id, email, email_confirmed_at) values (gen_random_uuid(), $1, now()) returning id', [email])).rows[0].id;
      return send(res, 200, sesion('u:' + id, usuario(id, email)));
    }
    if (url.pathname.startsWith('/auth/v1/logout')) return send(res, 204);

    // Storage mínimo (bucket "informes"): subir (solo admin), firmar (solo rutas registradas) y descargar lo firmado
    const pub = /^\/storage\/v1\/object\/public\/([\w-]+)\/(.+)$/.exec(url.pathname);
    if (pub && req.method === 'GET') {
      const a = pub[1] === 'fotos' && archivos.get(pub[1] + '/' + decodeURIComponent(pub[2]));
      if (!a) return send(res, 404, { message: 'Object not found' });
      res.writeHead(200, { 'content-type': a.tipo, ...cors });
      return res.end(a.crudo);
    }
    const st = /^\/storage\/v1\/object\/(sign\/)?([\w-]+)\/(.+)$/.exec(url.pathname);
    if (st) {
      const [, firmar, bucket, ruta] = st;
      const path = decodeURIComponent(ruta);
      if (firmar && req.method === 'POST') {
        const r = await db.query(`select public.informe_existe($1) as ok`, [path]);
        if (bucket !== 'informes' || !r.rows[0].ok) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
        return send(res, 200, { signedURL: `/object/sign/${bucket}/${ruta}?token=firma-de-prueba` });
      }
      if (firmar && req.method === 'GET' && url.searchParams.get('token') === 'firma-de-prueba') {
        res.writeHead(200, { 'content-type': 'application/pdf', ...cors });
        return res.end('%PDF-1.4\n% informe de prueba\n%%EOF\n');
      }
      if (!firmar && (req.method === 'POST' || req.method === 'PUT')) {
        if (role !== 'authenticated') return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
        archivos.set(bucket + '/' + path, archivoSubido(crudo, req.headers['content-type']));
        return send(res, 200, { Key: `${bucket}/${path}`, Id: path });
      }
      return send(res, 404, { message: 'not found' });
    }
    if (url.pathname.startsWith('/auth/v1/user')) {
      if (!uid) return send(res, 401, { code: 'no_authorization', msg: 'invalid JWT' });
      const u = (await db.query('select email from auth.users where id::text = $1', [uid])).rows[0];
      return send(res, 200, usuario(uid, u ? u.email : 'admin@prueba.co'));
    }

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
}).listen(+(process.env.MOCK_PORT || 54321), () => console.log('mock supabase en :' + (process.env.MOCK_PORT || 54321)));
