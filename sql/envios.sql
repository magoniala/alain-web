-- ============================================================
-- Registro de envíos de secuencias (2026-10-26)
-- Fase 1 de /admin → Embudos.
-- Ejecutar a mano en el SQL editor de Supabase.
-- ============================================================
--
-- Una fila por cada mail de secuencia que sale (o que Mailjet rechaza):
-- nurture (M0–M8, recordatorio −1, ficha −2, transición −3), mision y
-- comodin (mails 1–3) y el mail del show de comodin. La newsletter diaria
-- todavía no se registra.
--
-- La escribe sendEmail() a partir de la etiqueta de campaña de Mailjet que
-- ya llevaba cada envío, así que no hubo que tocar el cron de nurture. Si
-- esta tabla no existe, el envío sale igual: el registro nunca bloquea un
-- mail.

CREATE TABLE IF NOT EXISTS envios (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enviado_en timestamptz NOT NULL DEFAULT now(),

  email       text NOT NULL,
  -- newsletter_contactos.id cuando el envío lo conoce (nurture); null en
  -- mision y comodin, que se identifican por email.
  contacto_id uuid,

  secuencia text NOT NULL,   -- nurture | mision | comodin | comodin_show
  posicion  int  NOT NULL,   -- 0–8, o −1 recordatorio, −2 ficha, −3 transición
  idioma    text,            -- es | eu; null si el envío no lo sabe (nurture va siempre en es)
  campana   text NOT NULL,   -- la etiqueta CustomCampaign de Mailjet, tal cual

  asunto    text,
  remitente text,

  -- aceptado = Mailjet lo ha aceptado para enviar (no garantiza entrega:
  -- eso llegará con el webhook de eventos, fase 7). error = rechazado o
  -- fallo de red; el detalle va en `error`.
  estado text NOT NULL CHECK (estado IN ('aceptado', 'error')),
  error  text,

  mailjet_uuid text,
  mailjet_id   text
);

CREATE INDEX IF NOT EXISTS envios_email_idx      ON envios (lower(email));
CREATE INDEX IF NOT EXISTS envios_secuencia_idx  ON envios (secuencia, posicion);
CREATE INDEX IF NOT EXISTS envios_enviado_en_idx ON envios (enviado_en DESC);
CREATE INDEX IF NOT EXISTS envios_contacto_idx   ON envios (contacto_id) WHERE contacto_id IS NOT NULL;

-- Sin políticas: solo la service key escribe y lee.
ALTER TABLE envios ENABLE ROW LEVEL SECURITY;
