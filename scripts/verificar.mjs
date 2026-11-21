// Verificador de Nef: guardas automáticas para que ningún modelo (Claude u otro) dañe el proyecto.
// Uso:  npm run verificar           (reglas + pruebas SQL)
//       npm run verificar -- --e2e  (además el recorrido en navegador; requiere `npm run mock` y `npm run dev` corriendo)
// Sale con código 1 si algo falla. NO se edita este archivo para que pase: se arregla el código.
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const existe = (p) => fs.existsSync(path.join(RAIZ, p));
const fallos = [], avisos = [];
const mal = (regla, detalle, arreglo) => fallos.push({ regla, detalle, arreglo });
const ojo = (regla, detalle) => avisos.push({ regla, detalle });
const ok = (t) => console.log('  ✓', t);

function archivos(dir, exts) {
  const out = [];
  if (!existe(dir)) return out;
  for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', '.git', 'capturas'].includes(e.name)) out.push(...archivos(p, exts)); }
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

console.log('\nNef · verificador\n');

// 1. Archivos que no pueden desaparecer
const obligatorios = ['CLAUDE.md', 'AGENTS.md', 'docs/PRODUCTO.md', 'docs/PLAN.md', 'docs/ARQUITECTURA.md', 'docs/UI.md',
  'docs/PROGRESO.md', 'docs/DECISIONES.md', 'docs/BUGS.md', 'supabase/esquema.sql', 'lib/util.js',
  'public/index.html', 'public/assets/tokens.css', 'public/assets/portal.css', 'public/assets/nef-ui.css',
  'tests/test_sql.mjs', 'tests/e2e.mjs', 'tests/mock_supabase.mjs', 'scripts/verificar.mjs'];
const faltan = obligatorios.filter((f) => !existe(f));
faltan.length ? mal('archivos obligatorios', 'Faltan: ' + faltan.join(', '), 'Restáuralos con `git checkout -- <archivo>`. Nunca se borran.') : ok('archivos obligatorios presentes');

// 2. Dependencias: solo las aprobadas
const pkg = JSON.parse(leer('package.json'));
const aprobadas = ['@electric-sql/pglite', 'playwright', 'wrangler', 'qrcode-generator'];
const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
const nuevas = deps.filter((d) => !aprobadas.includes(d));
nuevas.length ? mal('dependencias', 'No aprobadas: ' + nuevas.join(', '),
  'Quítalas de package.json. El stack es HTML/CSS/JS vanilla. Si de verdad hace falta, anótalo en docs/DECISIONES.md como PROPUESTA para Jacobo y sigue sin ella.') : ok('sin dependencias nuevas');

// 3. Secretos
const codigo = [...archivos('public', ['.html', '.js', '.css']), ...archivos('functions', ['.js']), ...archivos('lib', ['.js', '.json'])];
const patronesSecretos = [[/service_role/i, 'service_role'], [/eyJhbGciOi[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/, 'un JWT'], [/sk_(live|test)_\w+/, 'una llave de pagos'], [/SUPABASE_SERVICE/i, 'SUPABASE_SERVICE']];
let secretos = 0;
for (const f of codigo) {
  const t = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  for (const [re, nombre] of patronesSecretos) if (re.test(t)) { secretos++; mal('secretos', `${rel(path.join(RAIZ, f))} contiene ${nombre}`, 'Bórralo. Las llaves solo viven en .dev.vars (local) y en Cloudflare. Nunca en el código.'); }
}
if (existe('.gitignore')) {
  const gi = leer('.gitignore');
  for (const x of ['.dev.vars', '.env', 'node_modules']) if (!gi.split(/\r?\n/).some((l) => l.trim().replace(/^\//, '').replace(/\/$/, '') === x)) mal('.gitignore', `No ignora ${x}`, `Agrega la línea "${x}" a .gitignore.`);
} else mal('.gitignore', 'No existe', 'Crea .gitignore con: node_modules, .dev.vars, .env, tests/capturas/, .wrangler/');
if (!secretos) ok('sin secretos en el código');

// 4. Recursos externos: solo supabase-js por CDN
let externos = 0;
for (const f of codigo.filter((x) => /\.(html|js)$/.test(x))) {
  const t = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  for (const m of t.matchAll(/<script[^>]+src=["'](https?:)?\/\/([^"']+)["']/gi)) {
    if (!/^cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/.test(m[2])) { externos++; mal('scripts externos', `${f}: ${m[2]}`, 'Copia la librería a public/assets/ o no la uses. Por CDN solo @supabase/supabase-js.'); }
  }
  if (/fonts\.googleapis|fonts\.gstatic|use\.typekit/.test(t)) { externos++; mal('fuentes externas', f, 'Usa /assets/fuentes/ (Bricolage) o las del sistema.'); }
  if (/\b(from|import)\s+['"](react|vue|svelte|preact|jquery|tailwind)/.test(t)) { externos++; mal('frameworks', f, 'Nada de frameworks: HTML + CSS + JS vanilla.'); }
}
if (!externos) ok('sin scripts, fuentes ni frameworks externos');

// 5. Esquema SQL idempotente, con RLS y search_path
const sql = leer('supabase/esquema.sql');
const sinComentarios = sql.replace(/--[^\n]*/g, '');
let sqlMal = 0;
for (const m of sinComentarios.matchAll(/create\s+table\s+(?!if\s+not\s+exists)([\w.]+)/gi)) { sqlMal++; mal('SQL idempotente', `create table ${m[1]} sin "if not exists"`, 'Usa: create table if not exists ...'); }
for (const m of sinComentarios.matchAll(/create\s+(?!or\s+replace)function\s+([\w.]+)/gi)) { sqlMal++; mal('SQL idempotente', `create function ${m[1]} sin "or replace"`, 'Usa: create or replace function ...'); }
for (const m of sinComentarios.matchAll(/create\s+(unique\s+)?index\s+(?!if\s+not\s+exists)(\w+)/gi)) { sqlMal++; mal('SQL idempotente', `índice ${m[2]} sin "if not exists"`, 'Usa: create index if not exists ...'); }
for (const m of sinComentarios.matchAll(/create\s+policy\s+("?[^"\s]+"?)\s+on\s+([\w.]+)/gi)) {
  const nombre = m[1].replace(/"/g, '');
  if (!new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+"?${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"?\\s+on`, 'i').test(sinComentarios)) { sqlMal++; mal('SQL idempotente', `política ${nombre} sin "drop policy if exists" antes`, 'Antes de cada create policy: drop policy if exists "<nombre>" on <tabla>;'); }
}
const tablas = [...sinComentarios.matchAll(/create\s+table\s+if\s+not\s+exists\s+([\w.]+)/gi)].map((m) => m[1].replace(/^public\./, ''));
for (const t of tablas) if (!new RegExp(`alter\\s+table\\s+(public\\.)?${t}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sinComentarios)) { sqlMal++; mal('RLS', `La tabla ${t} no tiene RLS`, `Agrega: alter table public.${t} enable row level security; (y sus políticas o RPC security definer)`); }
for (const m of sinComentarios.matchAll(/create\s+or\s+replace\s+function\s+([\w.]+)[\s\S]{0,600}?\bas\s+\$/gi)) {
  if (/security\s+definer/i.test(m[0]) && !/set\s+search_path/i.test(m[0])) { sqlMal++; mal('search_path', `${m[1]} es security definer sin "set search_path"`, 'Agrega: set search_path = public (y extensions si usa crypt).'); }
}
if (!sqlMal) ok(`esquema idempotente, ${tablas.length} tablas con RLS, RPC con search_path`);

// 6. Avisos (no fallan, pero revísalos)
for (const f of codigo.filter((x) => /\.(html|js)$/.test(x))) {
  const t = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  if (/\.innerHTML\s*=\s*`[^`]*\$\{(?![^}]*esc\()/.test(t)) ojo('innerHTML', `${f}: innerHTML con \${...} sin esc(). Usa textContent o esc().`);
  if (f.startsWith('public' + path.sep) && f.endsWith('.html') && !/viewport/.test(t)) ojo('celular', `${f}: falta <meta name="viewport">`);
}

// 7. Las pruebas no pueden disminuir (trinquete)
const contar = (f) => leer(f).replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).filter((l) => /^\s*await\s+caso\(/.test(l)).length;
const actual = { sql: contar('tests/test_sql.mjs'), e2e: contar('tests/e2e.mjs') };
const fMin = 'tests/minimo.json';
const minimo = existe(fMin) ? JSON.parse(leer(fMin)) : { sql: 0, e2e: 0 };
if (actual.sql < minimo.sql || actual.e2e < minimo.e2e)
  mal('pruebas', `Había ${minimo.sql} casos SQL y ${minimo.e2e} e2e; ahora hay ${actual.sql} y ${actual.e2e}.`, 'No se borran ni se desactivan pruebas. Restaura las que quitaste y arregla el código.');
else {
  if (actual.sql > minimo.sql || actual.e2e > minimo.e2e) fs.writeFileSync(path.join(RAIZ, fMin), JSON.stringify(actual, null, 2) + '\n');
  ok(`pruebas: ${actual.sql} casos SQL, ${actual.e2e} e2e (mínimo ${minimo.sql}/${minimo.e2e})`);
}

// 8. Rama de git
try {
  const rama = execSync('git rev-parse --abbrev-ref HEAD', { cwd: RAIZ, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  if (['main', 'master'].includes(rama)) mal('git', `Estás en la rama ${rama}`, 'git switch desarrollo  (o: git switch -c desarrollo). Nunca se trabaja en main.');
  else ok(`rama de git: ${rama}`);
} catch { ojo('git', 'No es un repositorio git todavía (git init && git switch -c desarrollo).'); }

// 9. Pruebas
const correr = (script) => {
  console.log(`\n  → npm run ${script}`);
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], { cwd: RAIZ, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) mal(script, 'Las pruebas fallan', 'Lee el error de arriba, arregla el CÓDIGO (no la prueba) y vuelve a correr. Si la prueba está mal de verdad, explica por qué en docs/DECISIONES.md.');
};
correr('test:sql');
if (process.argv.includes('--e2e')) correr('test:e2e');
else ojo('e2e', 'No corriste el navegador. Antes de cerrar una tarea con pantallas: npm run verificar -- --e2e');

// Resultado
console.log('');
for (const a of avisos) console.log(`  ⚠ ${a.regla}: ${a.detalle}`);
if (fallos.length) {
  console.log(`\n✗ ${fallos.length} problema(s). NO hagas commit hasta arreglarlos:\n`);
  for (const f of fallos) console.log(`  ✗ [${f.regla}] ${f.detalle}\n      → ${f.arreglo}`);
  console.log('');
  process.exit(1);
}
console.log('\n✓ Todo en orden. Puedes hacer commit.\n');
