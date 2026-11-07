-- ============================================================
-- /arreta · pregunta 1 pasa a ser «horas de móvil» (2026-11-07)
-- Ejecutar a mano en el SQL editor de Supabase, ANTES de hacer push.
-- Idempotente. Compatible hacia atrás: el código anterior (que envía
-- `probatu`) sigue funcionando después de ejecutarlo.
-- ============================================================
-- Horas de móvil al día: la media actual y la que le gustaría tener.
-- Siguen siendo anónimas: solo dos números, sin identificador.
ALTER TABLE arreta_respuestas ADD COLUMN IF NOT EXISTS ordu_orain numeric(3,1) CHECK (ordu_orain >= 0 AND ordu_orain <= 24);
ALTER TABLE arreta_respuestas ADD COLUMN IF NOT EXISTS ordu_nahi  numeric(3,1) CHECK (ordu_nahi  >= 0 AND ordu_nahi  <= 24);

-- `probatu` ya no se pregunta; la columna se conserva (puede ser NULL).
ALTER TABLE arreta_respuestas ALTER COLUMN probatu DROP NOT NULL;
