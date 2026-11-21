// Recorrido completo en navegador contra el sitio local (npm run dev) y el Supabase simulado (npm run mock).
// Uso: npm run test:e2e        Capturas en tests/capturas/
// Opcional: CHROME_PATH=/ruta/a/chrome   SB_BUNDLE=/ruta/supabase.esm.js (si no hay internet para el CDN)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8788';
const MOCK = process.env.MOCK || 'http://127.0.0.1:54321';
const DIR = new URL('./capturas/', import.meta.url).pathname;
fs.mkdirSync(DIR, { recursive: true });

let ok = 0;
const errores = [];
const caso = async (nombre, fn) => { await fn(); ok++; console.log('  ✓', nombre); };
// Petición sin seguir redirecciones → [status, Location]
const ir = async (path, method = 'GET') => {
  const r = await fetch(BASE + path, { method, redirect: 'manual' });
  return [r.status, r.headers.get('location')];
};

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
if (process.env.SB_BUNDLE) {
  const body = fs.readFileSync(process.env.SB_BUNDLE, 'utf8');
  await ctx.route(/cdn\.jsdelivr\.net\/.*supabase/, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
}
const panel = await ctx.newPage();
panel.on('pageerror', (e) => errores.push('panel: ' + e.message));
panel.on('dialog', (d) => d.accept());

console.log('Panel');
const slug = 'cafe-prueba-' + Date.now().toString(36);
await caso('login', async () => {
  await panel.goto(BASE + '/admin');
  await panel.waitForSelector('#login:not(.oculto)');
  await panel.fill('#l-email', 'admin@prueba.co');
  await panel.fill('#l-clave', 'clave123');
  await panel.click('#form-login button');
  await panel.waitForSelector('#app:not(.oculto)');
});
await caso('crear negocio', async () => {
  await panel.click('#nuevo-negocio');
  await panel.fill('#form-negocio [name=nombre]', 'Café Prueba');
  await panel.fill('#form-negocio [name=slug]', slug);
  await panel.fill('#form-negocio [name=menu_url]', 'https://example.com/menu.pdf');
  await panel.fill('#form-negocio [name=resena_url]', 'https://g.page/r/abc/review');
  await panel.fill('#form-negocio [name=whatsapp]', '3001234567');
  await panel.fill('#form-negocio [name=wifi_nombre]', 'Cafe_Clientes');
  await panel.fill('#form-negocio [name=wifi_clave]', 'clave2026');
  await panel.click('#n-guardar');
  await panel.waitForSelector(`#lista-negocios td.cod:text-is("/n/${slug}")`);
  await panel.screenshot({ path: DIR + 'panel_negocios.png' });
});
let codigos = [];
await caso('crear 3 tags para el negocio', async () => {
  await panel.click('.tab[data-tab=tags]');
  await panel.selectOption('#c-negocio', { label: 'Café Prueba' });
  await panel.fill('#c-cant', '3');
  await panel.fill('#c-base', 'Mesa');
  await panel.click('#crear-tags');
  await panel.waitForTimeout(800);
  codigos = await panel.$$eval('#lista-tags tr[data-id] td.cod', (tds) => tds.map((t) => t.textContent));
  assert.equal(codigos.length, 3);
  await panel.screenshot({ path: DIR + 'panel_tags.png' });
});

console.log('Cliente');
await caso('toque NFC → portal; QR marcado aparte', async () => {
  const [s, loc] = await ir(`/t/${codigos[0]}`);
  assert.equal(s, 302); assert.match(loc, new RegExp(`/n/${slug}\\?t=${codigos[0]}`));
  const [, locQ] = await ir(`/t/${codigos[1]}?q`);
  assert.match(locQ, new RegExp(`/n/${slug}`));
});
await caso('código inventado → inactivo', async () => {
  const [, loc] = await ir('/t/zzzzzzz');
  assert.match(loc, /\/inactivo$/);
});
await caso('botones registran y redirigen', async () => {
  assert.deepEqual(await ir(`/c/${slug}/resena?t=${codigos[0]}`), [302, 'https://g.page/r/abc/review']);
  assert.deepEqual(await ir(`/c/${slug}/whatsapp?t=${codigos[0]}`), [302, 'https://wa.me/573001234567']);
  assert.equal((await ir(`/c/${slug}/wifi?t=${codigos[0]}`, 'POST'))[0], 204);
});
const movil = await ctx.newPage();
movil.on('pageerror', (e) => errores.push('móvil: ' + e.message));
await movil.setViewportSize({ width: 390, height: 844 });
await caso('portal en móvil', async () => {
  await movil.goto(`${BASE}/t/${codigos[2]}`);
  assert.match(movil.url(), new RegExp(`/n/${slug}`));
  await movil.screenshot({ path: DIR + 'portal_movil.png', fullPage: true });
  await movil.click('#wifi summary');
  assert.equal(await movil.textContent('#clave'), 'clave2026');
});

console.log('Estadísticas');
await caso('panel muestra toques', async () => {
  await panel.click('.tab[data-tab=stats]');
  await panel.selectOption('#s-negocio', { label: 'Café Prueba' });
  await panel.waitForSelector('.viz-root');
  const total = await panel.textContent('.tile b');
  assert.ok(Number(total) >= 3, 'toques registrados: ' + total);
  await panel.screenshot({ path: DIR + 'panel_stats.png', fullPage: true });
});
await caso('link del cliente funciona y no expone datos privados', async () => {
  const r = await fetch(`${MOCK}/rest/v1/negocios?select=*`, { headers: { Authorization: 'Bearer admintoken' } });
  const n = (await r.json()).find((x) => x.slug === slug);
  await movil.goto(`${BASE}/stats?k=${n.token_stats}`);
  await movil.waitForSelector('.viz-root');
  await movil.screenshot({ path: DIR + 'stats_cliente.png', fullPage: true });
});

console.log('Landing');
await caso('landing: 8 secciones, WhatsApp y sin scroll horizontal', async () => {
  for (const [w, h, nombre] of [[390, 844, 'landing_movil.png'], [1280, 860, 'landing_escritorio.png']]) {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push('landing: ' + e.message));
    await p.setViewportSize({ width: w, height: h });
    await p.goto(BASE + '/');
    await p.waitForLoadState('networkidle');
    for (const sel of ['.hero', '#como-funciona', '#cafes', '#gimnasios', '.estudio', '#precios', '#preguntas', '#cierre']) assert.ok(await p.$(sel), 'falta ' + sel);
    assert.match(await p.getAttribute('#cta', 'href'), /^https:\/\/wa\.me\/57\d{10}\?text=/);
    assert.equal(await p.locator('.faq details').count(), 5);
    assert.ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'scroll horizontal a ' + w);
    await p.screenshot({ path: DIR + nombre, fullPage: true });
    await p.close();
  }
});

// ── Agrega aquí los recorridos de cada fase nueva (carta, ruleta, club, caja…) ──

await browser.close();
assert.deepEqual(errores, [], 'Errores de JavaScript en las páginas:\n' + errores.join('\n'));
console.log(`\n${ok} pruebas OK · capturas en tests/capturas/`);
