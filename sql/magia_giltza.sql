-- ============================================================
-- Plataforma /magia-tailerrak: palabra mágica por librillo (2026-11-09)
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
-- ============================================================
--
-- El QR es el mismo en todos los librillos, así que la web no sabe cuál tiene
-- cada familia. Alain escribe a mano una palabra en cada ejemplar; la página
-- de ese librillo no se abre sin ella. Se pone y se cambia en /admin ›
-- Magia-tailerrak (columna vacía = librillo abierto a cualquiera).
-- Se compara sin mayúsculas, tildes, espacios ni signos.

ALTER TABLE magia_liburutxoak ADD COLUMN IF NOT EXISTS giltza text;
