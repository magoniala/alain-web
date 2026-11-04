-- ============================================================
-- Secuencia nueva de tumisión: 9 mails, ES/EU (2026-10-29)
-- Fase 6 de /admin → Embudos. Se crea DESACTIVADA: no envía nada.
-- Ejecutar a mano en el SQL editor de Supabase.
-- ============================================================
--
-- Mail 1 al momento del alta; mails 2–9, uno al día a las 21:00 (Madrid).
-- Durante la secuencia la familia no recibe la newsletter diaria; al
-- terminar, pasa a recibirla. La enviará el motor nuevo (fase 4); hasta su
-- activación, prevista el 18-11, el embudo «tumision» sigue en «mision».
--
-- Los textos se cargan en /admin → Nurture → Mails → «Tumisión · 9 días».

-- Motor nuevo: «generico» (el cron único de la fase 4).
ALTER TABLE secuencias DROP CONSTRAINT IF EXISTS secuencias_motor_check;
ALTER TABLE secuencias ADD CONSTRAINT secuencias_motor_check CHECK (motor IN ('nurture', 'legacy', 'unico', 'generico'));

-- Programación estructurada, que leerá el motor nuevo.
--   hora_envio: hora de Madrid de los mails diarios (el primero sale al alta).
--   modo: lo que hace el MOTOR NUEVO con la secuencia. off = no la toca ·
--         sombra = calcula y registra sin enviar · prueba = solo a contactos
--         de prueba · activo = envía. Nurture, mision y comodin quedan en
--         off porque, hasta la fase 4, las siguen enviando sus crons de siempre.
ALTER TABLE secuencias ADD COLUMN IF NOT EXISTS hora_envio time;
ALTER TABLE secuencias ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'off'
  CHECK (modo IN ('off', 'sombra', 'prueba', 'activo'));

UPDATE secuencias SET hora_envio = '14:30' WHERE slug = 'nurture' AND hora_envio IS NULL;

INSERT INTO secuencias (slug, nombre, motor, programacion, idiomas, al_terminar, logica_hoja_ruta, activa, hora_envio, modo, notas)
VALUES (
  'tumision',
  'Tumisión · 9 días',
  'generico',
  'Mail 1 al momento; mails 2–9 uno al día a las 21:00',
  '{es,eu}',
  'newsletter',
  false,
  false,
  '21:00',
  'off',
  'Sustituye a «mision» para las altas nuevas desde su activación (prevista el 18-11-2026). Quien esté a medias en «mision» la termina.'
)
ON CONFLICT (slug) DO NOTHING;
