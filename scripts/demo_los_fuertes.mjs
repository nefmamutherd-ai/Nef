// Genera supabase/demo-los-fuertes.sql: demo para Los Fuertes Pizzas y Pastas (prospecto, reunión 30/11/2026).
// Carta transcrita de su PDF ("Menú Rediseño Fuertes"), tal cual; lo dudoso está en docs/ventas/los-fuertes/REVISAR-los-fuertes.md.
// Uso: node scripts/demo_los_fuertes.mjs
import fs from 'node:fs';

const N = 'd0000000-0000-4000-8000-0000000000f1';        // negocio
// Empresa propia de la demo: así una cuenta de dueño de prueba ve en /panel SOLO a Los Fuertes (no las otras demos)
const E = 'd0000000-0000-4000-8000-0000000000e2';
const id = (tipo, n) => `d0000000-0000-4000-8000-00000${tipo}${String(n).padStart(5, '0')}`;
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

// [categoría, [[nombre, descripción, precio, etiquetas, extra]]]  · precio 0 = sin precio aparte (se elige dentro de otro plato)
const CARTA = [
  ['Entradas', [
    ['Empanadas de queso', '5 deliciosas empanaditas rellenas de queso mozzarella, envueltas en una masa crujiente y dorada.', 16000, ['salado', 'vegetariano']],
    ['Bruschettas', '5 rebanadas de pan rústico untadas con aceite de oliva, tomates cherry confitados, albahaca fresca y queso burrata, todo finalmente bañado en vinagre balsámico.', 22000, ['salado', 'vegetariano']],
    ['Chicharrones', '160 gr de trozos de cerdo crocantes y dorados, acompañados de una salsa chimichurri y una porción de papas criollas doradas.', 24000, ['salado']],
    ['Albóndigas de chorizo', '3 deliciosas albóndigas elaboradas con chorizo, sazonadas con hierbas mediterráneas y especias aromáticas. Rellenas de queso mozzarella y envueltas en una fina capa de tocineta.', 24000, ['salado']],
    ['Camarones apanados', '140 gr de camarones frescos, empanizados con una mezcla de pan rallado sazonado en especias seleccionadas. Acompañados de una salsa de pimentón casera.', 25000, ['salado']],
  ]],
  ['Cremas y ensaladas', [
    ['Consomé de pollo', 'Un caldo claro y reconfortante elaborado a partir de pollo y verduras seleccionadas, con fideos finos, y adornado con un toque de cilantro.', 10000, ['salado']],
    ['Cremas naturales', 'Pollo, cebolla o tomate. Cremas suaves, elaboradas con una variedad de verduras frescas, cocidas y luego procesadas hasta obtener una textura cremosa. Acompañadas con pan tostado en mantequilla de ajo.', 17000, ['salado']],
    ['Ensalada griega', 'Una mezcla que evoca los sabores mediterráneos. Rodajas de pepino crujiente, tomates cherry, aceitunas, alcaparras, mix de lechuga, trozos de queso mozzarella y aderezo de aceite de oliva y pimienta negra.', 22000, ['salado', 'vegetariano']],
    ['Ensalada verde', 'Una combinación ligera de hojas de lechuga variadas, crujientes pepinos, trozos de mango y aguacate. Complementada con tomates cherry y queso mozzarella.', 22000, ['salado', 'vegetariano']],
    ['Ensalada César', 'Una ensalada clásica que combina tiras de pechuga asada con hojas de lechuga romana fresca, crotones de pan tostado y queso parmesano rallado. Aderezada con una deliciosa vinagreta y pimienta negra.', 27000, ['salado']],
    ['Ensalada caprese', 'Una ensalada que celebra los sabores clásicos de Italia. Rodajas de tomate maduro, intercaladas con rebanadas de queso mozzarella fresco y aceitunas negras. Aderezada con hojas de albahaca y aceite de oliva extra virgen.', 27000, ['salado', 'vegetariano']],
  ]],
  ['Pizzas', [
    ['Pizza familiar · 50 cm', 'Con tu sabor preferido de nuestra carta de pizzas.', 76000, ['salado'], { destacado: true, modelo: 'pizza' }],
    ['Pizza mediana · 35 cm', 'Con tu sabor preferido de nuestra carta de pizzas.', 58000, ['salado']],
    ['Pizza small · 30 cm', 'Con tu sabor preferido de nuestra carta de pizzas.', 42000, ['salado']],
    ['Pizza personal · 22 cm', 'Con tu sabor preferido de nuestra carta de pizzas.', 21000, ['salado']],
    ['Porción de pizza', 'Pollo champiñón, hawaiana, peperoni, mexicana o criolla.', 10300, ['salado']],
    ['Pollo champiñón', 'Jamón, pollo, champiñones.', 0, ['salado']],
    ['Hawaiana', 'Jamón, piña.', 0, ['salado', 'dulce']],
    ['Peperoni', 'Peperoni.', 0, ['salado']],
    ['Mexicana', 'Carne molida, jalapeños, pico de gallo, tostacos.', 0, ['salado', 'picante']],
    ['Criolla', 'Carne desmechada, chorizo, maíz tierno.', 0, ['salado']],
    ['Pollo BBQ', 'Pollo, trozos de tocineta, salsa BBQ.', 0, ['salado']],
    ['Pollo miel mostaza', 'Pollo, trozos de tocineta, salsa miel mostaza.', 0, ['salado']],
    ['Maíz tocineta', 'Trozos de tocineta, maíz.', 0, ['salado']],
    ['Ciruela tocineta', 'Trozos de tocineta, ciruela pasa.', 0, ['salado', 'dulce']],
    ['Tres quesos', 'Mozzarella, holandés, parmesano, albahaca.', 0, ['salado', 'vegetariano']],
    ['Margarita', 'Tomate, orégano, albahaca.', 0, ['salado', 'vegetariano']],
    ['Vegetariana', 'Champiñones, espinaca, aceitunas, cebolla, tomate.', 0, ['salado', 'vegetariano']],
    ['Tropical', 'Duraznos, piña, cerezas, ciruela pasa.', 0, ['dulce']],
    ['Panzerotti', 'Masa de pizza rellena y doblada sobre sí misma. Rellena con salsa de la casa, queso y tu sabor preferido de nuestra carta de pizzas.', 25000, ['salado']],
    ['Pizza panini Diabola', 'Base de masa crujiente y delgada hecha panini caliente y tostado. Peperoni, salami, queso burrata, albahaca.', 27000, ['salado']],
    ['Pizza panini Chicken', 'Base de masa crujiente y delgada hecha panini caliente y tostado. Filete de pechuga apanado, queso burrata, tomate, aguacate, albahaca.', 27000, ['salado']],
    ['Pizza panini Pistacho', 'Base de masa crujiente y delgada hecha panini caliente y tostado. Jamón ahumado, queso crema, pistacho.', 27000, ['salado']],
  ]],
  ['Pastas', [
    ['Pastas largas', 'Spaguetti, fetuccine o linguini con la salsa que elijas. Todas nuestras pastas vienen acompañadas de porción de pan en mantequilla de ajo.', 27000, ['salado']],
    ['Pastas cortas', 'Fusili o penne rigate con la salsa que elijas. Acompañadas de porción de pan en mantequilla de ajo.', 27000, ['salado']],
    ['Ravioles', 'De carne, pollo o queso ricotta, con la salsa que elijas. Acompañados de porción de pan en mantequilla de ajo.', 36000, ['salado']],
    ['Salsa boloñesa', 'Carne de res, mezcla de vegetales seleccionados y tomates maduros, enriquecida con hierbas aromáticas.', 0, ['salado']],
    ['Salsa bechamel', 'Base de leche y roux, que es una mezcla de harina y mantequilla; especiada con nuez moscada.', 0, ['salado', 'vegetariano']],
    ['Salsa napolitana', 'Elaborada con tomates frescos y maduros, ajo, cebolla y hierbas frescas como albahaca y orégano.', 0, ['salado', 'vegetariano']],
    ['Salsa carbonara', 'Tocineta ahumada, yema de huevo, queso parmesano rallado y pimienta negra molida.', 0, ['salado']],
    ['Salsa pesto', 'Elaborada con albahaca fresca, queso parmesano, piñones, ajo y aceite de oliva.', 0, ['salado', 'vegetariano']],
    ['Salsa puttanesca', 'Sabores mediterráneos elaborada con tomates, aceitunas, alcaparras y ajo.', 0, ['salado', 'vegetariano']],
    ['Salsa Alfredo', 'Mantequilla, crema de leche, queso parmesano rallado y un toque de nuez moscada.', 0, ['salado', 'vegetariano']],
    ['Salsa al burro', 'A base de mantequilla y queso parmesano.', 0, ['salado', 'vegetariano']],
    ['Salsa tres quesos', 'Salsa cremosa a base de queso mozzarella, holandés y parmesano.', 0, ['salado', 'vegetariano']],
    ['Gratinada', 'Gratina tu pasta con queso mozzarella y parmesano.', 6000, ['salado']],
    ['Adición de pollo · 120 gr', null, 10000, ['salado']],
    ['Adición de carne · 120 gr', null, 12000, ['salado']],
    ['Adición de camarones · 120 gr', null, 15000, ['salado']],
    ['Adición de tocineta · 80 gr', null, 8000, ['salado']],
    ['Lasagna mixta', 'Pollo, jamón, champiñones, salsa boloñesa.', 33000, ['salado']],
    ['Lasagna romana', 'Carne molida en salsa boloñesa.', 33000, ['salado']],
    ['Lasagna bechamel', 'Pollo y champiñones en salsa bechamel.', 33000, ['salado']],
    ['Lasagna primavera', 'Zuquinis, brócoli, champiñones en salsa napolitana.', 33000, ['salado', 'vegetariano']],
    ['Canelones de carne', 'Rollos de pasta rellenos de carne en salsa de la casa gratinados.', 36000, ['salado']],
    ['Canelones de pollo', 'Rollos de pasta rellenos de pollo en salsa de la casa gratinados.', 36000, ['salado']],
    ['Canelones de queso ricotta', 'Rollos de pasta rellenos de queso ricotta con espinaca en salsa de la casa gratinados.', 36000, ['salado', 'vegetariano']],
    ['Canelones mixtos', 'Un rollo de cada sabor en salsa de la casa gratinados.', 36000, ['salado']],
    ['Spaghetti con camarones', 'Una exquisita fusión de pasta al dente y camarones frescos, complementados con una salsa aromática a base de tomates, ajo y perejil.', 37000, ['salado']],
    ['Spaghetti marinero', 'Una deliciosa combinación de pasta al dente, mariscos frescos como camarones, mejillones, calamares, almejas y una salsa marinera.', 45000, ['salado'], { agotado: true }],
  ]],
  ['Carnes', [
    ['Albóndigas a la parmesana', 'Albóndigas caseras de carne de res, sazonadas con hierbas frescas y especias, con espagueti al dente, una generosa porción de salsa napolitana y queso parmesano, adornadas con albahaca fresca.', 38000, ['salado'], { destacado: true, modelo: 'pasta' }],
    ['Lomo strogonoff', 'Tiras de lomo de res en cremosa salsa de champiñones y cebolla, servido con fetuccine perfectamente al dente, adornado con perejil fresco.', 44000, ['salado']],
    ['Filet mignon', 'Corte de lomo fino de res envuelto en tocineta, sellado a la perfección. Con salsa demi-glace con champiñones, cremoso puré de papa y vegetales frescos.', 46000, ['salado'], { destacado: true }],
    ['Steak pimienta', 'Solomillo de res sazonado con una mezcla única de pimientas frescas y hierbas aromáticas, bañado en salsa demi-glace. Con cremoso puré de papa y vegetales frescos.', 46000, ['salado', 'picante']],
    ['Ossobuco', 'Ternera jugosa lentamente cocida en un sabroso caldo de vegetales y vino tinto, bañada en salsa napolitana, sobre un espagueti al dente y adornada con perejil fresco.', 46000, ['salado'], { agotado: true }],
  ]],
  ['Pollo', [
    ['Pollo a la toscana', 'Jugosos trozos de pollo cocinados a fuego lento en una salsa cremosa de la casa enriquecida con tomates cherry y espinacas frescas, terminado con una lluvia de queso parmesano. Acompañado de fetuccine al dente.', 42000, ['salado']],
    ['Cordon bleu', 'Filete de pechuga de pollo tierno y jugoso, relleno de jamón y queso mozzarella, rebozado en una salsa cremosa de champiñones y acompañado de una ensalada fresca de la casa.', 42000, ['salado']],
    ['Milanesa de pollo gratinada', 'Jugosa milanesa de pollo empanizada, con salsa de tomate casera y cubierta con queso mozzarella gratinado. Acompañada de una ensalada fresca de la casa.', 42000, ['salado']],
  ]],
  ['Pescado', [
    ['Trucha al ajillo', 'Trucha fresca cocinada en una salsa de ajillo, elaborada con salsa blanca, ajo picado y perejil fresco. Acompañada de una ensalada fresca de la casa.', 42000, ['salado']],
    ['Trucha gratinada en salsa de champiñones', 'Trucha asada cubierta con una salsa blanca preparada con champiñones frescos salteados y gratinada con queso mozzarella. Acompañada de una ensalada fresca de la casa.', 48000, ['salado']],
    ['Trucha gratinada con camarones', 'Trucha asada cubierta con camarones frescos salteados y salsa blanca; gratinada con queso mozzarella. Acompañada de una ensalada fresca de la casa.', 52000, ['salado']],
    ['Salmón en salsa de mantequilla y naranja', 'Salmón cubierto con una salsa de mantequilla derretida, jugo de naranja recién exprimida y especias. Acompañado con un cremoso puré de papa y vegetales frescos.', 50000, ['salado']],
  ]],
  ['Hamburguesas', [
    ['Hamburguesa clásica', '150 gr de jugosa carne de res artesanal de la casa, con crocante tocineta y queso mozzarella, tomate y lechuga fresca, en pan artesanal tipo brioche. Con papas: $27.000.', 25000, ['salado'], { destacado: true, modelo: 'hamburguesa' }],
    ['Hamburguesa crispi', 'Jugoso filete de pechuga de pollo sazonado con hierbas y especias, con un apanado crujiente, queso mozzarella, tocineta, pepinillos frescos y pan tipo brioche. Con papas: $30.000.', 28000, ['salado']],
    ['Hamburguesa criolla', '150 gr de carne de res artesanal con el tradicional chorizo santarrosano, tocineta crujiente, huevo frito y queso mozzarella; tomate y lechuga fresca en pan brioche. Con papas: $30.000.', 28000, ['salado']],
    ['Hamburguesa gaucha', '150 gr de jugosa carne de res artesanal, con un exquisito chorizo argentino, crocantes tiras de tocineta y queso mozzarella, en pan artesanal tipo brioche y chimichurri fresco. Con papas: $30.000.', 28000, ['salado']],
    ['Papa francesa', null, 6000, ['salado']],
    ['Carne de hamburguesa', null, 14000, ['salado']],
    ['Pan en mantequilla de ajo', null, 4000, ['salado']],
    ['Tocineta', null, 6000, ['salado']],
    ['Pepinillos', null, 4000, ['salado']],
    ['Queso parmesano', null, 6000, ['salado']],
  ]],
  ['Menú infantil', [
    ['Cajita feliz', 'Strips de pollo de la casa acompañados con papitas fritas, jugo de cajita y divertida sorpresa.', 27000, ['salado']],
    ['Fuertecito', 'Tacita de consomé de pollo con cabello de ángel, porción de spaguetti con albóndigas, limonada natural y divertida sorpresa.', 29000, ['salado']],
  ]],
  ['Bebidas', [
    ['Jugos naturales en agua', null, 7500, ['bebida']],
    ['Jugos naturales en leche', null, 9000, ['bebida']],
    ['Limonada natural', null, 6500, ['bebida']],
    ['Limonada de hierbabuena', null, 9000, ['bebida']],
    ['Limonada cerezada', null, 9000, ['bebida', 'dulce']],
    ['Limonada de coco', null, 10500, ['bebida', 'dulce']],
    ['Soda de frutos rojos', 'Fresa, mora, arándanos.', 12500, ['bebida']],
    ['Soda de maracuyá', 'Maracuyá, hierbabuena.', 12500, ['bebida']],
    ['Soda de lulo', 'Lulo y limón mandarino.', 12500, ['bebida']],
    ['Gaseosa 400 ml', null, 5500, ['bebida']],
    ['Gaseosa 1.5 lt', null, 10500, ['bebida']],
    ['Bretaña 300 ml', null, 6000, ['bebida']],
    ['Té Hatsu 400 ml', null, 7500, ['bebida']],
    ['Botella de agua', null, 4500, ['bebida']],
  ]],
  ['Cervezas, vinos y cócteles', [
    ['Club Colombia', null, 8500, ['bebida']],
    ['Coronita', null, 8500, ['bebida']],
    ['Heineken', null, 10000, ['bebida']],
    ['Tres Cordilleras', null, 10000, ['bebida']],
    ['Corona', null, 10500, ['bebida']],
    ['Copa de vino caliente', null, 25000, ['bebida']],
    ['Tinto de verano', null, 25000, ['bebida']],
    ['Quinta Cabras', 'Botella de vino.', 60000, ['bebida']],
    ['Fronteras', 'Botella de vino.', 90000, ['bebida']],
    ['Lazo Undurraga', 'Botella de vino.', 90000, ['bebida']],
    ['Gato Negro', 'Botella de vino.', 90000, ['bebida']],
    ['Casillero del Diablo', 'Botella de vino.', 130000, ['bebida']],
    ['Mojito', 'Ron blanco, limón, hierbabuena.', 22000, ['bebida']],
    ['Tequila sunrise', 'Tequila, jugo de naranja, granadina.', 22000, ['bebida']],
    ['Laguna azul', 'Vodka, curaçao azul, zumo de limón.', 22000, ['bebida']],
    ['Margarita (cóctel)', 'Tequila, triple sec, zumo de limón.', 28000, ['bebida']],
    ['El Padrino', 'Whisky, licor amaretto.', 28000, ['bebida']],
    ['Long Island', 'Vodka, tequila, triple sec, ron blanco, ginebra, zumo de limón.', 30000, ['bebida']],
    ['Guarapito de piña', 'Cóctel de autor.', 22000, ['bebida', 'dulce']],
    ['Gin tonic frutos rojos', 'Ginebra, agua tónica, frutos rojos.', 22000, ['bebida']],
  ]],
];

// Premios del club (valor en pesos; las monedas salen de la regla del club). Solo platos de su carta.
const PREMIOS = [['Limonada natural', 6500], ['Porción de pizza', 10300], ['Soda de frutos rojos', 12500], ['Empanadas de queso', 16000],
  ['Pizza personal', 21000], ['Copa de vino caliente', 25000], ['Pasta larga a tu gusto', 27000]];

// Clientes de EJEMPLO (nombres genéricos, teléfonos falsos 573000002xxx): [nombre, visitas, días desde la última, cada cuántos días venía]
const CLIENTES = [['Andrea M.', 9, 34, 7], ['Carlos R.', 6, 27, 6], ['Paola G.', 12, 41, 5], ['Julián T.', 5, 23, 8], ['Diana L.', 7, 30, 9],
  ['Felipe O.', 8, 2, 4], ['Mónica S.', 4, 5, 7], ['Andrés C.', 10, 1, 3], ['Laura P.', 3, 9, 10]];

const MODELOS = { hamburguesa: ['/assets/demo/3d/solo3d/hamburguesa.glb', '/assets/demo/hamburguesa.webp'],
  pizza: ['/assets/demo/3d/solo3d/pizza.glb', '/assets/demo/pizza.webp'], pasta: ['/assets/demo/3d/solo3d/pasta.glb', '/assets/demo/pasta.webp'] };
const existe = (ruta) => fs.existsSync('public' + ruta);

let sql = `-- =====================================================================
--  DEMO para Los Fuertes Pizzas y Pastas (prospecto; reunión del 30/11/2026). Datos de ejemplo, NO es un cliente.
--  Generado por scripts/demo_los_fuertes.mjs (no editar a mano). Idempotente: ids fijos, solo toca este negocio.
--  Se corre después de esquema.sql y demo.sql. /n/demo-los-fuertes · caja /caja/demo-los-fuertes (PIN 1234).
-- =====================================================================
insert into public.empresas (id, nombre, plan) values (${q(E)}, 'Los Fuertes (demo)', 'demo') on conflict (id) do nothing;

insert into public.negocios (id, empresa_id, slug, nombre, descripcion, color, sector, servicios, ubicacion_etiqueta,
  resena_url, whatsapp, instagram, moneda_plural, moneda_singular, bienvenida, monedas_por_visita, tema, links)
values (${q(N)}, ${q(E)}, 'demo-los-fuertes', 'Los Fuertes',
  'Demo preparado para Los Fuertes', '#758074', 'cafe', '{"base":true,"catalogo":true,"club":true,"estudio":false}',
  'Pizzas y pastas',
  -- VARIABLE: link real de reseñas de Google de Los Fuertes (pendiente; este es de ejemplo)
  'https://www.google.com/maps/search/?api=1&query=Los+Fuertes+Pizzas+y+Pastas+Bogot%C3%A1',
  '3108728707', null, 'monedas', 'moneda', 50, 10, 'trattoria',
  '[{"titulo":"Cómo llegar · Cra 92 #157-65","url":"https://www.google.com/maps/search/?api=1&query=Cra+92+%23157-65+Bogot%C3%A1"}]'::jsonb)
on conflict (id) do update set empresa_id = excluded.empresa_id, slug = excluded.slug, nombre = excluded.nombre, descripcion = excluded.descripcion, color = excluded.color,
  servicios = excluded.servicios, ubicacion_etiqueta = excluded.ubicacion_etiqueta, resena_url = excluded.resena_url,
  whatsapp = excluded.whatsapp, tema = excluded.tema, links = excluded.links, activo = true;

update public.negocios set pin_caja_hash = extensions.crypt('1234', extensions.gen_salt('bf')) where id = ${q(N)} and pin_caja_hash is null;

insert into public.tags (id, codigo, negocio_id, nombre) values
  (${q(id('f6', 1))}, 'demofuertes', ${q(N)}, 'Mesa 5'),
  (${q(id('f6', 2))}, 'demofuertescarta', ${q(N)}, 'Mesa 2')
on conflict (id) do nothing;
update public.tags set destino = 'menu' where id = ${q(id('f6', 2))};

`;
let c = 0, p = 0;
sql += 'insert into public.categorias (id, negocio_id, nombre, orden) values\n' +
  CARTA.map(([nom], i) => `  (${q(id('f2', i + 1))}, ${q(N)}, ${q(nom)}, ${i + 1})`).join(',\n') +
  '\non conflict (id) do update set nombre = excluded.nombre, orden = excluded.orden;\n\n';
const filas = [];
for (const [, platos] of CARTA) {
  c++;
  platos.forEach(([nom, desc, precio, etq, extra = {}], i) => {
    p++;
    const [modelo, foto] = extra.modelo && existe(MODELOS[extra.modelo][0]) ? MODELOS[extra.modelo] : [null, null];
    filas.push(`  (${q(id('f1', p))}, ${q(N)}, ${q(id('f2', c))}, 'plato', ${q(nom)}, ${q(desc)}, ${precio}, '{${etq.join(',')}}', ${!!extra.destacado}, ${!!extra.agotado}, ${i + 1}, ${q(modelo)}, ${q(foto && existe(foto) ? foto : null)})`);
  });
}
sql += 'insert into public.productos (id, negocio_id, categoria_id, tipo, nombre, descripcion, precio, etiquetas, destacado, agotado, orden, modelo_url, foto_url) values\n' +
  filas.join(',\n') + '\non conflict (id) do update set categoria_id = excluded.categoria_id, nombre = excluded.nombre, descripcion = excluded.descripcion,\n' +
  '  precio = excluded.precio, etiquetas = excluded.etiquetas, destacado = excluded.destacado, orden = excluded.orden,\n  modelo_url = excluded.modelo_url, foto_url = excluded.foto_url;\n' +
  `-- Los 2 agotados de ejemplo se marcan solo al crearlos (luego el panel manda)\n\n`;

sql += 'insert into public.premios (id, negocio_id, nombre, valor_pesos, orden) values\n' +
  PREMIOS.map(([nom, v], i) => `  (${q(id('f3', i + 1))}, ${q(N)}, ${q(nom)}, ${v}, ${i + 1})`).join(',\n') + '\non conflict (id) do nothing;\n\n';

sql += `-- Clientes de EJEMPLO (inventados) con sus visitas: unos vienen seguido y otros dejaron de venir ("En riesgo" del panel)\n`;
CLIENTES.forEach(([nom, visitas, dias, cada], i) => {
  const cli = id('f4', i + 1), mem = id('f5', i + 1), tel = '573000002' + String(i + 1).padStart(3, '0');
  sql += `insert into public.clientes (id, telefono, nombre) values (${q(cli)}, '${tel}', ${q(nom)}) on conflict (id) do nothing;
insert into public.membresias (id, cliente_id, negocio_id, token, saldo, total_ganado, visitas, acepto_datos_at, ultima_visita, vence)
values (${q(mem)}, ${q(cli)}, ${q(N)}, md5('fuertes-${i + 1}'), ${50 + visitas * 10}, ${50 + visitas * 10}, ${visitas}, now() - interval '${dias + visitas * cada} days',
  now() - interval '${dias} days', now() + interval '12 months') on conflict (id) do nothing;
insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, op_id, creado)
select ${q(mem)}, ${q(N)}, 'visita', 10, md5('fuertes-${i + 1}-' || k)::uuid, now() - make_interval(days => ${dias} + k * ${cada}, hours => 19 - k % 6)
from generate_series(0, ${visitas - 1}) k on conflict (op_id) do nothing;
`;
});
fs.writeFileSync('supabase/demo-los-fuertes.sql', sql);
console.log('ok', p, 'platos en', c, 'categorías');
