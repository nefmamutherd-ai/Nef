-- =====================================================================
--  DEMO para Los Fuertes Pizzas y Pastas (prospecto; reunión del 30/11/2026). Datos de ejemplo, NO es un cliente.
--  Generado por scripts/demo_los_fuertes.mjs (no editar a mano). Idempotente: ids fijos, solo toca este negocio.
--  Se corre después de esquema.sql y demo.sql. /n/demo-los-fuertes · caja /caja/demo-los-fuertes (PIN 1234).
-- =====================================================================
insert into public.negocios (id, empresa_id, slug, nombre, descripcion, color, sector, servicios, ubicacion_etiqueta,
  resena_url, whatsapp, instagram, moneda_plural, moneda_singular, bienvenida, monedas_por_visita, tema, links)
values ('d0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-000000000001', 'demo-los-fuertes', 'Los Fuertes',
  'Demo preparado para Los Fuertes', '#758074', 'cafe', '{"base":true,"catalogo":true,"club":true,"estudio":false}',
  'Pizzas y pastas',
  -- VARIABLE: link real de reseñas de Google de Los Fuertes (pendiente; este es de ejemplo)
  'https://www.google.com/maps/search/?api=1&query=Los+Fuertes+Pizzas+y+Pastas+Bogot%C3%A1',
  '3108728707', null, 'monedas', 'moneda', 50, 10, 'trattoria',
  '[{"titulo":"Cómo llegar · Cra 92 #157-65","url":"https://www.google.com/maps/search/?api=1&query=Cra+92+%23157-65+Bogot%C3%A1"}]'::jsonb)
on conflict (id) do update set slug = excluded.slug, nombre = excluded.nombre, descripcion = excluded.descripcion, color = excluded.color,
  servicios = excluded.servicios, ubicacion_etiqueta = excluded.ubicacion_etiqueta, resena_url = excluded.resena_url,
  whatsapp = excluded.whatsapp, tema = excluded.tema, links = excluded.links, activo = true;

update public.negocios set pin_caja_hash = extensions.crypt('1234', extensions.gen_salt('bf')) where id = 'd0000000-0000-4000-8000-0000000000f1' and pin_caja_hash is null;

insert into public.tags (id, codigo, negocio_id, nombre) values
  ('d0000000-0000-4000-8000-00000f600001', 'demofuertes', 'd0000000-0000-4000-8000-0000000000f1', 'Mesa 5'),
  ('d0000000-0000-4000-8000-00000f600002', 'demofuertescarta', 'd0000000-0000-4000-8000-0000000000f1', 'Mesa 2')
on conflict (id) do nothing;
update public.tags set destino = 'menu' where id = 'd0000000-0000-4000-8000-00000f600002';

insert into public.categorias (id, negocio_id, nombre, orden) values
  ('d0000000-0000-4000-8000-00000f200001', 'd0000000-0000-4000-8000-0000000000f1', 'Entradas', 1),
  ('d0000000-0000-4000-8000-00000f200002', 'd0000000-0000-4000-8000-0000000000f1', 'Cremas y ensaladas', 2),
  ('d0000000-0000-4000-8000-00000f200003', 'd0000000-0000-4000-8000-0000000000f1', 'Pizzas', 3),
  ('d0000000-0000-4000-8000-00000f200004', 'd0000000-0000-4000-8000-0000000000f1', 'Pastas', 4),
  ('d0000000-0000-4000-8000-00000f200005', 'd0000000-0000-4000-8000-0000000000f1', 'Carnes', 5),
  ('d0000000-0000-4000-8000-00000f200006', 'd0000000-0000-4000-8000-0000000000f1', 'Pollo', 6),
  ('d0000000-0000-4000-8000-00000f200007', 'd0000000-0000-4000-8000-0000000000f1', 'Pescado', 7),
  ('d0000000-0000-4000-8000-00000f200008', 'd0000000-0000-4000-8000-0000000000f1', 'Hamburguesas', 8),
  ('d0000000-0000-4000-8000-00000f200009', 'd0000000-0000-4000-8000-0000000000f1', 'Menú infantil', 9),
  ('d0000000-0000-4000-8000-00000f200010', 'd0000000-0000-4000-8000-0000000000f1', 'Bebidas', 10),
  ('d0000000-0000-4000-8000-00000f200011', 'd0000000-0000-4000-8000-0000000000f1', 'Cervezas, vinos y cócteles', 11)
on conflict (id) do update set nombre = excluded.nombre, orden = excluded.orden;

insert into public.productos (id, negocio_id, categoria_id, tipo, nombre, descripcion, precio, etiquetas, destacado, agotado, orden, modelo_url, foto_url) values
  ('d0000000-0000-4000-8000-00000f100001', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200001', 'plato', 'Empanadas de queso', '5 deliciosas empanaditas rellenas de queso mozzarella, envueltas en una masa crujiente y dorada.', 16000, '{salado,vegetariano}', false, false, 1, null, null),
  ('d0000000-0000-4000-8000-00000f100002', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200001', 'plato', 'Bruschettas', '5 rebanadas de pan rústico untadas con aceite de oliva, tomates cherry confitados, albahaca fresca y queso burrata, todo finalmente bañado en vinagre balsámico.', 22000, '{salado,vegetariano}', false, false, 2, null, null),
  ('d0000000-0000-4000-8000-00000f100003', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200001', 'plato', 'Chicharrones', '160 gr de trozos de cerdo crocantes y dorados, acompañados de una salsa chimichurri y una porción de papas criollas doradas.', 24000, '{salado}', false, false, 3, null, null),
  ('d0000000-0000-4000-8000-00000f100004', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200001', 'plato', 'Albóndigas de chorizo', '3 deliciosas albóndigas elaboradas con chorizo, sazonadas con hierbas mediterráneas y especias aromáticas. Rellenas de queso mozzarella y envueltas en una fina capa de tocineta.', 24000, '{salado}', false, false, 4, null, null),
  ('d0000000-0000-4000-8000-00000f100005', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200001', 'plato', 'Camarones apanados', '140 gr de camarones frescos, empanizados con una mezcla de pan rallado sazonado en especias seleccionadas. Acompañados de una salsa de pimentón casera.', 25000, '{salado}', false, false, 5, null, null),
  ('d0000000-0000-4000-8000-00000f100006', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200002', 'plato', 'Consomé de pollo', 'Un caldo claro y reconfortante elaborado a partir de pollo y verduras seleccionadas, con fideos finos, y adornado con un toque de cilantro.', 10000, '{salado}', false, false, 1, null, null),
  ('d0000000-0000-4000-8000-00000f100007', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200002', 'plato', 'Cremas naturales', 'Pollo, cebolla o tomate. Cremas suaves, elaboradas con una variedad de verduras frescas, cocidas y luego procesadas hasta obtener una textura cremosa. Acompañadas con pan tostado en mantequilla de ajo.', 17000, '{salado}', false, false, 2, null, null),
  ('d0000000-0000-4000-8000-00000f100008', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200002', 'plato', 'Ensalada griega', 'Una mezcla que evoca los sabores mediterráneos. Rodajas de pepino crujiente, tomates cherry, aceitunas, alcaparras, mix de lechuga, trozos de queso mozzarella y aderezo de aceite de oliva y pimienta negra.', 22000, '{salado,vegetariano}', false, false, 3, null, null),
  ('d0000000-0000-4000-8000-00000f100009', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200002', 'plato', 'Ensalada verde', 'Una combinación ligera de hojas de lechuga variadas, crujientes pepinos, trozos de mango y aguacate. Complementada con tomates cherry y queso mozzarella.', 22000, '{salado,vegetariano}', false, false, 4, null, null),
  ('d0000000-0000-4000-8000-00000f100010', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200002', 'plato', 'Ensalada César', 'Una ensalada clásica que combina tiras de pechuga asada con hojas de lechuga romana fresca, crotones de pan tostado y queso parmesano rallado. Aderezada con una deliciosa vinagreta y pimienta negra.', 27000, '{salado}', false, false, 5, null, null),
  ('d0000000-0000-4000-8000-00000f100011', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200002', 'plato', 'Ensalada caprese', 'Una ensalada que celebra los sabores clásicos de Italia. Rodajas de tomate maduro, intercaladas con rebanadas de queso mozzarella fresco y aceitunas negras. Aderezada con hojas de albahaca y aceite de oliva extra virgen.', 27000, '{salado,vegetariano}', false, false, 6, null, null),
  ('d0000000-0000-4000-8000-00000f100012', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Pizza familiar · 50 cm', 'Con tu sabor preferido de nuestra carta de pizzas.', 76000, '{salado}', true, false, 1, '/assets/demo/3d/solo3d/pizza.glb', '/assets/demo/pizza.webp'),
  ('d0000000-0000-4000-8000-00000f100013', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Pizza mediana · 35 cm', 'Con tu sabor preferido de nuestra carta de pizzas.', 58000, '{salado}', false, false, 2, null, null),
  ('d0000000-0000-4000-8000-00000f100014', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Pizza small · 30 cm', 'Con tu sabor preferido de nuestra carta de pizzas.', 42000, '{salado}', false, false, 3, null, null),
  ('d0000000-0000-4000-8000-00000f100015', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Pizza personal · 22 cm', 'Con tu sabor preferido de nuestra carta de pizzas.', 21000, '{salado}', false, false, 4, null, null),
  ('d0000000-0000-4000-8000-00000f100016', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Porción de pizza', 'Pollo champiñón, hawaiana, peperoni, mexicana o criolla.', 10300, '{salado}', false, false, 5, null, null),
  ('d0000000-0000-4000-8000-00000f100017', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Pollo champiñón', 'Jamón, pollo, champiñones.', 0, '{salado}', false, false, 6, null, null),
  ('d0000000-0000-4000-8000-00000f100018', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Hawaiana', 'Jamón, piña.', 0, '{salado,dulce}', false, false, 7, null, null),
  ('d0000000-0000-4000-8000-00000f100019', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Peperoni', 'Peperoni.', 0, '{salado}', false, false, 8, null, null),
  ('d0000000-0000-4000-8000-00000f100020', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Mexicana', 'Carne molida, jalapeños, pico de gallo, tostacos.', 0, '{salado,picante}', false, false, 9, null, null),
  ('d0000000-0000-4000-8000-00000f100021', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Criolla', 'Carne desmechada, chorizo, maíz tierno.', 0, '{salado}', false, false, 10, null, null),
  ('d0000000-0000-4000-8000-00000f100022', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Pollo BBQ', 'Pollo, trozos de tocineta, salsa BBQ.', 0, '{salado}', false, false, 11, null, null),
  ('d0000000-0000-4000-8000-00000f100023', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Pollo miel mostaza', 'Pollo, trozos de tocineta, salsa miel mostaza.', 0, '{salado}', false, false, 12, null, null),
  ('d0000000-0000-4000-8000-00000f100024', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Maíz tocineta', 'Trozos de tocineta, maíz.', 0, '{salado}', false, false, 13, null, null),
  ('d0000000-0000-4000-8000-00000f100025', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Ciruela tocineta', 'Trozos de tocineta, ciruela pasa.', 0, '{salado,dulce}', false, false, 14, null, null),
  ('d0000000-0000-4000-8000-00000f100026', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Tres quesos', 'Mozzarella, holandés, parmesano, albahaca.', 0, '{salado,vegetariano}', false, false, 15, null, null),
  ('d0000000-0000-4000-8000-00000f100027', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Margarita', 'Tomate, orégano, albahaca.', 0, '{salado,vegetariano}', false, false, 16, null, null),
  ('d0000000-0000-4000-8000-00000f100028', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Vegetariana', 'Champiñones, espinaca, aceitunas, cebolla, tomate.', 0, '{salado,vegetariano}', false, false, 17, null, null),
  ('d0000000-0000-4000-8000-00000f100029', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Tropical', 'Duraznos, piña, cerezas, ciruela pasa.', 0, '{dulce}', false, false, 18, null, null),
  ('d0000000-0000-4000-8000-00000f100030', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Panzerotti', 'Masa de pizza rellena y doblada sobre sí misma. Rellena con salsa de la casa, queso y tu sabor preferido de nuestra carta de pizzas.', 25000, '{salado}', false, false, 19, null, null),
  ('d0000000-0000-4000-8000-00000f100031', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Pizza panini Diabola', 'Base de masa crujiente y delgada hecha panini caliente y tostado. Peperoni, salami, queso burrata, albahaca.', 27000, '{salado}', false, false, 20, null, null),
  ('d0000000-0000-4000-8000-00000f100032', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Pizza panini Chicken', 'Base de masa crujiente y delgada hecha panini caliente y tostado. Filete de pechuga apanado, queso burrata, tomate, aguacate, albahaca.', 27000, '{salado}', false, false, 21, null, null),
  ('d0000000-0000-4000-8000-00000f100033', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200003', 'plato', 'Pizza panini Pistacho', 'Base de masa crujiente y delgada hecha panini caliente y tostado. Jamón ahumado, queso crema, pistacho.', 27000, '{salado}', false, false, 22, null, null),
  ('d0000000-0000-4000-8000-00000f100034', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Pastas largas', 'Spaguetti, fetuccine o linguini con la salsa que elijas. Todas nuestras pastas vienen acompañadas de porción de pan en mantequilla de ajo.', 27000, '{salado}', false, false, 1, null, null),
  ('d0000000-0000-4000-8000-00000f100035', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Pastas cortas', 'Fusili o penne rigate con la salsa que elijas. Acompañadas de porción de pan en mantequilla de ajo.', 27000, '{salado}', false, false, 2, null, null),
  ('d0000000-0000-4000-8000-00000f100036', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Ravioles', 'De carne, pollo o queso ricotta, con la salsa que elijas. Acompañados de porción de pan en mantequilla de ajo.', 36000, '{salado}', false, false, 3, null, null),
  ('d0000000-0000-4000-8000-00000f100037', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Salsa boloñesa', 'Carne de res, mezcla de vegetales seleccionados y tomates maduros, enriquecida con hierbas aromáticas.', 0, '{salado}', false, false, 4, null, null),
  ('d0000000-0000-4000-8000-00000f100038', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Salsa bechamel', 'Base de leche y roux, que es una mezcla de harina y mantequilla; especiada con nuez moscada.', 0, '{salado,vegetariano}', false, false, 5, null, null),
  ('d0000000-0000-4000-8000-00000f100039', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Salsa napolitana', 'Elaborada con tomates frescos y maduros, ajo, cebolla y hierbas frescas como albahaca y orégano.', 0, '{salado,vegetariano}', false, false, 6, null, null),
  ('d0000000-0000-4000-8000-00000f100040', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Salsa carbonara', 'Tocineta ahumada, yema de huevo, queso parmesano rallado y pimienta negra molida.', 0, '{salado}', false, false, 7, null, null),
  ('d0000000-0000-4000-8000-00000f100041', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Salsa pesto', 'Elaborada con albahaca fresca, queso parmesano, piñones, ajo y aceite de oliva.', 0, '{salado,vegetariano}', false, false, 8, null, null),
  ('d0000000-0000-4000-8000-00000f100042', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Salsa puttanesca', 'Sabores mediterráneos elaborada con tomates, aceitunas, alcaparras y ajo.', 0, '{salado,vegetariano}', false, false, 9, null, null),
  ('d0000000-0000-4000-8000-00000f100043', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Salsa Alfredo', 'Mantequilla, crema de leche, queso parmesano rallado y un toque de nuez moscada.', 0, '{salado,vegetariano}', false, false, 10, null, null),
  ('d0000000-0000-4000-8000-00000f100044', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Salsa al burro', 'A base de mantequilla y queso parmesano.', 0, '{salado,vegetariano}', false, false, 11, null, null),
  ('d0000000-0000-4000-8000-00000f100045', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Salsa tres quesos', 'Salsa cremosa a base de queso mozzarella, holandés y parmesano.', 0, '{salado,vegetariano}', false, false, 12, null, null),
  ('d0000000-0000-4000-8000-00000f100046', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Gratinada', 'Gratina tu pasta con queso mozzarella y parmesano.', 6000, '{salado}', false, false, 13, null, null),
  ('d0000000-0000-4000-8000-00000f100047', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Adición de pollo · 120 gr', null, 10000, '{salado}', false, false, 14, null, null),
  ('d0000000-0000-4000-8000-00000f100048', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Adición de carne · 120 gr', null, 12000, '{salado}', false, false, 15, null, null),
  ('d0000000-0000-4000-8000-00000f100049', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Adición de camarones · 120 gr', null, 15000, '{salado}', false, false, 16, null, null),
  ('d0000000-0000-4000-8000-00000f100050', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Adición de tocineta · 80 gr', null, 8000, '{salado}', false, false, 17, null, null),
  ('d0000000-0000-4000-8000-00000f100051', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Lasagna mixta', 'Pollo, jamón, champiñones, salsa boloñesa.', 33000, '{salado}', false, false, 18, null, null),
  ('d0000000-0000-4000-8000-00000f100052', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Lasagna romana', 'Carne molida en salsa boloñesa.', 33000, '{salado}', false, false, 19, null, null),
  ('d0000000-0000-4000-8000-00000f100053', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Lasagna bechamel', 'Pollo y champiñones en salsa bechamel.', 33000, '{salado}', false, false, 20, null, null),
  ('d0000000-0000-4000-8000-00000f100054', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Lasagna primavera', 'Zuquinis, brócoli, champiñones en salsa napolitana.', 33000, '{salado,vegetariano}', false, false, 21, null, null),
  ('d0000000-0000-4000-8000-00000f100055', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Canelones de carne', 'Rollos de pasta rellenos de carne en salsa de la casa gratinados.', 36000, '{salado}', false, false, 22, null, null),
  ('d0000000-0000-4000-8000-00000f100056', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Canelones de pollo', 'Rollos de pasta rellenos de pollo en salsa de la casa gratinados.', 36000, '{salado}', false, false, 23, null, null),
  ('d0000000-0000-4000-8000-00000f100057', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Canelones de queso ricotta', 'Rollos de pasta rellenos de queso ricotta con espinaca en salsa de la casa gratinados.', 36000, '{salado,vegetariano}', false, false, 24, null, null),
  ('d0000000-0000-4000-8000-00000f100058', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Canelones mixtos', 'Un rollo de cada sabor en salsa de la casa gratinados.', 36000, '{salado}', false, false, 25, null, null),
  ('d0000000-0000-4000-8000-00000f100059', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Spaghetti con camarones', 'Una exquisita fusión de pasta al dente y camarones frescos, complementados con una salsa aromática a base de tomates, ajo y perejil.', 37000, '{salado}', false, false, 26, null, null),
  ('d0000000-0000-4000-8000-00000f100060', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200004', 'plato', 'Spaghetti marinero', 'Una deliciosa combinación de pasta al dente, mariscos frescos como camarones, mejillones, calamares, almejas y una salsa marinera.', 45000, '{salado}', false, true, 27, null, null),
  ('d0000000-0000-4000-8000-00000f100061', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200005', 'plato', 'Albóndigas a la parmesana', 'Albóndigas caseras de carne de res, sazonadas con hierbas frescas y especias, con espagueti al dente, una generosa porción de salsa napolitana y queso parmesano, adornadas con albahaca fresca.', 38000, '{salado}', true, false, 1, '/assets/demo/3d/solo3d/pasta.glb', '/assets/demo/pasta.webp'),
  ('d0000000-0000-4000-8000-00000f100062', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200005', 'plato', 'Lomo strogonoff', 'Tiras de lomo de res en cremosa salsa de champiñones y cebolla, servido con fetuccine perfectamente al dente, adornado con perejil fresco.', 44000, '{salado}', false, false, 2, null, null),
  ('d0000000-0000-4000-8000-00000f100063', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200005', 'plato', 'Filet mignon', 'Corte de lomo fino de res envuelto en tocineta, sellado a la perfección. Con salsa demi-glace con champiñones, cremoso puré de papa y vegetales frescos.', 46000, '{salado}', true, false, 3, null, null),
  ('d0000000-0000-4000-8000-00000f100064', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200005', 'plato', 'Steak pimienta', 'Solomillo de res sazonado con una mezcla única de pimientas frescas y hierbas aromáticas, bañado en salsa demi-glace. Con cremoso puré de papa y vegetales frescos.', 46000, '{salado,picante}', false, false, 4, null, null),
  ('d0000000-0000-4000-8000-00000f100065', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200005', 'plato', 'Ossobuco', 'Ternera jugosa lentamente cocida en un sabroso caldo de vegetales y vino tinto, bañada en salsa napolitana, sobre un espagueti al dente y adornada con perejil fresco.', 46000, '{salado}', false, true, 5, null, null),
  ('d0000000-0000-4000-8000-00000f100066', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200006', 'plato', 'Pollo a la toscana', 'Jugosos trozos de pollo cocinados a fuego lento en una salsa cremosa de la casa enriquecida con tomates cherry y espinacas frescas, terminado con una lluvia de queso parmesano. Acompañado de fetuccine al dente.', 42000, '{salado}', false, false, 1, null, null),
  ('d0000000-0000-4000-8000-00000f100067', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200006', 'plato', 'Cordon bleu', 'Filete de pechuga de pollo tierno y jugoso, relleno de jamón y queso mozzarella, rebozado en una salsa cremosa de champiñones y acompañado de una ensalada fresca de la casa.', 42000, '{salado}', false, false, 2, null, null),
  ('d0000000-0000-4000-8000-00000f100068', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200006', 'plato', 'Milanesa de pollo gratinada', 'Jugosa milanesa de pollo empanizada, con salsa de tomate casera y cubierta con queso mozzarella gratinado. Acompañada de una ensalada fresca de la casa.', 42000, '{salado}', false, false, 3, null, null),
  ('d0000000-0000-4000-8000-00000f100069', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200007', 'plato', 'Trucha al ajillo', 'Trucha fresca cocinada en una salsa de ajillo, elaborada con salsa blanca, ajo picado y perejil fresco. Acompañada de una ensalada fresca de la casa.', 42000, '{salado}', false, false, 1, null, null),
  ('d0000000-0000-4000-8000-00000f100070', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200007', 'plato', 'Trucha gratinada en salsa de champiñones', 'Trucha asada cubierta con una salsa blanca preparada con champiñones frescos salteados y gratinada con queso mozzarella. Acompañada de una ensalada fresca de la casa.', 48000, '{salado}', false, false, 2, null, null),
  ('d0000000-0000-4000-8000-00000f100071', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200007', 'plato', 'Trucha gratinada con camarones', 'Trucha asada cubierta con camarones frescos salteados y salsa blanca; gratinada con queso mozzarella. Acompañada de una ensalada fresca de la casa.', 52000, '{salado}', false, false, 3, null, null),
  ('d0000000-0000-4000-8000-00000f100072', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200007', 'plato', 'Salmón en salsa de mantequilla y naranja', 'Salmón cubierto con una salsa de mantequilla derretida, jugo de naranja recién exprimida y especias. Acompañado con un cremoso puré de papa y vegetales frescos.', 50000, '{salado}', false, false, 4, null, null),
  ('d0000000-0000-4000-8000-00000f100073', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200008', 'plato', 'Hamburguesa clásica', '150 gr de jugosa carne de res artesanal de la casa, con crocante tocineta y queso mozzarella, tomate y lechuga fresca, en pan artesanal tipo brioche. Con papas: $27.000.', 25000, '{salado}', true, false, 1, '/assets/demo/3d/solo3d/hamburguesa.glb', '/assets/demo/hamburguesa.webp'),
  ('d0000000-0000-4000-8000-00000f100074', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200008', 'plato', 'Hamburguesa crispi', 'Jugoso filete de pechuga de pollo sazonado con hierbas y especias, con un apanado crujiente, queso mozzarella, tocineta, pepinillos frescos y pan tipo brioche. Con papas: $30.000.', 28000, '{salado}', false, false, 2, null, null),
  ('d0000000-0000-4000-8000-00000f100075', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200008', 'plato', 'Hamburguesa criolla', '150 gr de carne de res artesanal con el tradicional chorizo santarrosano, tocineta crujiente, huevo frito y queso mozzarella; tomate y lechuga fresca en pan brioche. Con papas: $30.000.', 28000, '{salado}', false, false, 3, null, null),
  ('d0000000-0000-4000-8000-00000f100076', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200008', 'plato', 'Hamburguesa gaucha', '150 gr de jugosa carne de res artesanal, con un exquisito chorizo argentino, crocantes tiras de tocineta y queso mozzarella, en pan artesanal tipo brioche y chimichurri fresco. Con papas: $30.000.', 28000, '{salado}', false, false, 4, null, null),
  ('d0000000-0000-4000-8000-00000f100077', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200008', 'plato', 'Papa francesa', null, 6000, '{salado}', false, false, 5, null, null),
  ('d0000000-0000-4000-8000-00000f100078', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200008', 'plato', 'Carne de hamburguesa', null, 14000, '{salado}', false, false, 6, null, null),
  ('d0000000-0000-4000-8000-00000f100079', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200008', 'plato', 'Pan en mantequilla de ajo', null, 4000, '{salado}', false, false, 7, null, null),
  ('d0000000-0000-4000-8000-00000f100080', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200008', 'plato', 'Tocineta', null, 6000, '{salado}', false, false, 8, null, null),
  ('d0000000-0000-4000-8000-00000f100081', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200008', 'plato', 'Pepinillos', null, 4000, '{salado}', false, false, 9, null, null),
  ('d0000000-0000-4000-8000-00000f100082', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200008', 'plato', 'Queso parmesano', null, 6000, '{salado}', false, false, 10, null, null),
  ('d0000000-0000-4000-8000-00000f100083', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200009', 'plato', 'Cajita feliz', 'Strips de pollo de la casa acompañados con papitas fritas, jugo de cajita y divertida sorpresa.', 27000, '{salado}', false, false, 1, null, null),
  ('d0000000-0000-4000-8000-00000f100084', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200009', 'plato', 'Fuertecito', 'Tacita de consomé de pollo con cabello de ángel, porción de spaguetti con albóndigas, limonada natural y divertida sorpresa.', 29000, '{salado}', false, false, 2, null, null),
  ('d0000000-0000-4000-8000-00000f100085', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Jugos naturales en agua', null, 7500, '{bebida}', false, false, 1, null, null),
  ('d0000000-0000-4000-8000-00000f100086', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Jugos naturales en leche', null, 9000, '{bebida}', false, false, 2, null, null),
  ('d0000000-0000-4000-8000-00000f100087', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Limonada natural', null, 6500, '{bebida}', false, false, 3, null, null),
  ('d0000000-0000-4000-8000-00000f100088', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Limonada de hierbabuena', null, 9000, '{bebida}', false, false, 4, null, null),
  ('d0000000-0000-4000-8000-00000f100089', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Limonada cerezada', null, 9000, '{bebida,dulce}', false, false, 5, null, null),
  ('d0000000-0000-4000-8000-00000f100090', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Limonada de coco', null, 10500, '{bebida,dulce}', false, false, 6, null, null),
  ('d0000000-0000-4000-8000-00000f100091', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Soda de frutos rojos', 'Fresa, mora, arándanos.', 12500, '{bebida}', false, false, 7, null, null),
  ('d0000000-0000-4000-8000-00000f100092', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Soda de maracuyá', 'Maracuyá, hierbabuena.', 12500, '{bebida}', false, false, 8, null, null),
  ('d0000000-0000-4000-8000-00000f100093', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Soda de lulo', 'Lulo y limón mandarino.', 12500, '{bebida}', false, false, 9, null, null),
  ('d0000000-0000-4000-8000-00000f100094', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Gaseosa 400 ml', null, 5500, '{bebida}', false, false, 10, null, null),
  ('d0000000-0000-4000-8000-00000f100095', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Gaseosa 1.5 lt', null, 10500, '{bebida}', false, false, 11, null, null),
  ('d0000000-0000-4000-8000-00000f100096', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Bretaña 300 ml', null, 6000, '{bebida}', false, false, 12, null, null),
  ('d0000000-0000-4000-8000-00000f100097', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Té Hatsu 400 ml', null, 7500, '{bebida}', false, false, 13, null, null),
  ('d0000000-0000-4000-8000-00000f100098', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200010', 'plato', 'Botella de agua', null, 4500, '{bebida}', false, false, 14, null, null),
  ('d0000000-0000-4000-8000-00000f100099', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Club Colombia', null, 8500, '{bebida}', false, false, 1, null, null),
  ('d0000000-0000-4000-8000-00000f100100', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Coronita', null, 8500, '{bebida}', false, false, 2, null, null),
  ('d0000000-0000-4000-8000-00000f100101', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Heineken', null, 10000, '{bebida}', false, false, 3, null, null),
  ('d0000000-0000-4000-8000-00000f100102', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Tres Cordilleras', null, 10000, '{bebida}', false, false, 4, null, null),
  ('d0000000-0000-4000-8000-00000f100103', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Corona', null, 10500, '{bebida}', false, false, 5, null, null),
  ('d0000000-0000-4000-8000-00000f100104', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Copa de vino caliente', null, 25000, '{bebida}', false, false, 6, null, null),
  ('d0000000-0000-4000-8000-00000f100105', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Tinto de verano', null, 25000, '{bebida}', false, false, 7, null, null),
  ('d0000000-0000-4000-8000-00000f100106', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Quinta Cabras', 'Botella de vino.', 60000, '{bebida}', false, false, 8, null, null),
  ('d0000000-0000-4000-8000-00000f100107', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Fronteras', 'Botella de vino.', 90000, '{bebida}', false, false, 9, null, null),
  ('d0000000-0000-4000-8000-00000f100108', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Lazo Undurraga', 'Botella de vino.', 90000, '{bebida}', false, false, 10, null, null),
  ('d0000000-0000-4000-8000-00000f100109', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Gato Negro', 'Botella de vino.', 90000, '{bebida}', false, false, 11, null, null),
  ('d0000000-0000-4000-8000-00000f100110', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Casillero del Diablo', 'Botella de vino.', 130000, '{bebida}', false, false, 12, null, null),
  ('d0000000-0000-4000-8000-00000f100111', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Mojito', 'Ron blanco, limón, hierbabuena.', 22000, '{bebida}', false, false, 13, null, null),
  ('d0000000-0000-4000-8000-00000f100112', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Tequila sunrise', 'Tequila, jugo de naranja, granadina.', 22000, '{bebida}', false, false, 14, null, null),
  ('d0000000-0000-4000-8000-00000f100113', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Laguna azul', 'Vodka, curaçao azul, zumo de limón.', 22000, '{bebida}', false, false, 15, null, null),
  ('d0000000-0000-4000-8000-00000f100114', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Margarita (cóctel)', 'Tequila, triple sec, zumo de limón.', 28000, '{bebida}', false, false, 16, null, null),
  ('d0000000-0000-4000-8000-00000f100115', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'El Padrino', 'Whisky, licor amaretto.', 28000, '{bebida}', false, false, 17, null, null),
  ('d0000000-0000-4000-8000-00000f100116', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Long Island', 'Vodka, tequila, triple sec, ron blanco, ginebra, zumo de limón.', 30000, '{bebida}', false, false, 18, null, null),
  ('d0000000-0000-4000-8000-00000f100117', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Guarapito de piña', 'Cóctel de autor.', 22000, '{bebida,dulce}', false, false, 19, null, null),
  ('d0000000-0000-4000-8000-00000f100118', 'd0000000-0000-4000-8000-0000000000f1', 'd0000000-0000-4000-8000-00000f200011', 'plato', 'Gin tonic frutos rojos', 'Ginebra, agua tónica, frutos rojos.', 22000, '{bebida}', false, false, 20, null, null)
on conflict (id) do update set categoria_id = excluded.categoria_id, nombre = excluded.nombre, descripcion = excluded.descripcion,
  precio = excluded.precio, etiquetas = excluded.etiquetas, destacado = excluded.destacado, orden = excluded.orden,
  modelo_url = excluded.modelo_url, foto_url = excluded.foto_url;
-- Los 2 agotados de ejemplo se marcan solo al crearlos (luego el panel manda)

insert into public.premios (id, negocio_id, nombre, valor_pesos, orden) values
  ('d0000000-0000-4000-8000-00000f300001', 'd0000000-0000-4000-8000-0000000000f1', 'Limonada natural', 6500, 1),
  ('d0000000-0000-4000-8000-00000f300002', 'd0000000-0000-4000-8000-0000000000f1', 'Porción de pizza', 10300, 2),
  ('d0000000-0000-4000-8000-00000f300003', 'd0000000-0000-4000-8000-0000000000f1', 'Soda de frutos rojos', 12500, 3),
  ('d0000000-0000-4000-8000-00000f300004', 'd0000000-0000-4000-8000-0000000000f1', 'Empanadas de queso', 16000, 4),
  ('d0000000-0000-4000-8000-00000f300005', 'd0000000-0000-4000-8000-0000000000f1', 'Pizza personal', 21000, 5),
  ('d0000000-0000-4000-8000-00000f300006', 'd0000000-0000-4000-8000-0000000000f1', 'Copa de vino caliente', 25000, 6),
  ('d0000000-0000-4000-8000-00000f300007', 'd0000000-0000-4000-8000-0000000000f1', 'Pasta larga a tu gusto', 27000, 7)
on conflict (id) do nothing;

-- Clientes de EJEMPLO (inventados) con sus visitas: unos vienen seguido y otros dejaron de venir ("En riesgo" del panel)
insert into public.clientes (id, telefono, nombre) values ('d0000000-0000-4000-8000-00000f400001', '573000002001', 'Andrea M.') on conflict (id) do nothing;
insert into public.membresias (id, cliente_id, negocio_id, token, saldo, total_ganado, visitas, acepto_datos_at, ultima_visita, vence)
values ('d0000000-0000-4000-8000-00000f500001', 'd0000000-0000-4000-8000-00000f400001', 'd0000000-0000-4000-8000-0000000000f1', md5('fuertes-1'), 140, 140, 9, now() - interval '97 days',
  now() - interval '34 days', now() + interval '12 months') on conflict (id) do nothing;
insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, op_id, creado)
select 'd0000000-0000-4000-8000-00000f500001', 'd0000000-0000-4000-8000-0000000000f1', 'visita', 10, md5('fuertes-1-' || k)::uuid, now() - make_interval(days => 34 + k * 7, hours => 19 - k % 6)
from generate_series(0, 8) k on conflict (op_id) do nothing;
insert into public.clientes (id, telefono, nombre) values ('d0000000-0000-4000-8000-00000f400002', '573000002002', 'Carlos R.') on conflict (id) do nothing;
insert into public.membresias (id, cliente_id, negocio_id, token, saldo, total_ganado, visitas, acepto_datos_at, ultima_visita, vence)
values ('d0000000-0000-4000-8000-00000f500002', 'd0000000-0000-4000-8000-00000f400002', 'd0000000-0000-4000-8000-0000000000f1', md5('fuertes-2'), 110, 110, 6, now() - interval '63 days',
  now() - interval '27 days', now() + interval '12 months') on conflict (id) do nothing;
insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, op_id, creado)
select 'd0000000-0000-4000-8000-00000f500002', 'd0000000-0000-4000-8000-0000000000f1', 'visita', 10, md5('fuertes-2-' || k)::uuid, now() - make_interval(days => 27 + k * 6, hours => 19 - k % 6)
from generate_series(0, 5) k on conflict (op_id) do nothing;
insert into public.clientes (id, telefono, nombre) values ('d0000000-0000-4000-8000-00000f400003', '573000002003', 'Paola G.') on conflict (id) do nothing;
insert into public.membresias (id, cliente_id, negocio_id, token, saldo, total_ganado, visitas, acepto_datos_at, ultima_visita, vence)
values ('d0000000-0000-4000-8000-00000f500003', 'd0000000-0000-4000-8000-00000f400003', 'd0000000-0000-4000-8000-0000000000f1', md5('fuertes-3'), 170, 170, 12, now() - interval '101 days',
  now() - interval '41 days', now() + interval '12 months') on conflict (id) do nothing;
insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, op_id, creado)
select 'd0000000-0000-4000-8000-00000f500003', 'd0000000-0000-4000-8000-0000000000f1', 'visita', 10, md5('fuertes-3-' || k)::uuid, now() - make_interval(days => 41 + k * 5, hours => 19 - k % 6)
from generate_series(0, 11) k on conflict (op_id) do nothing;
insert into public.clientes (id, telefono, nombre) values ('d0000000-0000-4000-8000-00000f400004', '573000002004', 'Julián T.') on conflict (id) do nothing;
insert into public.membresias (id, cliente_id, negocio_id, token, saldo, total_ganado, visitas, acepto_datos_at, ultima_visita, vence)
values ('d0000000-0000-4000-8000-00000f500004', 'd0000000-0000-4000-8000-00000f400004', 'd0000000-0000-4000-8000-0000000000f1', md5('fuertes-4'), 100, 100, 5, now() - interval '63 days',
  now() - interval '23 days', now() + interval '12 months') on conflict (id) do nothing;
insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, op_id, creado)
select 'd0000000-0000-4000-8000-00000f500004', 'd0000000-0000-4000-8000-0000000000f1', 'visita', 10, md5('fuertes-4-' || k)::uuid, now() - make_interval(days => 23 + k * 8, hours => 19 - k % 6)
from generate_series(0, 4) k on conflict (op_id) do nothing;
insert into public.clientes (id, telefono, nombre) values ('d0000000-0000-4000-8000-00000f400005', '573000002005', 'Diana L.') on conflict (id) do nothing;
insert into public.membresias (id, cliente_id, negocio_id, token, saldo, total_ganado, visitas, acepto_datos_at, ultima_visita, vence)
values ('d0000000-0000-4000-8000-00000f500005', 'd0000000-0000-4000-8000-00000f400005', 'd0000000-0000-4000-8000-0000000000f1', md5('fuertes-5'), 120, 120, 7, now() - interval '93 days',
  now() - interval '30 days', now() + interval '12 months') on conflict (id) do nothing;
insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, op_id, creado)
select 'd0000000-0000-4000-8000-00000f500005', 'd0000000-0000-4000-8000-0000000000f1', 'visita', 10, md5('fuertes-5-' || k)::uuid, now() - make_interval(days => 30 + k * 9, hours => 19 - k % 6)
from generate_series(0, 6) k on conflict (op_id) do nothing;
insert into public.clientes (id, telefono, nombre) values ('d0000000-0000-4000-8000-00000f400006', '573000002006', 'Felipe O.') on conflict (id) do nothing;
insert into public.membresias (id, cliente_id, negocio_id, token, saldo, total_ganado, visitas, acepto_datos_at, ultima_visita, vence)
values ('d0000000-0000-4000-8000-00000f500006', 'd0000000-0000-4000-8000-00000f400006', 'd0000000-0000-4000-8000-0000000000f1', md5('fuertes-6'), 130, 130, 8, now() - interval '34 days',
  now() - interval '2 days', now() + interval '12 months') on conflict (id) do nothing;
insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, op_id, creado)
select 'd0000000-0000-4000-8000-00000f500006', 'd0000000-0000-4000-8000-0000000000f1', 'visita', 10, md5('fuertes-6-' || k)::uuid, now() - make_interval(days => 2 + k * 4, hours => 19 - k % 6)
from generate_series(0, 7) k on conflict (op_id) do nothing;
insert into public.clientes (id, telefono, nombre) values ('d0000000-0000-4000-8000-00000f400007', '573000002007', 'Mónica S.') on conflict (id) do nothing;
insert into public.membresias (id, cliente_id, negocio_id, token, saldo, total_ganado, visitas, acepto_datos_at, ultima_visita, vence)
values ('d0000000-0000-4000-8000-00000f500007', 'd0000000-0000-4000-8000-00000f400007', 'd0000000-0000-4000-8000-0000000000f1', md5('fuertes-7'), 90, 90, 4, now() - interval '33 days',
  now() - interval '5 days', now() + interval '12 months') on conflict (id) do nothing;
insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, op_id, creado)
select 'd0000000-0000-4000-8000-00000f500007', 'd0000000-0000-4000-8000-0000000000f1', 'visita', 10, md5('fuertes-7-' || k)::uuid, now() - make_interval(days => 5 + k * 7, hours => 19 - k % 6)
from generate_series(0, 3) k on conflict (op_id) do nothing;
insert into public.clientes (id, telefono, nombre) values ('d0000000-0000-4000-8000-00000f400008', '573000002008', 'Andrés C.') on conflict (id) do nothing;
insert into public.membresias (id, cliente_id, negocio_id, token, saldo, total_ganado, visitas, acepto_datos_at, ultima_visita, vence)
values ('d0000000-0000-4000-8000-00000f500008', 'd0000000-0000-4000-8000-00000f400008', 'd0000000-0000-4000-8000-0000000000f1', md5('fuertes-8'), 150, 150, 10, now() - interval '31 days',
  now() - interval '1 days', now() + interval '12 months') on conflict (id) do nothing;
insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, op_id, creado)
select 'd0000000-0000-4000-8000-00000f500008', 'd0000000-0000-4000-8000-0000000000f1', 'visita', 10, md5('fuertes-8-' || k)::uuid, now() - make_interval(days => 1 + k * 3, hours => 19 - k % 6)
from generate_series(0, 9) k on conflict (op_id) do nothing;
insert into public.clientes (id, telefono, nombre) values ('d0000000-0000-4000-8000-00000f400009', '573000002009', 'Laura P.') on conflict (id) do nothing;
insert into public.membresias (id, cliente_id, negocio_id, token, saldo, total_ganado, visitas, acepto_datos_at, ultima_visita, vence)
values ('d0000000-0000-4000-8000-00000f500009', 'd0000000-0000-4000-8000-00000f400009', 'd0000000-0000-4000-8000-0000000000f1', md5('fuertes-9'), 80, 80, 3, now() - interval '39 days',
  now() - interval '9 days', now() + interval '12 months') on conflict (id) do nothing;
insert into public.movimientos (membresia_id, negocio_id, tipo, monedas, op_id, creado)
select 'd0000000-0000-4000-8000-00000f500009', 'd0000000-0000-4000-8000-0000000000f1', 'visita', 10, md5('fuertes-9-' || k)::uuid, now() - make_interval(days => 9 + k * 10, hours => 19 - k % 6)
from generate_series(0, 2) k on conflict (op_id) do nothing;
