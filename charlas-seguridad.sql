-- ============================================================
-- Sistema automático · carril charlas · avisos de seguridad de Supabase (2026-11-02)
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
--
-- 1 (CRITICAL "Security Definer View"): la vista del embudo se ejecutaba con
--   los permisos de su creador, saltándose la seguridad por filas. Pasa a
--   ejecutarse con los permisos de quien la consulta. El panel usa la clave de
--   servicio, así que sigue viéndolo todo; la clave pública deja de poder leerla.
-- 2-4 (WARN "Function Search Path Mutable"): las tres funciones de los
--   disparadores fijan su search_path para que nadie pueda colarles otra tabla
--   con el mismo nombre.
-- Los avisos "RLS Enabled No Policy" (INFO) son lo que queremos: tablas
--   cerradas a la clave pública y abiertas solo a la clave de servicio.
-- ============================================================

ALTER VIEW IF EXISTS public.charlas_v_embudo SET (security_invoker = on);
REVOKE ALL ON public.charlas_v_embudo FROM anon, authenticated;

ALTER FUNCTION public.charlas_touch() SET search_path = public;
ALTER FUNCTION public.charlas_nivel_por_estado() SET search_path = public;
ALTER FUNCTION public.charlas_log_estado() SET search_path = public;
