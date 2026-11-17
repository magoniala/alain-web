-- ============================================================
-- Protocolo post-evento (2026-11-17) · scripts/crm/post-evento.mjs
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
--
-- Una fila por evento del vault (clave = nombre del fichero, o "serie:<ficha>"
-- para las sesiones recurrentes). Guarda qué tarjetas del protocolo se han
-- creado (D+1: /quetal + factura · D+30: plantear repetir) para no repetirlas.
-- Las tarjetas se crean el día que tocan, no antes: una tarjeta abierta
-- bloquearía al motor para esa ficha.
-- ============================================================

CREATE TABLE IF NOT EXISTS eventos_postventa (
  clave          text PRIMARY KEY,
  carril         text NOT NULL CHECK (carril IN ('magia', 'charlas')),
  nombre         text NOT NULL,
  fecha_evento   date NOT NULL,
  quetal_token   text,
  d1_tarea       uuid,
  d1_en          timestamptz,
  d1_omitido     text,          -- por qué no se creó (testimonio ya recibido, sin ficha…)
  d30_tarea      uuid,
  d30_en         timestamptz,
  d30_omitido    text,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eventos_postventa ENABLE ROW LEVEL SECURITY;  -- solo la service key

-- Hernani BHI (charla del 9-11): los testimonios ya se pidieron y llegaron por
-- correo (Txema, Laura, Naiara; ver «Testimonios charlas»). Sin /quetal; sí D+30.
INSERT INTO eventos_postventa (clave, carril, nombre, fecha_evento, d1_omitido)
VALUES ('Hernani BHI — 2026-11-09', 'charlas', 'Hernani BHI', '2026-11-09', 'testimonios ya recogidos por correo (12-11)')
ON CONFLICT (clave) DO NOTHING;
