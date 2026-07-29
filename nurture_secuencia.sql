-- ============================================================
-- Secuencia de nurture (7 mails) sobre newsletter_contactos
-- Ejecutar a mano en el SQL editor de Supabase.
-- ============================================================

ALTER TABLE newsletter_contactos
  ADD COLUMN IF NOT EXISTS recibe_secuencia boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS posicion_secuencia int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS secuencia_completada boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_ultimo_mail_secuencia timestamptz;

CREATE TABLE IF NOT EXISTS secuencia_mails (
  posicion    int PRIMARY KEY,
  asunto      text,
  cuerpo_html text,
  activo      boolean DEFAULT false
);

-- ============================================================
-- Ampliación 2026-07-29: remitente por mail + recordatorio puntual
-- (secuencia de leads de Facebook Ads)
-- ============================================================

ALTER TABLE secuencia_mails
  ADD COLUMN IF NOT EXISTS remitente text;

ALTER TABLE newsletter_contactos
  ADD COLUMN IF NOT EXISTS recordatorio_valoracion_enviado boolean DEFAULT false;
