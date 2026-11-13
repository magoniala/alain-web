-- ============================================================
-- Motor de la secuencia tumisión (2026-11-13) · lib/tumision.ts
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente: se puede
-- ejecutar aunque sql/secuencia_tumision.sql ya estuviera hecho.
-- NO activa nada: deja tumisión en modo 'off'.
-- ============================================================

-- 1) Interruptor y hora en la tabla secuencias (lo de secuencia_tumision.sql).
ALTER TABLE secuencias DROP CONSTRAINT IF EXISTS secuencias_motor_check;
ALTER TABLE secuencias ADD CONSTRAINT secuencias_motor_check CHECK (motor IN ('nurture', 'legacy', 'unico', 'generico'));
ALTER TABLE secuencias ADD COLUMN IF NOT EXISTS hora_envio time;
ALTER TABLE secuencias ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'off'
  CHECK (modo IN ('off', 'sombra', 'prueba', 'activo'));

INSERT INTO secuencias (slug, nombre, motor, programacion, idiomas, al_terminar, logica_hoja_ruta, activa, hora_envio, modo, notas)
VALUES ('tumision', 'Tumisión · 9 días', 'generico', '', '{es,eu}', 'newsletter', false, false, '19:15', 'off', '')
ON CONFLICT (slug) DO NOTHING;

UPDATE secuencias
SET hora_envio = '19:15',
    programacion = 'Mail 1 al momento (tarjeta) o a las 19:15 (plataforma de los librillos); los siguientes, uno al día a las 19:15. Un mail inactivo se salta.',
    notas = 'Tarjeta (/tumision) y plataforma (/magia-tailerrak). Interruptor: modo (off / prueba / activo). Al terminar, a la newsletter desde el día siguiente. Quien esté a medias en «mision» la termina.'
WHERE slug = 'tumision';

-- 2) Estado de cada persona dentro de la secuencia (en mision_contactos, donde
--    ya actúan la baja y el cambio de idioma).
ALTER TABLE mision_contactos ADD COLUMN IF NOT EXISTS canal text;
ALTER TABLE mision_contactos ADD COLUMN IF NOT EXISTS tumision_pos integer;               -- próximo mail que le toca (null = no está dentro)
ALTER TABLE mision_contactos ADD COLUMN IF NOT EXISTS tumision_proximo timestamptz;       -- cuándo
ALTER TABLE mision_contactos ADD COLUMN IF NOT EXISTS tumision_enviando_desde timestamptz; -- candado contra envíos dobles
ALTER TABLE mision_contactos ADD COLUMN IF NOT EXISTS tumision_ultimo_envio timestamptz;
ALTER TABLE mision_contactos ADD COLUMN IF NOT EXISTS tumision_fin_at timestamptz;        -- terminó y pasó a la newsletter
CREATE INDEX IF NOT EXISTS mision_contactos_tumision_proximo_idx
  ON mision_contactos (tumision_proximo) WHERE tumision_pos IS NOT NULL;

-- Comprobación: debe salir una fila con modo 'off' y hora 19:15.
SELECT slug, motor, modo, hora_envio FROM secuencias WHERE slug = 'tumision';
