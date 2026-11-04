-- ============================================================
-- COLA B — mails de reserva sin fecha
--
-- Viven en newsletter_campanas con estado = 'cola' y
-- programado_para = NULL. El cron los saca por orden (orden_cola)
-- a las 19:15 (Europe/Madrid) los días en que no ha salido ni
-- está programado ningún otro envío.
--
-- Estados de newsletter_campanas tras esto:
--   'cola' | 'programado' | 'enviando' | 'enviado' | 'cancelado'
-- ============================================================

ALTER TABLE newsletter_campanas
  ALTER COLUMN programado_para DROP NOT NULL;

ALTER TABLE newsletter_campanas
  ADD COLUMN IF NOT EXISTS orden_cola int;

-- Para sacar el primero de la cola sin escanear toda la tabla
CREATE INDEX IF NOT EXISTS newsletter_campanas_cola_idx
  ON newsletter_campanas (orden_cola)
  WHERE estado = 'cola';
