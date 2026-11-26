-- Preventa de la masterclass · cambio de modelo del 26-11-2026
-- (se vende solo "Que la espalda no te pare" a 17 €; del 1 al 4-dic con
-- "Por dónde empezar" de regalo). Ejecutar a mano en el SQL editor de Supabase
-- ANTES del push. Idempotente. No afecta a la web que está en producción.
ALTER TABLE preventa_compras ADD COLUMN IF NOT EXISTS con_bonus boolean NOT NULL DEFAULT false;
