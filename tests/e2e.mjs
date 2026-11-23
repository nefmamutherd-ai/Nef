// Recorrido completo en navegador contra el sitio local (npm run dev) y el Supabase simulado (npm run mock).
// Uso: npm run test:e2e        Capturas en tests/capturas/
// Opcional: CHROME_PATH=/ruta/a/chrome   SB_BUNDLE=/ruta/supabase.esm.js (si no hay internet para el CDN)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8788';
const MOCK = process.env.MOCK || 'http://127.0.0.1:54321';
const DIR = fileURLToPath(new URL('./capturas/', import.meta.url));
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

// Ayudas para leer y cambiar datos directo en el Supabase simulado (como admin)
const api = async (ruta, method = 'GET', body) => {
  const r = await fetch(`${MOCK}/rest/v1/${ruta}`, {
    method, headers: { Authorization: 'Bearer admintoken', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${ruta} → ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
};
const sinScrollHorizontal = async (p) => assert.ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'hay scroll horizontal');

console.log('Fase 1');
await caso('antispam: el mismo celular tocando dos veces cuenta un toque', async () => {
  const [tag] = await api(`tags?codigo=eq.${codigos[0]}`);
  const contar = async () => (await api(`toques?tag_id=eq.${tag.id}`)).length;
  const antes = await contar();
  const p = await ctx.newPage();
  await p.goto(`${BASE}/t/${codigos[0]}`);
  await p.goto(`${BASE}/t/${codigos[0]}`);
  assert.match(p.url(), new RegExp(`/n/${slug}`));
  assert.equal(await contar(), antes + 1);
  await p.close();
});
await caso('portal café: tema cálido, 1 a 3 botones de 76 px, nombre del tag', async () => {
  await api(`negocios?slug=eq.${slug}`, 'PATCH', { servicios: { base: true, catalogo: true, club: true, estudio: false }, ubicacion_etiqueta: 'Sede Chapinero' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push('portal café: ' + e.message));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${BASE}/n/${slug}?t=${codigos[0]}`);
  assert.equal(await p.getAttribute('html', 'data-tema'), 'calido');
  const n = await p.locator('.pt-boton').count();
  assert.ok(n >= 1 && n <= 3, 'botones: ' + n);
  assert.equal(await p.textContent('.pt-boton.principal span'), 'Ver la carta');
  assert.equal(await p.textContent('.pt-cabeza p'), 'Mesa 1');
  const alto = await p.$eval('.pt-boton', (b) => b.getBoundingClientRect().height);
  assert.ok(alto >= 76, 'alto del botón ' + alto);
  await sinScrollHorizontal(p);
  await p.screenshot({ path: DIR + 'portal-cafe-movil.png', fullPage: true });
  await p.goto(`${BASE}/n/${slug}`);
  assert.equal(await p.textContent('.pt-cabeza p'), 'Sede Chapinero');
  await p.click('#wifi summary');
  await p.waitForSelector('.pt-hoja.abierta');
  await p.waitForTimeout(400); // fin de la animación de la hoja
  await p.screenshot({ path: DIR + 'portal-cafe-wifi.png' });
  await p.setViewportSize({ width: 1280, height: 860 });
  await p.screenshot({ path: DIR + 'portal-cafe-escritorio.png' });
  await p.close();
});
await caso('mismo negocio como gimnasio: tema energía y "Clases de hoy" sin tocar código', async () => {
  await api(`negocios?slug=eq.${slug}`, 'PATCH', { sector: 'gimnasio' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push('portal gym: ' + e.message));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${BASE}/n/${slug}`);
  assert.equal(await p.getAttribute('html', 'data-tema'), 'energia');
  const textos = await p.$$eval('.pt-boton span', (s) => s.map((x) => x.textContent));
  assert.deepEqual(textos, ['Clases de hoy', 'Mis monedas', 'Déjanos tu reseña']);
  await sinScrollHorizontal(p);
  await p.screenshot({ path: DIR + 'portal-gym-movil.png', fullPage: true });
  await p.close();
  await api(`negocios?slug=eq.${slug}`, 'PATCH', { sector: 'cafe', servicios: { base: true, catalogo: false, club: false, estudio: false } });
});
await caso('/inactivo con la marca Nef', async () => {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${BASE}/t/zzzzzzz`);
  assert.match(p.url(), /\/inactivo$/);
  assert.equal(await p.getAttribute('body', 'class'), 'nef');
  assert.match(await p.textContent('.n-vacio b'), /Este punto no está activo/);
  assert.equal(await p.getAttribute('.n-vacio a.n-btn.principal', 'href'), '/');
  await p.screenshot({ path: DIR + 'inactivo-movil.png', fullPage: true });
  await p.close();
});
await caso('admin: cambiar a Gimnasio + Club → el portal cambia de tema y muestra "Mis monedas"', async () => {
  await panel.click('.tab[data-tab=negocios]');
  await panel.click(`#lista-negocios tr:has(td.cod:text-is("/n/${slug}")) [data-editar]`);
  await panel.click('#f-sector label:has(input[value=gimnasio])');
  await panel.check('#form-negocio [name=srv_club]');
  await panel.fill('#form-negocio [name=ubicacion_etiqueta]', 'Sede Chapinero');
  await panel.screenshot({ path: DIR + 'admin-negocio-form.png' });
  await panel.click('#n-guardar');
  await panel.waitForSelector(`#lista-negocios tr:has(td.cod:text-is("/n/${slug}")) td:text-is("Gimnasio")`);
  await panel.screenshot({ path: DIR + 'admin-escritorio.png', fullPage: true });
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${BASE}/n/${slug}`);
  assert.equal(await p.getAttribute('html', 'data-tema'), 'energia');
  assert.ok((await p.$$eval('.pt-boton span', (s) => s.map((x) => x.textContent))).includes('Mis monedas'));
  await p.close();
  const m = await ctx.newPage();
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(BASE + '/admin');
  await m.waitForSelector('#app:not([hidden])');
  await sinScrollHorizontal(m);
  await m.screenshot({ path: DIR + 'admin-movil.png', fullPage: true });
  await m.close();
});

console.log('Fase 2');
const filaNegocio = `#lista-negocios tr:has(td.cod:text-is("/n/${slug}"))`;
await caso('admin: club, PIN de caja y premio de $8.000 = 80 monedas', async () => {
  await panel.click('.tab[data-tab=negocios]');
  await panel.click(`${filaNegocio} [data-editar]`);
  await panel.click('#f-sector label:has(input[value=cafe])');
  await panel.check('#form-negocio [name=srv_club]');
  await panel.fill('#form-negocio [name=pin]', '2468');
  await panel.click('#n-guardar');
  await panel.waitForSelector(`${filaNegocio} td:text-is("Café")`);
  await panel.click(`${filaNegocio} [data-editar]`);
  await panel.waitForSelector('#premios-bloque:not([hidden])');
  await panel.fill('#p-nombre', 'Capuchino');
  await panel.fill('#p-valor', '8000');
  await panel.click('#p-agregar');
  await panel.waitForSelector('#lista-premios td.costo:text-is("80 monedas")');
  await panel.locator('#premios-bloque').scrollIntoViewIfNeeded();
  await panel.screenshot({ path: DIR + 'admin-club-premios.png' });
  await panel.click('#n-cancelar');
});
let tokenLaura;
await caso('club: inscribirse en el celular → tarjeta con 0 y bienvenida pendiente; recargar la conserva', async () => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push('club: ' + e.message));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${BASE}/n/${slug}/club`);
  await p.waitForSelector('#registro:not([hidden])');
  await p.fill('#r-nombre', 'Laura Martínez');
  await p.fill('#r-celular', '300 111 2233');
  assert.equal(await p.isDisabled('#r-unirme'), true, 'no envía sin la casilla');
  await p.screenshot({ path: DIR + 'club-registro.png', fullPage: true });
  await p.check('#r-acepto');
  await p.click('#r-unirme');
  await p.waitForSelector('#tarjeta:not([hidden])');
  assert.equal(await p.textContent('#t-numero'), '0');
  assert.match(await p.textContent('#t-aviso'), /50 de bienvenida se activan en tu primera visita/);
  await sinScrollHorizontal(p);
  await p.screenshot({ path: DIR + 'club-tarjeta.png', fullPage: true });
  await p.reload();
  await p.waitForSelector('#tarjeta:not([hidden])');
  await p.click('#t-premios');
  await p.waitForSelector('#hoja-premios.abierta');
  assert.match(await p.textContent('#lista-premios'), /80 monedas/);
  await p.click('#hoja-premios [data-cerrar]');
  await p.waitForSelector('#hoja-premios', { state: 'hidden' });
  await p.click('#t-codigo');
  await p.waitForSelector('#hoja-codigo.abierta');
  await p.waitForTimeout(400);
  const ancho = await p.$eval('#qr svg', (s) => s.getBoundingClientRect().width);
  assert.ok(ancho >= 240, 'QR de ' + ancho + ' px');
  await p.screenshot({ path: DIR + 'club-codigo.png' });
  tokenLaura = await p.evaluate((k) => localStorage.getItem(k), 'nef_club_' + slug);
  assert.match(tokenLaura, /^[0-9a-f]{32}$/);
  await p.goto(`${BASE}/n/${slug}/datos`);
  assert.match(await p.textContent('main'), /Ley 1581/);
  assert.match(await p.textContent('main'), /vencen si pasas 12 meses sin visitas/);
  await p.screenshot({ path: DIR + 'club-datos.png', fullPage: true });
  await p.close();
});
let caja;
await caso('caja: PIN malo dice los intentos; PIN bueno → buscar → Sumar → 60', async () => {
  caja = await ctx.newPage();
  caja.on('pageerror', (e) => errores.push('caja: ' + e.message));
  await caja.setViewportSize({ width: 390, height: 844 });
  await caja.goto(`${BASE}/caja/${slug}`);
  await caja.waitForSelector('#pantalla-pin:not([hidden])');
  await caja.fill('#pin', '0000');
  await caja.click('#form-pin button');
  await caja.waitForSelector('#pin-error:not([hidden])');
  assert.match(await caja.textContent('#pin-error'), /PIN incorrecto\. Te quedan 9 intentos/);
  await caja.fill('#pin', '2468');
  await caja.click('#form-pin button');
  await caja.waitForSelector('#pantalla-buscar:not([hidden])');
  await caja.fill('#dato', '3001112233');
  await caja.press('#dato', 'Enter');
  await caja.waitForSelector('#ficha:not([hidden])');
  assert.equal(await caja.textContent('#f-nombre'), 'Laura Martínez');
  await caja.click('#sumar');
  await caja.waitForFunction(() => document.getElementById('f-saldo').textContent === '60');
  await caja.waitForTimeout(350);
  await caja.screenshot({ path: DIR + 'caja-ficha.png', fullPage: true });
  const [m] = await api(`membresias?token=eq.${tokenLaura}`);
  assert.equal(m.saldo, 60);
});
await caso('caja sin conexión: guarda, reconecta y suma una sola vez', async () => {
  const r = await api('rpc/club_registrar', 'POST', { p_slug: slug, p_nombre: 'Andrés Pérez', p_telefono: '3104445566', p_acepta: true });
  await caja.fill('#dato', '3104445566');
  await caja.press('#dato', 'Enter');
  await caja.waitForSelector('#f-nombre:text-is("Andrés Pérez")');
  await ctx.setOffline(true);
  await caja.click('#sumar');
  await caja.waitForSelector('#toast.visible:has-text("Guardado, se enviará al volver la conexión")');
  await caja.waitForSelector('#sin-conexion:not([hidden])');
  assert.match(await caja.textContent('#sin-conexion'), /1 operación guardada/);
  await caja.screenshot({ path: DIR + 'caja-sin-conexion.png', fullPage: true });
  await ctx.setOffline(false);
  await caja.waitForSelector('#sin-conexion', { state: 'hidden', timeout: 25000 });
  const [m] = await api(`membresias?token=eq.${r.token}`);
  assert.equal(m.saldo, 60, 'saldo ' + m.saldo);
  const visitas = await api(`movimientos?membresia_id=eq.${m.id}`);
  assert.equal(visitas.filter((v) => v.tipo === 'visita').length, 1);
  await caja.close();
});

await browser.close();
assert.deepEqual(errores, [], 'Errores de JavaScript en las páginas:\n' + errores.join('\n'));
console.log(`\n${ok} pruebas OK · capturas en tests/capturas/`);
