-- /quetal: más opciones de permiso de publicación y fuera «No publicable»
-- (decisión de Alain, 23-11-2026). Nuevas: «nombre» (nombre y entidad, sin
-- cargo), «iniciales» (iniciales, cargo y entidad) y «cargo» (cargo y entidad,
-- sin nombre). «no» se queda en el CHECK solo por las respuestas antiguas; el
-- formulario ya no lo ofrece. Aplicar ANTES de desplegar: sin esto, quien
-- elija una opción nueva no podrá enviar el formulario.

ALTER TABLE feedback_organizadores DROP CONSTRAINT IF EXISTS feedback_organizadores_permiso_publicacion_check;
ALTER TABLE feedback_organizadores ADD CONSTRAINT feedback_organizadores_permiso_publicacion_check
  CHECK (permiso_publicacion IN ('completo','nombre','iniciales','cargo','entidad','anonimo','no'));
