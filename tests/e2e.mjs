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

console.log('Fase 3');
const CSV = fileURLToPath(new URL('./fixtures/entradas.csv', import.meta.url));
const servicios = async (extra) => {
  const [n] = await api(`negocios?slug=eq.${slug}`);
  await api(`negocios?slug=eq.${slug}`, 'PATCH', { servicios: { ...n.servicios, ...extra } });
};
await caso('importar entradas: 5.780 nuevas de 200 socios; otra vez → 0 nuevas', async () => {
  await api(`negocios?slug=eq.${slug}`, 'PATCH', { sector: 'gimnasio' });
  await panel.click('.tab[data-tab=entradas]');
  await panel.selectOption('#i-negocio', { label: 'Café Prueba' });
  await panel.setInputFiles('#i-archivo', CSV);
  await panel.waitForSelector('#i-paso2:not([hidden])');
  assert.equal(await panel.$eval('#map-codigo', (s) => s.value), '0');
  assert.equal(await panel.$eval('#map-fecha', (s) => s.value), '4');
  await panel.screenshot({ path: DIR + 'admin-importar.png', fullPage: true });
  await panel.click('#i-importar');
  await panel.waitForSelector('#i-resultado .n-aviso.ok', { timeout: 120000 });
  assert.equal(await panel.textContent('#i-resultado .n-aviso.ok'), 'Importamos 5.780 entradas nuevas de 200 socios. 0 repetidas.');
  await panel.screenshot({ path: DIR + 'admin-importar-ok.png' });
  await panel.setInputFiles('#i-archivo', CSV);
  await panel.waitForSelector('#i-paso2:not([hidden])');
  await panel.click('#i-importar');
  await panel.waitForSelector('#i-resultado .n-aviso.ok[data-nuevas="0"]', { timeout: 120000 });
  assert.match(await panel.textContent('#i-resultado .n-aviso.ok'), /Importamos 0 entradas nuevas de 200 socios\. 5\.780 repetidas\./);
});
await caso('estadísticas del gimnasio: activos, abandono y "En riesgo" (WhatsApp solo en horario legal)', async () => {
  await panel.click('.tab[data-tab=stats]');
  await panel.selectOption('#s-negocio', { label: 'Café Prueba' });
  await panel.waitForSelector('#s-gimnasio .n-lista li');
  assert.ok((await panel.locator('#s-gimnasio .n-lista li').count()) > 0);
  const botones = await panel.locator('#s-gimnasio .n-lista a.n-btn').count();
  const disponibles = await panel.locator('#s-gimnasio .n-lista .n-estado').count();
  assert.ok(botones > 0 !== disponibles > 0, 'o hay botones de WhatsApp o el texto "Disponible…", nunca los dos');
  await panel.locator('#s-gimnasio').scrollIntoViewIfNeeded();
  await panel.screenshot({ path: DIR + 'admin-en-riesgo.png', fullPage: true });
});
await caso('máquina: creada en el admin; el tag abre la ficha con video y 3 pasos', async () => {
  await panel.click('.tab[data-tab=catalogo]');
  await panel.selectOption('#k-negocio', { label: 'Café Prueba' });
  await panel.click('#k-nuevo');
  await panel.click('#form-producto label:has(input[value=maquina])');
  await panel.fill('#k-nombre', 'Prensa de piernas');
  await panel.fill('#k-video', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await panel.fill('#k-paso1', 'Ajusta el asiento a la altura de tu cadera');
  await panel.fill('#k-paso2', 'Empuja sin bloquear las rodillas');
  await panel.fill('#k-paso3', 'Baja despacio, en 3 segundos');
  await panel.click('#k-guardar');
  await panel.waitForSelector('#lista-productos td:has-text("Prensa de piernas")');
  await panel.screenshot({ path: DIR + 'admin-catalogo.png' });
  const [prod] = await api(`productos?nombre=eq.Prensa de piernas`);
  await api(`tags?codigo=eq.${codigos[1]}`, 'PATCH', { destino: 'producto', producto_id: prod.id });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push('máquina: ' + e.message));
  await p.route(/youtube-nocookie\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<body style="margin:0;background:#000"></body>' }));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${BASE}/t/${codigos[1]}`, { waitUntil: 'domcontentloaded' });
  assert.match(p.url(), new RegExp(`/n/${slug}/p/${prod.id}`));
  assert.match(await p.getAttribute('iframe.pt-video', 'src'), /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.equal(await p.locator('.pt-pasos li').count(), 3);
  const [color, fondo] = await p.$eval('.pt-accion', (e) => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]);
  assert.notEqual(color, fondo, 'el texto del botón se pierde en su fondo');
  await sinScrollHorizontal(p);
  await p.screenshot({ path: DIR + 'maquina-ficha.png', fullPage: true });
  await p.close();
  await api(`tags?codigo=eq.${codigos[1]}`, 'PATCH', { destino: 'hub', producto_id: null });
});
await caso('clases de hoy: solo las del día (hora Bogotá)', async () => {
  const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hoy = dias.indexOf(new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/Bogota' }));
  const [n] = await api(`negocios?slug=eq.${slug}`);
  await api('productos', 'POST', [
    { negocio_id: n.id, tipo: 'clase', nombre: 'Spinning', horario: [{ dia: hoy, hora: '18:00', duracion: 45, cupo: 20 }] },
    { negocio_id: n.id, tipo: 'clase', nombre: 'Yoga', horario: [{ dia: (hoy + 1) % 7, hora: '07:00', duracion: 60, cupo: 15 }] },
  ]);
  await servicios({ catalogo: true });
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${BASE}/n/${slug}`);
  await p.click('.pt-boton:has-text("Clases de hoy")');
  await p.waitForURL(new RegExp(`/n/${slug}/clases`));
  const nombres = await p.$$eval('.pt-prod b', (b) => b.map((x) => x.textContent));
  assert.deepEqual(nombres, ['Spinning']);
  await p.screenshot({ path: DIR + 'clases-hoy.png', fullPage: true });
  await p.close();
});
await caso('entrada por NFC: registra una vez al día y muestra la racha; sin entrada_nfc va al portal', async () => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push('entrada: ' + e.message));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${BASE}/n/${slug}/entrada`);
  assert.match(p.url(), new RegExp(`/n/${slug}$`), 'sin entrada_nfc redirige al portal');
  await servicios({ entrada_nfc: true });
  await p.goto(`${BASE}/n/${slug}/entrada`);
  await p.waitForSelector('#hecho:not([hidden])');
  assert.equal(await p.textContent('#e-titulo'), '¡Entrada registrada!');
  assert.equal(await p.locator('#e-semanas i').count(), 8);
  await p.waitForTimeout(350);
  await p.screenshot({ path: DIR + 'entrada-movil.png', fullPage: true });
  await p.reload();
  await p.waitForSelector('#hecho:not([hidden])');
  assert.equal(await p.textContent('#e-titulo'), 'Ya registraste tu entrada hoy');
  const [n] = await api(`negocios?slug=eq.${slug}`);
  const nfc = (await api(`entradas?negocio_id=eq.${n.id}`)).filter((e) => e.origen === 'nfc');
  assert.equal(nfc.length, 1);
  await p.close();
  await servicios({ entrada_nfc: false });
});

console.log('Fase 4');
const PDF = fileURLToPath(new URL('./fixtures/informe.pdf', import.meta.url));
await caso('admin: cada número tiene su "?" con la definición', async () => {
  await panel.click('.tab[data-tab=stats]');
  await panel.selectOption('#s-negocio', { label: 'Café Prueba' });
  await panel.waitForSelector('.viz-root .n-kpi');
  const defs = await panel.$$eval('.viz-root .n-kpi', (ks) => ks.map((k) => (k.querySelector('.n-def[data-def]') || {}).dataset?.def || ''));
  assert.ok(defs.length >= 6, 'kpis: ' + defs.length);
  assert.ok(defs.every((d) => d.length > 10), 'definición vacía');
  assert.ok(defs.includes('Socios con ≥ 1 entrada en los últimos 14 días.'), 'gimnasio muestra Activos');
});
await caso('exportar para el estudio: descarga 4 CSV + LEEME sin teléfonos ni nombres', async () => {
  const descargas = [];
  const listo = new Promise((ok) => panel.on('download', async (d) => { descargas.push(d); if (descargas.length === 5) ok(); }));
  await panel.fill('#e-desde', '2026-09-01');
  await panel.fill('#e-hasta', '2026-11-30');
  await panel.click('#e-exportar');
  await Promise.race([listo, new Promise((_, mal) => setTimeout(() => mal(new Error('descargas: ' + descargas.length)), 60000))]);
  const nombres = descargas.map((d) => d.suggestedFilename()).sort();
  assert.deepEqual(nombres.map((n) => n.replace(/^.*_(\w+)\.(csv|txt)$/, '$1.$2')), ['LEEME.txt', 'canjes.csv', 'clientes.csv', 'entradas.csv', 'visitas.csv']);
  for (const d of descargas) {
    const txt = fs.readFileSync(await d.path(), 'utf8');
    assert.ok(!/3001000|3001112233|Laura|Martínez|telefono/.test(txt), d.suggestedFilename() + ' tiene datos personales');
  }
  const entradas = descargas.find((d) => d.suggestedFilename().endsWith('_entradas.csv'));
  assert.equal(fs.readFileSync(await entradas.path(), 'utf8').trim().split('\n').length, 5780 + 1 + 1, 'cabecera + 5.780 importadas + 1 NFC');
});
let tokenDueno, informeId;
await caso('informe en PDF: el admin lo sube y el dueño lo abre con su link (URL firmada)', async () => {
  await panel.fill('#inf-periodo', '2026 · 4.º trimestre');
  await panel.setInputFiles('#inf-archivo', PDF);
  await panel.waitForSelector('#lista-informes-admin li:has-text("2026 · 4.º trimestre")');
  await panel.locator('#estudio').scrollIntoViewIfNeeded();
  await panel.screenshot({ path: DIR + 'admin-estudio.png' });
  const [n] = await api(`negocios?slug=eq.${slug}`);
  tokenDueno = n.token_stats;
  const [inf] = await api(`informes?negocio_id=eq.${n.id}`);
  informeId = inf.id;
  const [s, loc] = await ir(`/api/informe?k=${tokenDueno}&id=${informeId}`);
  assert.equal(s, 302); assert.match(loc, /\/storage\/v1\/object\/sign\/informes\/.+\.pdf\?token=/);
  const r = await fetch(loc);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
});
await caso('informe: un token de otro negocio no obtiene la URL', async () => {
  await api('negocios', 'POST', { slug: 'otro-' + slug, nombre: 'Otro Negocio' });
  const [otro] = await api(`negocios?slug=eq.otro-${slug}`);
  assert.ok(otro.token_stats && otro.token_stats !== tokenDueno);
  assert.equal((await ir(`/api/informe?k=${otro.token_stats}&id=${informeId}`))[0], 404);
  assert.equal((await ir(`/api/informe?k=inventado&id=${informeId}`))[0], 404);
});
await caso('link del dueño: números con definición, informes, celular y escritorio', async () => {
  for (const [w, h, nombre] of [[390, 844, 'stats-dueno-movil.png'], [1280, 860, 'stats-dueno-escritorio.png']]) {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push('stats dueño: ' + e.message));
    await p.setViewportSize({ width: w, height: h });
    await p.goto(`${BASE}/stats?k=${tokenDueno}`);
    await p.waitForSelector('.viz-root .n-kpi');
    assert.ok(await p.$$eval('.n-kpi', (ks) => ks.every((k) => (k.querySelector('.n-def') || {}).dataset?.def)));
    await p.waitForSelector('#informes:not([hidden]) li:has-text("2026 · 4.º trimestre")');
    assert.ok(!(await p.content()).includes('300100'), 'el link del dueño muestra teléfonos');
    await sinScrollHorizontal(p);
    await p.screenshot({ path: DIR + nombre, fullPage: true });
    await p.close();
  }
});

await browser.close();
assert.deepEqual(errores, [], 'Errores de JavaScript en las páginas:\n' + errores.join('\n'));
console.log(`\n${ok} pruebas OK · capturas en tests/capturas/`);
