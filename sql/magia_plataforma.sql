-- ============================================================
-- Plataforma de magia /magia-tailerrak — fase 1 (2026-11-09)
-- Ejecutar a mano en el SQL editor de Supabase ANTES de desplegar.
-- Idempotente: se puede ejecutar dos veces sin romper nada.
-- ============================================================
--
-- El QR de los librillos de los talleres lleva a /magia-tailerrak. Los juegos
-- de cada librillo van abiertos; el extra (el vaso) se desbloquea dejando el
-- email; lo demás (otros librillos, cursillos) irá con email + pago.

-- Quien deja su email en la plataforma (un adulto: padre, madre…).
CREATE TABLE IF NOT EXISTS magia_usuarios (
  email      text PRIMARY KEY,
  librillo   text,                       -- 6-7 | 8-10 | 11: el que eligió al entrar
  canal      text,                       -- por dónde llegó: librillo (QR del librillo)…
  idioma     text NOT NULL DEFAULT 'eu',
  -- Casilla marcada: es adulto y acepta recibir los correos de Alain.
  consentimiento_at timestamptz NOT NULL DEFAULT now(),
  -- Todavía NO se da de alta en newsletter_contactos: falta la secuencia de
  -- talleres (el puente antes de la diaria). Cuando exista, se dan de alta los
  -- que tengan esto vacío y se rellena.
  newsletter_alta_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lo que cada uno tiene desbloqueado además de su librillo (que va abierto).
-- contenido: opari-basoa (extra por email) · liburutxoa:8-10 (comprado) · …
CREATE TABLE IF NOT EXISTS magia_accesos (
  email      text NOT NULL REFERENCES magia_usuarios (email) ON DELETE CASCADE,
  contenido  text NOT NULL,
  origen     text NOT NULL DEFAULT 'email',   -- email | pago | regalo
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email, contenido)
);

-- Códigos de acceso de 6 cifras para entrar desde otro dispositivo.
-- Solo se guarda el hash. Valen 15 minutos y admiten 5 intentos.
CREATE TABLE IF NOT EXISTS magia_codigos (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       text NOT NULL,
  codigo_hash text NOT NULL,
  expira      timestamptz NOT NULL,
  intentos    int NOT NULL DEFAULT 0,
  usado       boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS magia_codigos_email ON magia_codigos (email, created_at DESC);

-- Sesiones abiertas (cookie magia_saioa). Solo se guarda el hash del token. 1 año.
CREATE TABLE IF NOT EXISTS magia_sesiones (
  token_hash text PRIMARY KEY,
  email      text NOT NULL REFERENCES magia_usuarios (email) ON DELETE CASCADE,
  expira     timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Solo el servidor (service key) toca estas tablas.
ALTER TABLE magia_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE magia_accesos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE magia_codigos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE magia_sesiones ENABLE ROW LEVEL SECURITY;
