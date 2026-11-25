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
// Si un caso falla, guarda captura de cada página abierta (tests/capturas/fallo-*.png) antes de cortar
const caso = async (nombre, fn) => {
  try { await fn(); } catch (e) {
    let k = 0;
    for (const c of browser.contexts()) for (const pg of c.pages()) await pg.screenshot({ path: DIR + 'fallo-' + (k++) + '.png', fullPage: true }).catch(() => {});
    console.error('  ✗', nombre, '· capturas en tests/capturas/fallo-*.png');
    throw e;
  }
  ok++; console.log('  ✓', nombre);
};
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
  await panel.click('#form-login button[type=submit]');
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
  assert.deepEqual(await ir(`/c/${slug}/whatsapp?t=${codigos[0]}`), [302, 'https://wa.me/573001234567?text=' + encodeURIComponent('Hola Café Prueba, ')], 'abre el chat con el saludo escrito');
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
  await p.waitForTimeout(1200); // que terminen las animaciones de entrada
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
  // Por ahora solo restaurantes: Gimnasio está escondido tras "Ver más sectores"
  assert.equal(await panel.isVisible('#f-sector-gym'), false);
  await panel.click('#f-mas-sectores');
  await panel.click('#f-sector label:has(input[value=gimnasio])');
  assert.equal(await panel.isVisible('#f-nfc'), true, 'NFC aparece al elegir gimnasio');
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
  assert.equal(await p.textContent('#t-regalo'), '+50 de regalo', 'la bienvenida pendiente se ve en el boleto del pase');
  assert.equal(await p.isVisible('#t-boleto'), true);
  assert.match(await p.textContent('#t-frase'), /Te faltan \d+ visitas? para|ya te alcanza para/, 'el próximo premio dice cuánto falta, en visitas');
  assert.match(await p.getAttribute('#tarjeta .pt-volver', 'href'), new RegExp(`/n/${slug}$`), 'se puede volver al menú del negocio');
  assert.equal(await p.isVisible('#t-aviso'), false, 'sin aviso repetido');
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
  assert.match(await p.textContent('main'), /Juan Jacobo López Álvarez/, 'el encargado está identificado');
  assert.match(await p.textContent('main'), /consultas en máximo 10 días hábiles/);
  assert.doesNotMatch(await p.textContent('main'), /Plantilla/);
  for (const ruta of ['/privacidad', '/terminos']) {
    const r = await p.goto(BASE + ruta);
    assert.equal(r.status(), 200, ruta);
    assert.match(await p.textContent('main'), /1.011.093.718/, ruta + ' identifica a quien presta el servicio');
  }
  await p.screenshot({ path: DIR + 'terminos-movil.png' });
  await p.goto(`${BASE}/n/${slug}/datos`);
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

console.log('Fase 5');
const FOTO = fileURLToPath(new URL('./fixtures/foto.png', import.meta.url));
let negocioId;
await caso('admin de la carta: categoría, plato con foto WebP y "Agotado hoy" de un toque', async () => {
  await api(`negocios?slug=eq.${slug}`, 'PATCH', { sector: 'cafe' });
  await servicios({ catalogo: true, club: true });
  const [n] = await api(`negocios?slug=eq.${slug}`);
  negocioId = n.id;
  await panel.click('.tab[data-tab=catalogo]');
  await panel.selectOption('#k-negocio', { label: 'Café Prueba' });
  await panel.fill('#k-cat-nueva', 'Desayunos');
  await panel.click('#k-cat-agregar');
  await panel.waitForSelector('#k-cat-lista li:has-text("Desayunos")');
  await api('categorias', 'POST', [{ negocio_id: n.id, nombre: 'Cafés', orden: 2 }, { negocio_id: n.id, nombre: 'Postres', orden: 3 }]);
  const cats = await api(`categorias?negocio_id=eq.${n.id}`);
  const id = (nom) => cats.find((c) => c.nombre === nom).id;
  const filas = [];
  for (let i = 1; i <= 10; i++) filas.push({ negocio_id: n.id, categoria_id: id('Desayunos'), tipo: 'plato', nombre: `Desayuno ${i}`, descripcion: 'Huevos, arepa y café', precio: 12000 + i * 500, etiquetas: ['salado'], destacado: i === 3, agotado: false, activo: true, pasos: [], horario: [] });
  for (let i = 1; i <= 9; i++) filas.push({ negocio_id: n.id, categoria_id: id('Cafés'), tipo: 'plato', nombre: `Café ${i}`, descripcion: 'De origen, en taza grande', precio: 5000 + i * 300, etiquetas: ['bebida'], destacado: false, agotado: false, activo: true, pasos: [], horario: [] });
  for (let i = 1; i <= 10; i++) filas.push({ negocio_id: n.id, categoria_id: id('Postres'), tipo: 'plato', nombre: `Postre ${i}`, descripcion: 'Hecho en casa', precio: 7000 + i * 400, etiquetas: ['dulce'], destacado: i === 1, agotado: false, activo: true, pasos: [], horario: [] });
  await api('productos', 'POST', filas);
  await catalogoRecargar();
  // Plato 30, por la interfaz y con foto
  await panel.click('#k-nuevo');
  await panel.click('#form-producto label:has(input[value=plato])');
  await panel.fill('#k-nombre', 'Calentado de la casa');
  await panel.fill('#k-desc', 'Fríjol, arroz, huevo y arepa');
  await panel.fill('#k-precio', '18500');
  await panel.selectOption('#k-categoria', { label: 'Desayunos' });
  await panel.click('#k-etiquetas label:has(input[value=salado])');
  await panel.setInputFiles('#k-foto', FOTO);
  await panel.waitForSelector('#k-foto-txt:has-text("Foto lista")');
  await panel.screenshot({ path: DIR + 'admin-plato.png' });
  await panel.click('#k-guardar');
  await panel.waitForSelector('#lista-productos td:has-text("Calentado de la casa")');
  const [cal] = await api(`productos?nombre=eq.Calentado de la casa`);
  assert.match(cal.foto_url, /\/storage\/v1\/object\/public\/fotos\/.+\.webp$/);
  const foto = await fetch(cal.foto_url);
  assert.equal(foto.headers.get('content-type'), 'image/webp');
  const bytes = Buffer.from(await foto.arrayBuffer());
  assert.equal(bytes.subarray(8, 12).toString(), 'WEBP', 'el archivo guardado es WebP');
  // "Agotado hoy" de un toque en la tabla
  await panel.check('#lista-productos tr:has-text("Postre 2") .k-agotado');
  await panel.waitForTimeout(400);
  const [p2] = await api(`productos?nombre=eq.Postre 2`);
  assert.equal(p2.agotado, true);
  await panel.screenshot({ path: DIR + 'admin-carta.png', fullPage: true });
});
async function catalogoRecargar() {
  await panel.$eval('#k-negocio', (s) => s.dispatchEvent(new Event('change')));
  await panel.waitForSelector('#lista-productos td:has-text("Postre 10")');
}
await caso('carta en el celular: 30 productos, agotado en gris, hoja que cierra con Escape y con "atrás"', async () => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push('carta: ' + e.message));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${BASE}/n/${slug}`);
  assert.equal(await p.getAttribute('.pt-boton.principal', 'href'), `/n/${slug}/carta`);
  await p.click('.pt-boton.principal');
  await p.waitForURL(new RegExp(`/n/${slug}/carta`));
  assert.equal(await p.locator('.pt-prod').count(), 30);
  assert.equal(await p.locator('.pt-pestanas [role=tab]').count(), 3);
  const agotado = p.locator('.pt-prod:has-text("Postre 2")');
  assert.match(await agotado.getAttribute('class'), /agotado/);
  assert.match(await agotado.textContent(), /Agotado hoy/);
  assert.equal(await p.textContent('#cat-' + (await p.getAttribute('.pt-seccion >> nth=0', 'data-cat')) + ' .pt-prod >> nth=0 >> b'), 'Desayuno 3', 'el destacado sale primero');
  await sinScrollHorizontal(p);
  await p.screenshot({ path: DIR + 'carta-movil.png' });
  await p.evaluate(() => document.querySelectorAll('.pt-revela').forEach((x) => x.classList.add('visible'))); // la captura no baja por la página
  await p.waitForTimeout(700);
  await p.screenshot({ path: DIR + 'carta-movil-completa.png', fullPage: true });
  await p.click('.pt-prod:has-text("Calentado de la casa")');
  await p.waitForSelector('#hoja-detalle.abierta');
  await p.waitForTimeout(350);
  assert.equal(await p.textContent('#d-nombre'), 'Calentado de la casa');
  await p.screenshot({ path: DIR + 'carta-detalle.png' });
  await p.keyboard.press('Escape');
  await p.waitForSelector('#hoja-detalle', { state: 'hidden' });
  await p.click('.pt-prod:has-text("Café 1")');
  await p.waitForSelector('#hoja-detalle.abierta');
  await p.goBack();
  await p.waitForSelector('#hoja-detalle', { state: 'hidden' });
  assert.match(p.url(), /\/carta$/, 'atrás cierra la hoja sin salir de la carta');
  await p.click('.pt-pestanas [role=tab]:has-text("Postres")');
  await p.waitForFunction(() => document.querySelector('.pt-pestanas [aria-selected=true]').textContent === 'Postres');
  await p.close();
  const ev = await api(`eventos_carta?negocio_id=eq.${negocioId}`);
  assert.ok(ev.some((e) => e.tipo === 'ver_carta') && ev.some((e) => e.tipo === 'ver_producto'));
});
await caso('"Elige por mí": gira de una con sonido, sugiere un plato disponible, "Lo pido" se registra y no da monedas', async () => {
  const movAntes = (await api('movimientos')).length;
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push('elige: ' + e.message));
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${BASE}/n/${slug}/carta`);
  await p.click('#elige');
  await p.waitForSelector('#hoja-elige.abierta');
  // Gira de una sobre toda la carta (sin elegir antojo), con botón de sonido
  assert.equal(await p.getAttribute('#e-sonido', 'aria-pressed'), 'true');
  await p.waitForSelector('#g-acciones:not([hidden])', { timeout: 8000 });
  const elegido = await p.$eval('#rollo [data-elegido]', (d) => d.textContent);
  assert.ok(elegido.length > 0); assert.notEqual(elegido, 'Postre 2', 'sugirió un agotado');
  await p.click('#e-sonido');
  assert.equal(await p.getAttribute('#e-sonido', 'aria-pressed'), 'false', 'se puede apagar el sonido');
  await p.screenshot({ path: DIR + 'elige-por-mi.png' });
  await p.click('#lo-pido');
  await p.waitForSelector('#g-frase:not([hidden])');
  await p.close();
  const ev = await api(`eventos_carta?negocio_id=eq.${negocioId}`);
  assert.ok(ev.some((e) => e.tipo === 'girar') && ev.some((e) => e.tipo === 'ruleta_acepto'));
  assert.equal((await api('movimientos')).length, movAntes, 'girar no da monedas');
});

console.log('Fase 7');
await caso('mensualidades: vencido + sin gracia apaga el toque; "Registrar pago" lo prende', async () => {
  await panel.click('.tab[data-tab=cobros]');
  const fila = panel.locator('#lista-cobros tr', { hasText: 'Café Prueba' }).first();
  await fila.waitFor();
  const hace40 = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
  await fila.locator('input[type=number]').fill('0');
  await fila.locator('input[type=number]').dispatchEvent('change');
  await panel.waitForTimeout(400);
  await panel.locator('#lista-cobros tr', { hasText: 'Café Prueba' }).first().locator('input[type=date]').fill(hace40);
  await panel.locator('#lista-cobros tr', { hasText: 'Café Prueba' }).first().locator('input[type=date]').dispatchEvent('change');
  await panel.waitForSelector('#lista-cobros tr:has-text("Café Prueba") .n-estado.alerta');
  await panel.screenshot({ path: DIR + 'panel_mensualidades.png' });
  const [s1, l1] = await ir(`/t/${codigos[0]}`);
  assert.equal(s1, 302); assert.match(l1, /\/inactivo$/,'vencido: el tag lleva a inactivo');
  assert.match((await ir(`/n/${slug}`))[1] || '', /\/inactivo$/,'vencido: el portal no se muestra');
  await panel.locator('#lista-cobros tr', { hasText: 'Café Prueba' }).first().locator('button').click();
  await panel.waitForSelector('#lista-cobros tr:has-text("Café Prueba") .n-estado.ok');
  const [s2, l2] = await ir(`/t/${codigos[0]}`);
  assert.equal(s2, 302); assert.match(l2, new RegExp(`/n/${slug}`), 'pagado: vuelve al portal');
});
await caso('"Tócalo tú": escondido sin negocio demo; visible y lleva al portal cuando existe', async () => {
  const p = await ctx.newPage();
  await p.goto(BASE + '/');
  await p.waitForTimeout(800);
  assert.equal(await p.isVisible('#demo'), false, 'sin demo-cafe el botón no aparece');
  if (!(await api('negocios?slug=eq.demo-cafe')).length) await api('negocios', 'POST', { slug: 'demo-cafe', nombre: 'Café Demo' });
  await p.reload();
  await p.waitForTimeout(800);
  assert.equal(await p.isVisible('#demo'), true);
  await p.click('#demo');
  await p.waitForURL(/\/n\/demo-cafe$/);
  await p.close();
});

await caso('plato en 3D: carga con fundido, giro limitado, aviso de la app de Google y de no compatible; sin modelo, solo la foto', async () => {
  const [n] = await api(`negocios?slug=eq.${slug}`);
  const prods = await api(`productos?negocio_id=eq.${n.id}&tipo=eq.plato&activo=eq.true&select=id,nombre&order=nombre&limit=2`);
  assert.ok(prods.length >= 2, 'hay platos para probar');
  await api(`productos?id=eq.${prods[0].id}`, 'PATCH', { modelo_url: '/assets/demo/3d/capuchino.glb' });
  await assert.rejects(api(`productos?id=eq.${prods[1].id}`, 'PATCH', { modelo_url: 'javascript:alert(1).glb' }), /check|violates/i);
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${BASE}/n/${slug}/carta`);
  await p.click(`.pt-prod[data-id="${prods[1].id}"], .pt-pop[data-id="${prods[1].id}"]`);
  await p.waitForSelector('#hoja-detalle.abierta');
  await p.waitForTimeout(600);
  assert.equal(await p.$('#d-3d model-viewer'), null, 'sin modelo no hay 3D');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  await p.click(`.pt-prod[data-id="${prods[0].id}"], .pt-pop[data-id="${prods[0].id}"]`);
  await p.waitForSelector('#d-3d model-viewer');
  const mv = (k) => p.getAttribute('#d-3d model-viewer', k);
  assert.equal(await mv('src'), '/assets/demo/3d/capuchino.glb');
  await p.waitForTimeout(800);
  // En computador no hay "Verlo en tu mesa": solo el 3D que se gira
  assert.equal(await p.$('#d-3d .pt-ar'), null, 'sin celular no se ofrece la realidad aumentada');
  assert.equal(await mv('touch-action'), 'none', 'deslizar gira el plato, no la página');
  assert.match(await mv('max-camera-orbit'), /80deg/, 'no se ve el plato por debajo');
  assert.equal(await p.evaluate(() => document.documentElement.classList.contains('n-hoja-abierta')), true, 'con la hoja abierta, la carta de atrás no se mueve');
  await p.close();

  // Android (simulado): carga → 3D con fundido; "Verlo en tu mesa" muestra el paso a paso (3 pasos, dibujos azules)
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36' });
  const a = await ctxA.newPage();
  a.on('pageerror', (e) => errores.push('carta android: ' + e.message));
  await a.goto(`${BASE}/n/${slug}/carta`);
  await a.tap(`.pt-prod[data-id="${prods[0].id}"], .pt-pop[data-id="${prods[0].id}"]`);
  await a.waitForSelector('#d-3d .pt-3d-carga');
  assert.match(await a.textContent('#d-3d .pt-3d-carga'), /Cargando tu plato/);
  await a.waitForSelector('#d-3d.listo', { timeout: 30000 });
  // Sin la realidad aumentada de Google (este navegador): aviso de la app de Google y su servicio, sin tarjetas de pasos
  await a.tap('#d-3d .pt-ar');
  await a.waitForSelector('.pt-guia h2:has-text("cámara de Google")');
  assert.match(await a.textContent('.pt-guia'), /Servicios de Google Play para RA/);
  await a.screenshot({ path: DIR + 'carta-aviso-google.png' });
  await a.tap('.pt-guia [data-salir]');
  // Si la app de Google no puede, vuelve con #ra-no-compatible-<id> → aviso claro
  await a.evaluate((id) => { location.hash = 'ra-no-compatible-' + id; }, prods[0].id);
  await a.waitForSelector('.pt-guia h2:has-text("No es compatible")');
  await a.screenshot({ path: DIR + 'carta-no-compatible.png' });
  await ctxA.close();
  await api(`productos?id=eq.${prods[0].id}`, 'PATCH', { modelo_url: null });
});

await caso('QR de compra: la caja marca productos y genera el QR; una clienta nueva lo abre, se inscribe y gana; la caja dice ¡Listo!', async () => {
  const caja = await ctx.newPage(); // misma sesión de caja (guardada en este navegador)
  caja.on('pageerror', (e) => errores.push('caja qr: ' + e.message));
  await caja.setViewportSize({ width: 390, height: 844 });
  await caja.goto(`${BASE}/caja/${slug}`);
  await caja.waitForSelector('#pantalla-buscar:not([hidden])');
  await caja.waitForSelector('#cobrar-qr:not([hidden])');
  await caja.click('#cobrar-qr');
  await caja.waitForSelector('#compra-lista .pt-compra-item');
  await caja.click('#compra-lista .pt-compra-item >> nth=0');
  await caja.click('#compra-lista .pt-compra-item >> nth=0');
  await caja.click('#compra-lista .pt-compra-item >> nth=1');
  assert.equal(await caja.textContent('#compra-lista .pt-compra-item >> nth=0 >> .pt-compra-cant'), '×2');
  const [resp] = await Promise.all([
    caja.waitForResponse((r) => r.url().includes('/rpc/caja_crear_compra')),
    caja.click('#compra-generar'),
  ]);
  const compra = await resp.json();
  assert.match(compra.codigo, /^[0-9a-f]{32}$/);
  await caja.waitForSelector('#compra-codigo svg');
  assert.match(await caja.textContent('#compra-vence'), /Vence en (9|10):/);
  await caja.screenshot({ path: DIR + 'caja-qr-compra.png' });

  const ctxC = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (process.env.SB_BUNDLE) await ctxC.route(/cdn\.jsdelivr\.net\/.*supabase/, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(process.env.SB_BUNDLE, 'utf8') }));
  const cli = await ctxC.newPage();
  cli.on('pageerror', (e) => errores.push('cliente qr: ' + e.message));
  await cli.goto(`${BASE}/n/${slug}/club?c=${compra.codigo}`);
  await cli.waitForSelector('#registro:not([hidden])');
  assert.equal(new URL(cli.url()).search, '', 'el código sale de la dirección (recargar no lo reintenta)');
  await cli.fill('#r-nombre', 'Marta QR');
  await cli.fill('#r-celular', '3209990011');
  await cli.check('#r-acepto');
  await cli.click('#r-unirme');
  await cli.waitForSelector('#tarjeta:not([hidden])');
  await cli.waitForFunction(() => document.getElementById('t-boleto').hidden, null, { timeout: 15000 }); // la bienvenida ya se activó
  await cli.waitForTimeout(1800);
  const saldo = Number((await cli.textContent('#t-numero')).replace(/\D/g, ''));
  assert.ok(saldo >= 50 + 1, 'la compra sumó la visita y activó la bienvenida: ' + saldo);
  await cli.screenshot({ path: DIR + 'club-qr-compra.png' });
  await caja.waitForSelector('#compra-titulo:has-text("¡Listo!")', { timeout: 10000 });
  await ctxC.close();
});

console.log('Fase 8 · panel del dueño');
{
  const sufijo = Date.now().toString(36);
  const SLUG_A = 'cafe-ana-' + sufijo, SLUG_B = 'gym-beto-' + sufijo;
  const CORREO_A = `ana-${sufijo}@cafe.co`, CORREO_B = `beto-${sufijo}@gym.co`;
  await api('negocios', 'POST', { slug: SLUG_A, nombre: 'Café de Ana', sector: 'cafe', servicios: { base: true, catalogo: true, club: true, estudio: false } });
  await api('negocios', 'POST', { slug: SLUG_B, nombre: 'Gym de Beto', sector: 'gimnasio', servicios: { base: true, catalogo: true, club: true, estudio: false } });
  const [A] = await api(`negocios?slug=eq.${SLUG_A}`);
  const [B] = await api(`negocios?slug=eq.${SLUG_B}`);
  await api('productos', 'POST', [{ negocio_id: A.id, nombre: 'Tinto de Ana', precio: 3000, tipo: 'plato' }, { negocio_id: B.id, nombre: 'Batido de Beto', precio: 9000, tipo: 'plato' }]);
  await api('premios', 'POST', [{ negocio_id: A.id, nombre: 'Pandebono gratis', valor_pesos: 2500 }, { negocio_id: B.id, nombre: 'Clase gratis', valor_pesos: 20000 }]);
  await api('informes', 'POST', { negocio_id: A.id, periodo: '2026 · 4.º trimestre', ruta: `${A.id}/${sufijo}.pdf` });

  // Dos navegadores aparte: Ana en celular, Beto en escritorio
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  for (const c of [ctxA, ctxB]) if (process.env.SB_BUNDLE) {
    const body = fs.readFileSync(process.env.SB_BUNDLE, 'utf8');
    await c.route(/cdn\.jsdelivr\.net\/.*supabase/, (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body }));
  }
  const ana = await ctxA.newPage(); ana.on('pageerror', (e) => errores.push('ana: ' + e.message));
  const beto = await ctxB.newPage(); beto.on('pageerror', (e) => errores.push('beto: ' + e.message));

  const registrar = async (p, correo) => {
    await p.goto(BASE + '/panel');
    await p.waitForSelector('#login:not([hidden])');
    await p.click('#l-modo');
    await p.fill('#l-email', correo);
    await p.fill('#l-clave', 'clave123');
    await p.check('#l-acepta');
    await p.click('.n-clave .n-ver');
    assert.equal(await p.getAttribute('#l-clave', 'type'), 'text', '"Ver" muestra la contraseña');
    await p.click('.n-clave .n-ver');
    assert.equal(await p.getAttribute('#l-clave', 'type'), 'password', '"Ocultar" la esconde otra vez');
    await p.click('#l-enviar');
    await p.waitForSelector('#sin-acceso:not([hidden])');
    assert.equal(await p.textContent('#sa-email'), correo);
  };
  await caso('el dueño crea su cuenta en /panel y queda esperando acceso', async () => {
    await registrar(ana, CORREO_A);
    await ana.screenshot({ path: DIR + 'panel_dueno_sin_acceso_movil.png' });
    await registrar(beto, CORREO_B);
  });
  await caso('admin › Dueños: correo sin cuenta avisa; con cuenta da acceso a su empresa', async () => {
    await panel.click('.tab[data-tab=duenos]');
    await panel.waitForSelector('#a-empresa option', { state: 'attached' });
    const opcion = async (nombre) => panel.$eval('#a-empresa', (s, n) => [...s.options].find((o) => o.text.startsWith(n)).value, nombre);
    await panel.fill('#a-email', 'nadie-' + sufijo + '@x.co');
    await panel.selectOption('#a-empresa', await opcion('Café de Ana'));
    await panel.click('#form-acceso button[type=submit]');
    await panel.waitForSelector('#toast.visible:has-text("todavía no tiene cuenta")');
    await panel.fill('#a-email', CORREO_A);
    await panel.click('#form-acceso button[type=submit]');
    await panel.waitForSelector(`#lista-accesos tr:has-text("${CORREO_A}")`);
    await panel.fill('#a-email', CORREO_B);
    await panel.selectOption('#a-empresa', await opcion('Gym de Beto'));
    await panel.selectOption('#a-rol', 'gerente');
    await panel.click('#form-acceso button[type=submit]');
    await panel.waitForSelector(`#lista-accesos tr:has-text("${CORREO_B}")`);
    await panel.screenshot({ path: DIR + 'panel_admin_duenos.png' });
  });
  await caso('cada dueño ve SOLO lo suyo: resumen, catálogo, club e informes', async () => {
    await ana.reload();
    await ana.waitForSelector('#app:not([hidden])');
    // Guía: sale sola la primera vez; Ana la recorre completa (en celular, tarjeta abajo)
    await ana.waitForSelector('.n-guia-capa:not([hidden])');
    let pasos = 0, vioAgotado = false;
    while (pasos++ < 20) {
      const titulo = await ana.textContent('#guia-titulo');
      if (titulo === '¿Se acabó algo?') { vioAgotado = true; await ana.waitForTimeout(500); await ana.screenshot({ path: DIR + 'panel_guia_movil.png' }); }
      if ((await ana.textContent('#guia-siguiente')) === 'Listo') { await ana.click('#guia-siguiente'); break; }
      await ana.click('#guia-siguiente');
    }
    assert.ok(vioAgotado, 'la guía explica dónde marcar Agotado hoy');
    assert.equal(await ana.isVisible('.n-guia-capa'), false, 'Listo cierra la guía');
    assert.equal(await ana.textContent('#titulo-seccion'), 'Café de Ana', 'vuelve al resumen');
    await ana.reload();
    await ana.waitForSelector('#app:not([hidden])');
    await ana.waitForTimeout(1000);
    assert.equal(await ana.isVisible('.n-guia-capa'), false, 'la segunda vez no sale sola');
    await ana.click('#guia');
    await ana.waitForSelector('.n-guia-capa:not([hidden])');
    await ana.click('#guia-saltar');
    assert.equal(await ana.textContent('#titulo-seccion'), 'Café de Ana');
    assert.equal(await ana.isVisible('#sede-caja'), false, 'una sola sede: sin selector');
    await ana.waitForSelector('#r-stats .n-kpi');
    await ana.screenshot({ path: DIR + 'panel_dueno_resumen_movil.png', fullPage: true });
    await ana.click('.tab[data-tab=catalogo]');
    await ana.waitForSelector('#lista-productos tr:has-text("Tinto de Ana")');
    assert.equal(await ana.locator('#lista-productos tr', { hasText: 'Batido de Beto' }).count(), 0);
    await ana.locator('#lista-productos tr', { hasText: 'Tinto de Ana' }).locator('.k-agotado').check();
    await ana.waitForSelector('#toast.visible');
    await ana.screenshot({ path: DIR + 'panel_dueno_catalogo_movil.png', fullPage: true });
    await ana.click('.tab[data-tab=club]');
    await ana.waitForSelector('#lista-premios input[value="Pandebono gratis"]');
    assert.equal(await ana.locator('#lista-premios input[value="Clase gratis"]').count(), 0);
    await ana.fill('#p-nombre', 'Croissant');
    await ana.fill('#p-valor', '6000');
    await ana.click('#p-agregar');
    await ana.waitForSelector('#lista-premios input[value="Croissant"]');
    await ana.fill('#pin', '2468');
    await ana.click('#form-pin button[type=submit]');
    await ana.waitForSelector('#pin-estado:has-text("ya tiene PIN")');
    await ana.screenshot({ path: DIR + 'panel_dueno_club_movil.png', fullPage: true });
    await ana.click('.tab[data-tab=informes]');
    await ana.waitForSelector('#lista-informes li:has-text("4.º trimestre")');
    // Chromium sin pantalla cancela los PDF como descarga: basta con ver que pide el PDF firmado
    const pedido = ctxA.waitForEvent('request', (r) => /\/storage\/v1\/object\/sign\/informes\/.*token=/.test(r.url()));
    const [pdf] = await Promise.all([ana.waitForEvent('popup'), ana.click('#lista-informes button')]);
    await pedido;
    await pdf.close();

    await beto.reload();
    await beto.waitForSelector('#app:not([hidden])');
    await beto.waitForSelector('.n-guia-capa:not([hidden])');
    await beto.waitForTimeout(600);
    await beto.screenshot({ path: DIR + 'panel_guia_escritorio.png' });
    await beto.click('#guia-saltar');
    assert.equal(await beto.textContent('#titulo-seccion'), 'Gym de Beto');
    await beto.click('.tab[data-tab=catalogo]');
    await beto.waitForSelector('#lista-productos tr:has-text("Batido de Beto")');
    assert.equal(await beto.locator('#lista-productos tr', { hasText: 'Tinto de Ana' }).count(), 0);
    await beto.click('.tab[data-tab=clientes]');
    assert.equal(await beto.isVisible('#c-entradas'), true, 'gimnasio: importar entradas');
    await beto.click('.tab[data-tab=informes]');
    await beto.waitForSelector('#lista-informes .n-vacio');
    assert.equal(await beto.locator('#lista-informes li', { hasText: '4.º trimestre' }).count(), 0, 'Beto no ve el informe de Ana');
    await beto.screenshot({ path: DIR + 'panel_dueno_informes.png' });
  });
  await caso('aislamiento por la API con la sesión de cada dueño (no solo en la pantalla)', async () => {
    const sesion = async (correo) => (await (await fetch(`${MOCK}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: correo, password: 'clave123' }) })).json()).access_token;
    const tA = await sesion(CORREO_A);
    const como = (tk, ruta, method = 'GET', body) => fetch(`${MOCK}/rest/v1/${ruta}`, { method, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    for (const t of ['productos', 'premios', 'tags', 'informes', 'membresias', 'categorias'])
      assert.deepEqual(await (await como(tA, `${t}?negocio_id=eq.${B.id}`)).json(), [], `Ana no lee ${t} de Beto`);
    assert.deepEqual(await (await como(tA, 'negocios')).json(), [], 'la tabla negocios no se abre al dueño');
    assert.equal((await como(tA, 'productos', 'POST', { negocio_id: B.id, nombre: 'intruso' })).status, 400);
    assert.equal((await como(tA, 'rpc/stats_dueno', 'POST', { p_negocio: B.id, p_dias: 30 })).status, 400);
    assert.equal((await como(tA, 'rpc/fijar_pin_caja', 'POST', { p_negocio: B.id, p_pin: '1111' })).status, 400);
    assert.equal((await (await como(tA, `premios?negocio_id=eq.${A.id}`)).json()).length, 2, 'los suyos sí (2 premios)');
  });
  await caso('/stats?k= sigue funcionando y avisa que ahora se entra por /panel', async () => {
    const p = await ctxB.newPage();
    await p.goto(`${BASE}/stats?k=${B.token_stats}`);
    await p.waitForSelector('#titulo:has-text("Gym de Beto")');
    await p.click('#aviso-panel a');
    await p.waitForURL(/\/panel$/);
    await p.close();
  });
  await ctxA.close();
  await ctxB.close();
}

await browser.close();
assert.deepEqual(errores, [], 'Errores de JavaScript en las páginas:\n' + errores.join('\n'));
console.log(`\n${ok} pruebas OK · capturas en tests/capturas/`);
