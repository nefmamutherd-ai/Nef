-- =====================================================================
--  NEF · negocios de DEMOSTRACIÓN (para mostrarle Nef a un cliente). Datos inventados.
--  Se corre después de esquema.sql. Idempotente: se puede correr muchas veces (ids fijos).
--  Crea /n/demo-cafe y /n/demo-gym. La landing muestra "Tócalo tú" cuando /n/demo-cafe existe.
--  Caja de las demos: /caja/demo-cafe y /caja/demo-gym con PIN 1234.
-- =====================================================================

insert into public.empresas (id, nombre, plan)
values ('d0000000-0000-4000-8000-000000000001', 'Demostración', 'demo')
on conflict (id) do nothing;

-- ---------- Café ----------
insert into public.negocios (id, empresa_id, slug, nombre, descripcion, color, sector, servicios, ubicacion_etiqueta,
  resena_url, whatsapp, instagram, wifi_nombre, wifi_clave, moneda_plural, moneda_singular, bienvenida, monedas_por_visita)
values ('d0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-000000000001', 'demo-cafe', 'Café Luna',
  'Café de especialidad · demostración', '#ff5a36', 'cafe', '{"base":true,"catalogo":true,"club":true,"estudio":false}',
  'Mesa 4', 'https://www.google.com/maps', '3224731560', null, 'CafeLuna_Clientes', 'luna2026', 'monedas', 'moneda', 50, 10)
on conflict (id) do update set slug = excluded.slug, nombre = excluded.nombre, servicios = excluded.servicios, activo = true,
  whatsapp = excluded.whatsapp, instagram = excluded.instagram, color = excluded.color;

insert into public.categorias (id, negocio_id, nombre, orden) values
  ('d0000000-0000-4000-8000-0000000c0001', 'd0000000-0000-4000-8000-0000000000c1', 'Desayunos', 1),
  ('d0000000-0000-4000-8000-0000000c0002', 'd0000000-0000-4000-8000-0000000000c1', 'Cafés', 2),
  ('d0000000-0000-4000-8000-0000000c0003', 'd0000000-0000-4000-8000-0000000000c1', 'Postres', 3)
on conflict (id) do nothing;

insert into public.productos (id, negocio_id, categoria_id, tipo, nombre, descripcion, precio, etiquetas, destacado, agotado) values
  ('d0000000-0000-4000-8000-00000000a001', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0001', 'plato', 'Calentado de la casa', 'Fríjol, arroz, huevo y arepa', 18500, '{salado}', true, false),
  ('d0000000-0000-4000-8000-00000000a002', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0001', 'plato', 'Tostada de aguacate', 'Pan de masa madre y huevo pochado', 16000, '{salado,vegetariano}', false, false),
  ('d0000000-0000-4000-8000-00000000a003', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0001', 'plato', 'Huevos rancheros', 'Salsa de tomate asado y queso', 17500, '{salado,picante}', false, false),
  ('d0000000-0000-4000-8000-00000000a004', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0001', 'plato', 'Changua', 'Leche, huevo, cebolla larga y calado', 12000, '{salado}', false, false),
  ('d0000000-0000-4000-8000-00000000a005', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0002', 'plato', 'Capuchino', 'Doble espresso y leche cremosa', 8000, '{bebida}', true, false),
  ('d0000000-0000-4000-8000-00000000a006', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0002', 'plato', 'Tinto campesino', 'Con panela y canela', 4500, '{bebida}', false, false),
  ('d0000000-0000-4000-8000-00000000a007', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0002', 'plato', 'Café filtrado de origen', 'Huila, notas a panela', 7000, '{bebida}', false, false),
  ('d0000000-0000-4000-8000-00000000a008', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0002', 'plato', 'Chocolate santafereño', 'Con queso y almojábana', 9500, '{bebida,dulce}', false, false),
  ('d0000000-0000-4000-8000-00000000a009', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0003', 'plato', 'Torta de chocolate', 'Húmeda, con arequipe', 9000, '{dulce}', true, false),
  ('d0000000-0000-4000-8000-00000000a010', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0003', 'plato', 'Croissant de almendras', 'Horneado en casa', 9500, '{dulce}', false, true),
  ('d0000000-0000-4000-8000-00000000a011', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0003', 'plato', 'Galleta de avena', 'Con chips de chocolate', 4000, '{dulce}', false, false),
  ('d0000000-0000-4000-8000-00000000a012', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0003', 'plato', 'Postre de natas', 'Receta de la abuela', 8500, '{dulce}', false, false)
on conflict (id) do nothing;

insert into public.premios (id, negocio_id, nombre, valor_pesos, orden) values
  ('d0000000-0000-4000-8000-0000000b0001', 'd0000000-0000-4000-8000-0000000000c1', 'Galleta de avena', 4000, 1),
  ('d0000000-0000-4000-8000-0000000b0002', 'd0000000-0000-4000-8000-0000000000c1', 'Capuchino', 8000, 2),
  ('d0000000-0000-4000-8000-0000000b0003', 'd0000000-0000-4000-8000-0000000000c1', 'Desayuno completo', 20000, 3)
on conflict (id) do nothing;

insert into public.tags (id, codigo, negocio_id, nombre) values
  ('d0000000-0000-4000-8000-0000000e0001', 'democafe', 'd0000000-0000-4000-8000-0000000000c1', 'Mesa 4')
on conflict (id) do nothing;

-- Cliente de ejemplo con 230 monedas (su tarjeta se abre con este token)
insert into public.clientes (id, telefono, nombre)
values ('d0000000-0000-4000-8000-0000000f0001', '573000000001', 'Laura Demo')
on conflict (id) do nothing;
insert into public.membresias (id, cliente_id, negocio_id, token, saldo, total_ganado, visitas, acepto_datos_at, ultima_visita, vence)
values ('d0000000-0000-4000-8000-0000000f0101', 'd0000000-0000-4000-8000-0000000f0001', 'd0000000-0000-4000-8000-0000000000c1',
  'de00cafe000000000000000000000a01', 230, 230, 12, now(), now() - interval '3 days', now() + interval '12 months')
on conflict (id) do nothing;

-- ---------- Gimnasio ----------
insert into public.negocios (id, empresa_id, slug, nombre, descripcion, color, sector, servicios, ubicacion_etiqueta,
  resena_url, whatsapp, wifi_nombre, wifi_clave, bienvenida, monedas_por_visita)
values ('d0000000-0000-4000-8000-0000000000a2', 'd0000000-0000-4000-8000-000000000001', 'demo-gym', 'Forja Gym',
  'Gimnasio · demostración', '#1f1f1f', 'gimnasio', '{"base":true,"catalogo":true,"club":true,"estudio":true}',
  'Sede Chapinero', 'https://www.google.com/maps', '3224731560', 'Forja_Socios', 'fuerza123', 50, 10)
on conflict (id) do update set slug = excluded.slug, nombre = excluded.nombre, servicios = excluded.servicios, activo = true,
  whatsapp = excluded.whatsapp, instagram = excluded.instagram;

insert into public.productos (id, negocio_id, tipo, nombre, descripcion, pasos, orden) values
  ('d0000000-0000-4000-8000-00000000b101', 'd0000000-0000-4000-8000-0000000000a2', 'maquina', 'Prensa de piernas', 'Cuádriceps y glúteos',
   '["Ajusta el asiento a la altura de tu cadera","Empuja sin bloquear las rodillas","Baja despacio, en 3 segundos"]', 1),
  ('d0000000-0000-4000-8000-00000000b102', 'd0000000-0000-4000-8000-0000000000a2', 'maquina', 'Jalón al pecho', 'Espalda',
   '["Ajusta el rodillo sobre tus muslos","Baja la barra al pecho sacando el pecho","Sube controlando, sin soltar de golpe"]', 2),
  ('d0000000-0000-4000-8000-00000000b103', 'd0000000-0000-4000-8000-0000000000a2', 'maquina', 'Press de pecho', 'Pecho y tríceps',
   '["Agarra a la altura del pecho","Empuja sin bloquear los codos","Vuelve despacio"]', 3),
  ('d0000000-0000-4000-8000-00000000b104', 'd0000000-0000-4000-8000-0000000000a2', 'maquina', 'Remo sentado', 'Espalda media',
   '["Pecho contra el apoyo","Lleva los codos atrás juntando escápulas","Regresa sin encorvarte"]', 4),
  ('d0000000-0000-4000-8000-00000000b105', 'd0000000-0000-4000-8000-0000000000a2', 'maquina', 'Extensión de piernas', 'Cuádriceps',
   '["El eje de la máquina a la altura de tu rodilla","Extiende sin dar golpe arriba","Baja en 3 segundos"]', 5),
  ('d0000000-0000-4000-8000-00000000b106', 'd0000000-0000-4000-8000-0000000000a2', 'maquina', 'Caminadora', 'Cardio',
   '["Empieza caminando 3 minutos","Sube la velocidad poco a poco","Para con la tecla roja, no te bajes andando"]', 6)
on conflict (id) do nothing;

-- Clases: todos los días hay al menos una (para que "Clases de hoy" nunca salga vacío en la demo). dia 0 = domingo.
insert into public.productos (id, negocio_id, tipo, nombre, descripcion, horario, orden) values
  ('d0000000-0000-4000-8000-00000000b201', 'd0000000-0000-4000-8000-0000000000a2', 'clase', 'Funcional', 'Todo el cuerpo, 45 minutos',
   '[{"dia":1,"hora":"06:00","duracion":45,"cupo":20},{"dia":3,"hora":"06:00","duracion":45,"cupo":20},{"dia":5,"hora":"06:00","duracion":45,"cupo":20}]', 1),
  ('d0000000-0000-4000-8000-00000000b202', 'd0000000-0000-4000-8000-0000000000a2', 'clase', 'Spinning', 'Cardio con música',
   '[{"dia":2,"hora":"18:00","duracion":45,"cupo":25},{"dia":4,"hora":"18:00","duracion":45,"cupo":25}]', 2),
  ('d0000000-0000-4000-8000-00000000b203', 'd0000000-0000-4000-8000-0000000000a2', 'clase', 'Yoga', 'Movilidad y respiración',
   '[{"dia":0,"hora":"09:00","duracion":60,"cupo":15},{"dia":6,"hora":"09:00","duracion":60,"cupo":15}]', 3),
  ('d0000000-0000-4000-8000-00000000b204', 'd0000000-0000-4000-8000-0000000000a2', 'clase', 'Rumba', 'Baile para todos',
   '[{"dia":1,"hora":"19:00","duracion":50,"cupo":30},{"dia":3,"hora":"19:00","duracion":50,"cupo":30},{"dia":6,"hora":"10:30","duracion":50,"cupo":30}]', 4)
on conflict (id) do nothing;

-- Más clases para que la semana se vea viva (Jacobo, 27/11/2026): 3 a 5 por día, mañana, mediodía y noche
insert into public.productos (id, negocio_id, tipo, nombre, descripcion, horario, orden) values
  ('d0000000-0000-4000-8000-00000000b205', 'd0000000-0000-4000-8000-0000000000a2', 'clase', 'HIIT', 'Intervalos de alta intensidad, 30 minutos',
   '[{"dia":1,"hora":"07:00","duracion":30,"cupo":20},{"dia":3,"hora":"07:00","duracion":30,"cupo":20},{"dia":5,"hora":"07:00","duracion":30,"cupo":20},{"dia":2,"hora":"19:00","duracion":30,"cupo":20},{"dia":4,"hora":"19:00","duracion":30,"cupo":20}]', 5),
  ('d0000000-0000-4000-8000-00000000b206', 'd0000000-0000-4000-8000-0000000000a2', 'clase', 'Pilates', 'Core, postura y control',
   '[{"dia":2,"hora":"08:00","duracion":50,"cupo":14},{"dia":4,"hora":"08:00","duracion":50,"cupo":14},{"dia":6,"hora":"08:00","duracion":50,"cupo":14}]', 6),
  ('d0000000-0000-4000-8000-00000000b207', 'd0000000-0000-4000-8000-0000000000a2', 'clase', 'Glúteos y piernas', 'Tren inferior con bandas',
   '[{"dia":1,"hora":"18:00","duracion":45,"cupo":22},{"dia":3,"hora":"18:00","duracion":45,"cupo":22},{"dia":6,"hora":"11:00","duracion":45,"cupo":22}]', 7),
  ('d0000000-0000-4000-8000-00000000b208', 'd0000000-0000-4000-8000-0000000000a2', 'clase', 'Abdomen 30', 'A mediodía, en 30 minutos',
   '[{"dia":1,"hora":"12:30","duracion":30,"cupo":18},{"dia":2,"hora":"12:30","duracion":30,"cupo":18},{"dia":3,"hora":"12:30","duracion":30,"cupo":18},{"dia":4,"hora":"12:30","duracion":30,"cupo":18},{"dia":5,"hora":"12:30","duracion":30,"cupo":18}]', 8),
  ('d0000000-0000-4000-8000-00000000b209', 'd0000000-0000-4000-8000-0000000000a2', 'clase', 'Kickboxing', 'Cardio con golpes y patadas',
   '[{"dia":2,"hora":"20:00","duracion":50,"cupo":20},{"dia":4,"hora":"20:00","duracion":50,"cupo":20},{"dia":5,"hora":"18:00","duracion":50,"cupo":20}]', 9),
  ('d0000000-0000-4000-8000-00000000b210', 'd0000000-0000-4000-8000-0000000000a2', 'clase', 'Cross training', 'Fuerza y resistencia en circuito',
   '[{"dia":1,"hora":"19:30","duracion":50,"cupo":16},{"dia":3,"hora":"19:30","duracion":50,"cupo":16},{"dia":5,"hora":"19:30","duracion":50,"cupo":16},{"dia":0,"hora":"10:00","duracion":50,"cupo":16}]', 10),
  ('d0000000-0000-4000-8000-00000000b211', 'd0000000-0000-4000-8000-0000000000a2', 'clase', 'Estiramiento', 'Movilidad para recuperarte',
   '[{"dia":0,"hora":"11:00","duracion":40,"cupo":20},{"dia":3,"hora":"07:30","duracion":40,"cupo":20}]', 11),
  ('d0000000-0000-4000-8000-00000000b212', 'd0000000-0000-4000-8000-0000000000a2', 'clase', 'Baile fitness', 'Ritmos latinos para sudar',
   '[{"dia":5,"hora":"19:00","duracion":50,"cupo":30},{"dia":6,"hora":"16:00","duracion":50,"cupo":30},{"dia":0,"hora":"16:00","duracion":50,"cupo":30}]', 12)
on conflict (id) do nothing;

insert into public.premios (id, negocio_id, nombre, valor_pesos, orden) values
  ('d0000000-0000-4000-8000-0000000b0101', 'd0000000-0000-4000-8000-0000000000a2', 'Batido de proteína', 12000, 1),
  ('d0000000-0000-4000-8000-0000000b0102', 'd0000000-0000-4000-8000-0000000000a2', 'Toalla Forja', 25000, 2),
  ('d0000000-0000-4000-8000-0000000b0103', 'd0000000-0000-4000-8000-0000000000a2', '10 % en tu proteína', 15000, 3)
on conflict (id) do nothing;

-- Gimnasio (26/11/2026): llegada con el QR de recepción (modo rápido, +10, una vez cada 12 h), entrenar con el tutorial
-- de una máquina (+5 tras 15 min, cada 8 h) y meta del mes (12 llegadas → +100). Ver DECISIONES.
update public.negocios set rapido_activo = true, rapido_monedas = 10, horas_entre_visitas = 12,
  maquina_monedas = 5, maquina_minutos = 15, maquina_horas = 8, meta_mes_llegadas = 12, meta_mes_bono = 100
where id = 'd0000000-0000-4000-8000-0000000000a2';

insert into public.tags (id, codigo, negocio_id, nombre, destino, producto_id) values
  ('d0000000-0000-4000-8000-0000000e0101', 'demogym', 'd0000000-0000-4000-8000-0000000000a2', 'Recepción', 'hub', null),
  ('d0000000-0000-4000-8000-0000000e0102', 'demoprensa', 'd0000000-0000-4000-8000-0000000000a2', 'Prensa de piernas', 'producto', 'd0000000-0000-4000-8000-00000000b101')
on conflict (id) do nothing;

-- PIN de las cajas de demostración: 1234 (solo si aún no tienen)
update public.negocios set pin_caja_hash = extensions.crypt('1234', extensions.gen_salt('bf'))
where id in ('d0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000000a2') and pin_caja_hash is null;

-- Fotos de los platos de la demo (renders 3D de Blender, scripts/platos_blender.py), servidas por el propio sitio.
-- Solo si el plato no tiene foto o tiene la ilustración vieja (.svg): nunca pisa una foto subida.
update public.productos p set foto_url = v.foto
from (values
  ('d0000000-0000-4000-8000-00000000a001', '/assets/demo/calentado.webp'),
  ('d0000000-0000-4000-8000-00000000a002', '/assets/demo/tostada-aguacate.webp'),
  ('d0000000-0000-4000-8000-00000000a003', '/assets/demo/huevos-rancheros.webp'),
  ('d0000000-0000-4000-8000-00000000a004', '/assets/demo/changua.webp'),
  ('d0000000-0000-4000-8000-00000000a005', '/assets/demo/capuchino.webp'),
  ('d0000000-0000-4000-8000-00000000a006', '/assets/demo/tinto.webp'),
  ('d0000000-0000-4000-8000-00000000a007', '/assets/demo/cafe-filtrado.webp'),
  ('d0000000-0000-4000-8000-00000000a008', '/assets/demo/chocolate.webp'),
  ('d0000000-0000-4000-8000-00000000a009', '/assets/demo/torta-chocolate.webp'),
  ('d0000000-0000-4000-8000-00000000a010', '/assets/demo/croissant.webp'),
  ('d0000000-0000-4000-8000-00000000a011', '/assets/demo/galleta-avena.webp'),
  ('d0000000-0000-4000-8000-00000000a012', '/assets/demo/natas.webp')
) as v(id, foto)
where p.id = v.id::uuid and (p.foto_url is null or p.foto_url like '/assets/demo/%.svg');

-- Modelos 3D de los mismos platos (scripts/platos_glb.py): se giran con el dedo y se ven en la mesa (realidad aumentada)
update public.productos p set modelo_url = replace(replace(p.foto_url, '/assets/demo/', '/assets/demo/3d/'), '.webp', '.glb')
where p.negocio_id = 'd0000000-0000-4000-8000-0000000000c1' and p.foto_url like '/assets/demo/%.webp' and p.modelo_url is null;

-- Platos nuevos (26/11/2026, la carta 3D es primero para restaurantes): hamburguesa, desayuno de cafetería y malteada.
-- Fotos y modelos de scripts/platos_blender.py y platos_glb.py. Van en /3d/solo3d/: se giran en 3D, sin "Verlo en tu mesa".
insert into public.categorias (id, negocio_id, nombre, orden) values
  ('d0000000-0000-4000-8000-0000000c0004', 'd0000000-0000-4000-8000-0000000000c1', 'Platos fuertes', 1),
  ('d0000000-0000-4000-8000-0000000c0005', 'd0000000-0000-4000-8000-0000000000c1', 'Bebidas frías', 2)
on conflict (id) do nothing;
insert into public.productos (id, negocio_id, categoria_id, tipo, nombre, descripcion, precio, etiquetas, destacado, agotado, foto_url, modelo_url) values
  ('d0000000-0000-4000-8000-00000000a013', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0004', 'plato', 'Hamburguesa de la casa', 'Carne a la parrilla, cheddar, lechuga, tomate y papas a la francesa', 26000, '{salado}', true, false, '/assets/demo/hamburguesa.webp', '/assets/demo/3d/solo3d/hamburguesa.glb'),
  ('d0000000-0000-4000-8000-00000000a014', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0001', 'plato', 'Desayuno cafetero', 'Pericos, arepa con queso, pan y fruta picada', 19500, '{salado}', true, false, '/assets/demo/desayuno.webp', '/assets/demo/3d/solo3d/desayuno.glb'),
  ('d0000000-0000-4000-8000-00000000a015', 'd0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-0000000c0005', 'plato', 'Malteada de fresa', 'Con crema batida, chispitas y cereza', 14000, '{bebida,dulce}', false, false, '/assets/demo/malteada.webp', '/assets/demo/3d/solo3d/malteada.glb')
on conflict (id) do nothing;

-- "Los favoritos" de Café Luna = los mejores renders (Jacobo, 27/11/2026): esos van destacados, el resto no
update public.productos set destacado = (id in ('d0000000-0000-4000-8000-00000000a013', 'd0000000-0000-4000-8000-00000000a015',
  'd0000000-0000-4000-8000-00000000a014', 'd0000000-0000-4000-8000-00000000a005', 'd0000000-0000-4000-8000-00000000a009',
  'd0000000-0000-4000-8000-00000000a003'))
where negocio_id = 'd0000000-0000-4000-8000-0000000000c1';

-- ---------- Gimnasio estilo REPS (26/11/2026) ----------
-- Forja Gym con tono aspiracional y un rack de mancuernas (5 máquinas con tutorial en 3D)
update public.negocios set descripcion = 'Entrena fuerte · Suma en cada visita' where id = 'd0000000-0000-4000-8000-0000000000a2';
insert into public.productos (id, negocio_id, tipo, nombre, descripcion, pasos, orden) values
  ('d0000000-0000-4000-8000-00000000b107', 'd0000000-0000-4000-8000-0000000000a2', 'maquina', 'Rack de mancuernas', 'Brazos, hombros y pecho',
   '["Toma el par con la espalda recta, doblando las rodillas","Codos pegados al cuerpo y sin balancearte","Devuélvelas a su lugar, de la más liviana a la más pesada"]', 3)
on conflict (id) do nothing;

-- Copia para la reunión con REPS (gimnasio de Bogotá, prospecto): SOLO su nombre en texto y su morado; sin su logo
-- ni fotos suyas. Marcada como demostración de Nef y sin indexar (lib/portal.js: slugs demo-* llevan noindex).
-- Se entra por /n/demo-reps. Los productos y premios son copia de Forja Gym con ids fijos (md5), así es idempotente.
insert into public.negocios (id, empresa_id, slug, nombre, descripcion, color, sector, servicios, ubicacion_etiqueta,
  resena_url, whatsapp, bienvenida, monedas_por_visita)
values ('d0000000-0000-4000-8000-0000000000a3', 'd0000000-0000-4000-8000-000000000001', 'demo-reps', 'REPS',
  'Demostración de Nef para REPS', '#c61b98', 'gimnasio', '{"base":true,"catalogo":true,"club":true,"estudio":true}',
  'Bogotá', 'https://www.google.com/maps', '3224731560', 50, 10)
on conflict (id) do update set slug = excluded.slug, nombre = excluded.nombre, descripcion = excluded.descripcion,
  color = excluded.color, servicios = excluded.servicios, ubicacion_etiqueta = excluded.ubicacion_etiqueta, activo = true;
update public.negocios set rapido_activo = true, rapido_monedas = 10, horas_entre_visitas = 12,
  maquina_monedas = 5, maquina_minutos = 15, maquina_horas = 8, meta_mes_llegadas = 12, meta_mes_bono = 100
where id = 'd0000000-0000-4000-8000-0000000000a3';
-- Identidad de REPS (27/11/2026, de su web repsgym.com.co): piel neon, su magenta, reseña en su sede de Suba Salitre y las
-- 3 sedes con su link de Google Maps. Forja Gym: piel industrial (identidad propia, distinta de REPS).
update public.negocios set tema = 'neon', color = '#c61b98', ubicacion_etiqueta = 'Bogotá · 3 sedes',
  resena_url = 'https://www.google.com/maps/place/Cra.+92+%23159a-6,+Bogot%C3%A1/@4.7557436,-74.0824823,1123m/data=!3m2!1e3!4b1!4m5!3m4!1s0x8e3f845289efab61:0x1acea5380a2f1312!8m2!3d4.7557383!4d-74.0799074?entry=ttu&g_ep=EgoyMDI0MTAxMy4wIKXMDSoASAFQAw%3D%3D',
  links = '[{"titulo":"Sede Suba Salitre","url":"https://www.google.com/maps/place/Cra.+92+%23159a-6,+Bogot%C3%A1/@4.7557436,-74.0824823,1123m/data=!3m2!1e3!4b1!4m5!3m4!1s0x8e3f845289efab61:0x1acea5380a2f1312!8m2!3d4.7557383!4d-74.0799074?entry=ttu&g_ep=EgoyMDI0MTAxMy4wIKXMDSoASAFQAw%3D%3D"},{"titulo":"Sede Santa Rosita","url":"https://www.google.com/maps/place/Cra.+94+%2375-42,+Bogot%C3%A1/@4.7037023,-74.1121857,1124m/data=!3m2!1e3!4b1!4m6!3m5!1s0x8e3f9b4db5f0f80d:0x3b1828ad1d8fc67d!8m2!3d4.703697!4d-74.1096108!16s%2Fg%2F11py_xwkv2?entry=ttu&g_ep=EgoyMDI0MTAxMy4wIKXMDSoASAFQAw%3D%3D"},{"titulo":"Sede Candelaria La Nueva","url":"https://www.google.com/maps/place/Cl.+68+Sur+%2345d-14,+Bogot%C3%A1/data=!4m2!3m1!1s0x8e3f9f113ece8d99:0x6bb1d498c457f7cd?sa=X&ved=1t:242&ictx=111"}]'::jsonb
where id = 'd0000000-0000-4000-8000-0000000000a3';
update public.negocios set tema = 'industrial' where id = 'd0000000-0000-4000-8000-0000000000a2';

-- Las 5 máquinas en 3D (scripts/maquinas_glb.py, estilo artístico sencillo): se giran en la página de la máquina
update public.productos p set modelo_url = v.modelo
from (values
  ('d0000000-0000-4000-8000-00000000b103', '/assets/demo/3d/gym/industrial/press-pecho.glb'),
  ('d0000000-0000-4000-8000-00000000b107', '/assets/demo/3d/gym/industrial/mancuernas.glb'),
  ('d0000000-0000-4000-8000-00000000b101', '/assets/demo/3d/gym/industrial/prensa-45.glb'),
  ('d0000000-0000-4000-8000-00000000b102', '/assets/demo/3d/gym/industrial/jalon.glb'),
  ('d0000000-0000-4000-8000-00000000b105', '/assets/demo/3d/gym/industrial/extension.glb')
) as v(id, modelo)
where p.id = v.id::uuid and (p.modelo_url is null or p.modelo_url like '/assets/demo/3d/gym/%');
-- Miniatura de cada máquina (scripts/maquina_foto.py): sale en la tarjeta "Está aquí" del plano
update public.productos p set foto_url = replace(replace(p.modelo_url, '/3d/gym/', '/gym/'), '.glb', '.webp')
where p.negocio_id = 'd0000000-0000-4000-8000-0000000000a2' and p.modelo_url like '/assets/demo/3d/gym/%'
  and (p.foto_url is null or p.foto_url like '/assets/demo/gym/%');

-- (Debe ir AL FINAL del archivo: copia lo que Forja Gym ya tiene, modelos 3D incluidos)
insert into public.productos (id, negocio_id, tipo, nombre, descripcion, pasos, horario, video_url, foto_url, modelo_url, orden)
select md5('reps-' || p.id::text)::uuid, 'd0000000-0000-4000-8000-0000000000a3', p.tipo, p.nombre, p.descripcion, p.pasos,
  p.horario, p.video_url, p.foto_url, p.modelo_url, p.orden
from public.productos p where p.negocio_id = 'd0000000-0000-4000-8000-0000000000a2'
on conflict (id) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, pasos = excluded.pasos,
  horario = excluded.horario, foto_url = excluded.foto_url, modelo_url = excluded.modelo_url, orden = excluded.orden;
-- REPS: las mismas máquinas con cojines magenta (su color)
update public.productos set modelo_url = replace(modelo_url, '/gym/industrial/', '/gym/neon/'),
  foto_url = replace(foto_url, '/gym/industrial/', '/gym/neon/')
where negocio_id = 'd0000000-0000-4000-8000-0000000000a3' and modelo_url like '%/gym/industrial/%';
insert into public.premios (id, negocio_id, nombre, valor_pesos, orden)
select md5('reps-' || p.id::text)::uuid, 'd0000000-0000-4000-8000-0000000000a3', replace(p.nombre, 'Forja', 'REPS'), p.valor_pesos, p.orden
from public.premios p where p.negocio_id = 'd0000000-0000-4000-8000-0000000000a2'
on conflict (id) do nothing;
insert into public.tags (id, codigo, negocio_id, nombre, destino, producto_id) values
  ('d0000000-0000-4000-8000-0000000e0301', 'demoreps', 'd0000000-0000-4000-8000-0000000000a3', 'Recepción', 'hub', null),
  ('d0000000-0000-4000-8000-0000000e0302', 'demorepsprensa', 'd0000000-0000-4000-8000-0000000000a3', 'Prensa de piernas', 'producto',
   md5('reps-d0000000-0000-4000-8000-00000000b101')::uuid)
on conflict (id) do nothing;
update public.negocios set pin_caja_hash = extensions.crypt('1234', extensions.gen_salt('bf'))
where id = 'd0000000-0000-4000-8000-0000000000a3' and pin_caja_hash is null;
