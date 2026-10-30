-- ============================================================
-- Sistema automático · carril charlas · FASE 2c: plan de noviembre y Obsidian al día (2026-10-30)
-- Ejecutar a mano en el SQL editor de Supabase, DESPUÉS de charlas-fase2b.sql. Idempotente.
-- ============================================================

-- Qué más se le ha ofrecido al centro y cuándo (show de Navidad, semana
-- cultural, charla a familias…). Pedido en el plan de noviembre.
ALTER TABLE charlas_centros ADD COLUMN IF NOT EXISTS otros_formatos text;

INSERT INTO charlas_config (clave, valor) VALUES
  ('espejo_nota_diaria', 'true'),          -- el espejo añade una línea "Charlas (sistema)" a la nota diaria del vault
  ('espejo_bandeja_diaria', 'true'),       -- y genera la nota "Bandeja — DD-MM-AAAA" con lo recibido, enviado y pendiente
  ('mail1_automatico_territorios', '[]'),  -- territorios donde el Mail 1 sale sin llamada previa (vacío = ninguno)
  ('mail1_por_dia', '15'),
  ('rastreo_activo', 'true'),              -- rastreo web de correos de contacto para centros sin responsable
  ('rastreo_por_ejecucion', '6')
ON CONFLICT (clave) DO NOTHING;

-- Rastreo web: qué se ha mirado ya de cada centro, para no repetir.
CREATE TABLE IF NOT EXISTS charlas_rastreo (
  centro_id uuid PRIMARY KEY REFERENCES charlas_centros(id) ON DELETE CASCADE,
  web text,
  paginas_vistas int NOT NULL DEFAULT 0,
  emails_encontrados jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{email, pista, pagina}]
  resultado text,                                          -- ok | sin_web | sin_emails | error
  error text,
  rastreado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE charlas_rastreo ENABLE ROW LEVEL SECURITY;
