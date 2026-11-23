-- =====================================================================
--  NEF · Storage (Supabase). Se corre a mano en el SQL Editor después de esquema.sql. Idempotente.
--
--  Bucket PRIVADO "informes": PDF del estudio trimestral (máx. 10 MB).
--   - Solo el admin sube, cambia o borra.
--   - Leer (firmar una URL temporal) se permite solo para rutas que existen en public.informes.
--     Las rutas son <negocio_id>/<uuid>.pdf (no adivinables) y el dueño solo obtiene la ruta de SUS
--     informes con informe_ruta(token, id). La Function /api/informe firma la URL con la anon key
--     (nunca con service_role) y redirige; la URL dura 1 hora.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('informes', 'informes', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

drop policy if exists "informes: admin sube" on storage.objects;
create policy "informes: admin sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'informes' and public.es_admin());

drop policy if exists "informes: admin cambia" on storage.objects;
create policy "informes: admin cambia" on storage.objects for update to authenticated
  using (bucket_id = 'informes' and public.es_admin()) with check (bucket_id = 'informes' and public.es_admin());

drop policy if exists "informes: admin borra" on storage.objects;
create policy "informes: admin borra" on storage.objects for delete to authenticated
  using (bucket_id = 'informes' and public.es_admin());

drop policy if exists "informes: leer rutas registradas" on storage.objects;
create policy "informes: leer rutas registradas" on storage.objects for select to anon, authenticated
  using (bucket_id = 'informes' and public.informe_existe(storage.objects.name));

-- ---------------------------------------------------------------------
--  Bucket PÚBLICO "fotos": fotos de la carta (WebP 1000×1000, las convierte el navegador). Máx. 2 MB.
--  Lectura pública (son la carta en la vitrina); subir, cambiar y borrar: solo el admin.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists "fotos: admin sube" on storage.objects;
create policy "fotos: admin sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.es_admin());

drop policy if exists "fotos: admin cambia" on storage.objects;
create policy "fotos: admin cambia" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.es_admin()) with check (bucket_id = 'fotos' and public.es_admin());

drop policy if exists "fotos: admin borra" on storage.objects;
create policy "fotos: admin borra" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.es_admin());
