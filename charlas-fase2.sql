-- ============================================================
-- Sistema automático · carril charlas · FASE 2a: app móvil y urgencia (2026-10-30)
-- Ejecutar a mano en el SQL editor de Supabase, DESPUÉS de charlas-fase1.sql.
-- Idempotente.
-- ============================================================

-- Suscripciones push del panel instalado como app (una por dispositivo).
CREATE TABLE IF NOT EXISTS charlas_push_suscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  claves jsonb NOT NULL,                  -- {p256dh, auth}
  dispositivo text,                       -- user agent abreviado, para reconocerlo
  creado_en timestamptz NOT NULL DEFAULT now(),
  ultimo_envio timestamptz,
  fallos int NOT NULL DEFAULT 0           -- se borra al llegar a 5 (suscripción caducada)
);

-- Urgencia de cada tarea: 3 = ahora (rojo), 2 = hoy (naranja), 1 = cuando puedas (verde).
ALTER TABLE charlas_tareas ADD COLUMN IF NOT EXISTS urgencia int NOT NULL DEFAULT 1 CHECK (urgencia BETWEEN 1 AND 3);
ALTER TABLE charlas_tareas ADD COLUMN IF NOT EXISTS urgencia_motivo text;
ALTER TABLE charlas_tareas ADD COLUMN IF NOT EXISTS notificada_en timestamptz;

CREATE INDEX IF NOT EXISTS charlas_tareas_urgencia_idx ON charlas_tareas (estado, urgencia DESC, creado_en);

INSERT INTO charlas_config (clave, valor) VALUES
  ('push_activo', 'true'),
  ('push_resumen_minimo', '1')            -- a partir de cuántas tareas nuevas de urgencia baja se manda un resumen
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE charlas_push_suscripciones ENABLE ROW LEVEL SECURITY;
