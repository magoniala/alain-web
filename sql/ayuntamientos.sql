-- ============================================================
-- Vía Ayuntamientos (2026-11-20)
-- Prospección a los 251 ayuntamientos de Euskadi dentro del carril charlas.
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
-- Protocolo: vault, Vías/Ayuntamientos/00 Flujo ayuntamientos.md
-- ============================================================
--
-- Las fichas son filas de charlas_centros con tipo = 'ayuntamiento' (como las
-- 14 instituciones que ya había): mismo buzón, misma bandeja, mismo espejo al
-- vault (carpeta Instituciones/) y mismo aprendizaje.

-- Población (INE): ordena la cola del Mail 1 y permite un mínimo.
ALTER TABLE charlas_centros ADD COLUMN IF NOT EXISTS poblacion int;
CREATE INDEX IF NOT EXISTS charlas_centros_tipo_idx ON charlas_centros (tipo);

-- Investigación web de cada ayuntamiento (lib/ayto-investigar.ts): qué se miró,
-- qué se encontró y cuánto costó. Una fila por ficha; se rehace a los 120 días.
CREATE TABLE IF NOT EXISTS charlas_investigacion (
  centro_id uuid PRIMARY KEY REFERENCES charlas_centros(id) ON DELETE CASCADE,
  web text,
  paginas jsonb NOT NULL DEFAULT '[]'::jsonb,      -- URLs leídas
  hallazgos jsonb NOT NULL DEFAULT '{}'::jsonb,    -- lo que devolvió la IA (ya validado)
  resultado text,                                  -- concejal | buzon | sin_correo | sin_web | error
  error text,
  coste_usd numeric,
  investigado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE charlas_investigacion ENABLE ROW LEVEL SECURITY;

INSERT INTO charlas_config (clave, valor) VALUES
  ('ayto_activo', 'false'),              -- Mail 1 diario a ayuntamientos: apagado hasta que Alain lo encienda en el panel
  ('ayto_mail1_maximo_dia', '30'),       -- máximo de Mail 1 nuevos al día; el presupuesto de IA lo recorta (lib/ia-presupuesto.ts)
  ('ayto_poblacion_minima', '0'),        -- no escribir a municipios por debajo de esta población (0 = todos)
  ('ayto_investigar_activo', 'true'),    -- investigación web (no envía nada; gasta unos céntimos de IA)
  ('ayto_investigar_por_pasada', '2'),   -- ayuntamientos investigados en cada pasada del cron fuera de ventana
  ('ayto_localizar_por_dia', '3'),       -- tarjetas «localizar el correo» al día para los que la web no dio nada
  ('ayto_autoenvio', 'true'),            -- un tipo de mail que llega a la racha sale solo
  ('ayto_racha_automatico', '20'),       -- envíos seguidos sin corrección para pasar a automático
  ('ayto_tipos_manuales', '[]'),         -- tipos que Alain ha devuelto a manual aunque tengan racha
  ('ayto_autoenvio_tope_dia', '25')      -- máximo de correos automáticos al día en esta vía
ON CONFLICT (clave) DO NOTHING;

-- 20-11-2026 (noche): presupuesto de IA y envío automático en charlas y magia.
-- No hace falta ejecutar esto: el código usa estos valores si la clave no existe.
-- INSERT INTO charlas_config (clave, valor) VALUES ('ia_tope_mensual_usd','100'), ('ia_margen_usd','4'), ('autoenvio_activo','true'), ('autoenvio_tope_dia','25'), ('autoenvio_tipos_manuales','[]') ON CONFLICT (clave) DO NOTHING;
