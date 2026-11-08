-- ============================================================
-- /arreta · nota de 1 a 5 a la charla, pregunta 1 y obligatoria (2026-11-08)
-- Ejecutar a mano en el SQL editor de Supabase, ANTES de hacer push.
-- Idempotente. Compatible hacia atrás: el código anterior sigue funcionando.
-- ============================================================
-- Sustituye a la nota en post-it en directo (decisión de Alain, 8-nov).
-- Sigue siendo anónima: un solo número, sin identificador.
ALTER TABLE arreta_respuestas ADD COLUMN IF NOT EXISTS nota smallint CHECK (nota >= 1 AND nota <= 5);
