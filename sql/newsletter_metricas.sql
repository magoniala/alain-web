-- ============================================================
-- Métricas por mail de la newsletter diaria (2026-11-18)
-- Bucle de aprendizaje de la newsletter. Ejecutar a mano en Supabase.
-- La rellena /api/newsletter/metricas (lib/newsletter-metricas.ts).
-- ============================================================
ALTER TABLE newsletter_campanas
  ADD COLUMN IF NOT EXISTS metricas    jsonb,
  ADD COLUMN IF NOT EXISTS metricas_en timestamptz;
