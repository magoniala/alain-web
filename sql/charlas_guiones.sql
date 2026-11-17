-- ============================================================
-- Guiones de llamada de Charlas (2026-11-17) · lib/charlas-guiones.ts
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
--
-- El texto vive en el vault (Vías/Charlas/Guiones/*.md) y manda allí: la
-- pasada horaria del espejo (scripts/charlas/guiones-vault.mjs) sube cada
-- guion entero aquí. El panel lo trocea al leerlo. No se edita a mano.
-- ============================================================

CREATE TABLE IF NOT EXISTS charlas_guiones (
  clave          text PRIMARY KEY,          -- 'conserjeria', 'reenvio', 'seguimiento-dossier', 'cerrar-fecha', 'objeciones'
  fichero        text NOT NULL,             -- nombre del .md en Guiones/
  contenido_md   text NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE charlas_guiones ENABLE ROW LEVEL SECURITY;  -- solo la service key (panel y espejo)
