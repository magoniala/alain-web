-- ============================================================
-- Preventa de las masterclasses de diciembre 2026 (Entrenatzaile) · 26-11-2026
-- Ejecutar a mano en el SQL editor de Supabase ANTES de desplegar.
-- Idempotente: se puede ejecutar dos veces sin romper nada.
-- ============================================================
--
-- Reglas en lib/preventa-reglas.ts. Lógica en lib/preventa.ts.
-- El webhook de Stripe (app/api/stripe/webhook) es la única fuente de verdad
-- del pago, igual que con la Hoja de Ruta: una fila pasa a 'pagado' solo ahí.

-- Una fila por intento de compra (sesión de Stripe Checkout).
-- producto: B (7 €) · A (17 €, B de regalo) · subida (10 €, de B a A).
CREATE TABLE IF NOT EXISTS preventa_compras (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  text NOT NULL,
  nombre                 text,
  idioma                 text NOT NULL DEFAULT 'es',          -- es | eu
  producto               text NOT NULL CHECK (producto IN ('B', 'A', 'subida')),
  importe_cent           int  NOT NULL,
  estado                 text NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente', 'pagado', 'devuelto', 'devuelto_parcial', 'expirado')),
  devuelto_cent          int  NOT NULL DEFAULT 0,
  -- Compra de prueba de Alain (correo en preventa_config.correos_prueba):
  -- no cuenta para el umbral ni recibe el aviso del recuento.
  prueba                 boolean NOT NULL DEFAULT false,
  stripe_session_id      text UNIQUE,
  stripe_payment_intent  text,
  pagado_en              timestamptz,
  -- Casilla aparte y sin marcar: alta en la newsletter diaria.
  -- Se guarda el valor, la hora y el texto literal que se mostró.
  newsletter_ok          boolean NOT NULL DEFAULT false,
  newsletter_texto       text,
  newsletter_at          timestamptz,
  -- Lo que se le enseñó antes de pagar (precio, entrega, desistimiento), literal.
  info_previa            text,
  confirmacion_enviada   boolean NOT NULL DEFAULT false,
  confirmacion_error     text,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS preventa_compras_email ON preventa_compras (lower(email));
CREATE INDEX IF NOT EXISTS preventa_compras_estado ON preventa_compras (estado);

-- Cada devolución hecha desde el panel, con fecha y motivo.
-- motivo: umbral_no (no se llegó a 3) · diferencia_a (B llega, A no) ·
--         desistimiento · manual
CREATE TABLE IF NOT EXISTS preventa_devoluciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id        uuid NOT NULL REFERENCES preventa_compras (id),
  importe_cent     int  NOT NULL,
  motivo           text NOT NULL,
  nota             text,
  stripe_refund_id text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Familia y amigos: compran, pero no cuentan para el umbral. Los marca Alain.
CREATE TABLE IF NOT EXISTS preventa_excluidos (
  email      text PRIMARY KEY,
  motivo     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Correos ya enviados, para no mandar dos veces el mismo.
-- clave: recuento · entrega_B · entrega_A
CREATE TABLE IF NOT EXISTS preventa_envios (
  clave      text NOT NULL,
  email      text NOT NULL,
  error      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clave, email)
);

-- Formulario de desistimiento de la web.
CREATE TABLE IF NOT EXISTS preventa_desistimientos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  nombre     text,
  mensaje    text,
  idioma     text NOT NULL DEFAULT 'es',
  atendido   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ajustes que se cambian desde /admin → Preventa:
--   video_B, video_A     URL del reproductor (embed) de cada masterclass
--   correos_prueba       correos de Alain que pueden comprar antes de abrir (separados por comas)
--   prueba_fase          B | A: la fase que ven esos correos
CREATE TABLE IF NOT EXISTS preventa_config (
  clave      text PRIMARY KEY,
  valor      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Solo el servidor (service key) toca estas tablas.
ALTER TABLE preventa_compras        ENABLE ROW LEVEL SECURITY;
ALTER TABLE preventa_devoluciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE preventa_excluidos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE preventa_envios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE preventa_desistimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE preventa_config         ENABLE ROW LEVEL SECURITY;
