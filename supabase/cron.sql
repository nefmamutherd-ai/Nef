-- =====================================================================
--  NEF · cálculo nocturno de estadísticas (pg_cron)
--  Se corre A MANO en Supabase (SQL Editor) una sola vez, después de esquema.sql.
--  Las pruebas no lo usan: el Postgres de pruebas no tiene pg_cron; ellas llaman recalcular_todo directo.
--
--  Cada día a las 7:00 UTC (= 2:00 a. m. en Bogotá) recalcula los dos últimos días de todos los negocios
--  activos y vence las monedas de quienes cumplieron 12 meses sin visitas.
-- =====================================================================
create extension if not exists pg_cron;

-- Si ya existía, se reemplaza (idempotente)
select cron.unschedule(jobid) from cron.job where jobname = 'nef-metricas';
select cron.schedule('nef-metricas', '0 7 * * *', $$select public.recalcular_todo(current_date - 2)$$);
