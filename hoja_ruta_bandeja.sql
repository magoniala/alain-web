-- ============================================================
-- Hoja de Ruta · bandeja de reservas en el panel (3-11-2026). Idempotente.
--
-- Cuando una reserva queda confirmada (gratis al elegir hueco; de pago al
-- llegar el pago) aparece en el panel con un botón de WhatsApp; Alain marca
-- "Ya lo he enviado" y queda apuntado aquí (y el espejo lo lleva a la ficha
-- del lead en Obsidian). El aviso al móvil sale desde el cron.
-- ============================================================
ALTER TABLE hoja_ruta_reservas
  ADD COLUMN IF NOT EXISTS wa_confirmacion_en   timestamptz,   -- Alain mandó el WhatsApp de confirmación
  ADD COLUMN IF NOT EXISTS wa_confirmacion_nota text,          -- si cambió algo del mensaje
  ADD COLUMN IF NOT EXISTS panel_notificada_en  timestamptz,   -- push al móvil enviado
  ADD COLUMN IF NOT EXISTS panel_descartada_en  timestamptz,   -- Alain la quitó de la bandeja sin WhatsApp (p. ej. ya habló con la persona)
  ADD COLUMN IF NOT EXISTS panel_nota           text;

CREATE INDEX IF NOT EXISTS hoja_ruta_reservas_bandeja_idx ON hoja_ruta_reservas (hueco_en DESC) WHERE hueco IS NOT NULL AND wa_confirmacion_en IS NULL;
ALTER TABLE hoja_ruta_reservas ADD COLUMN IF NOT EXISTS espejo_vault_en timestamptz;  -- el espejo del Mac ya lo apuntó en la ficha del lead

-- Las reservas anteriores a la bandeja ya tuvieron su WhatsApp por el flujo del
-- correo: se marcan como hechas para que no salgan en "Te toca" ni manden aviso.
UPDATE hoja_ruta_reservas
   SET wa_confirmacion_en   = COALESCE(hueco_en, creado_en),
       wa_confirmacion_nota = 'anterior a la bandeja del panel (3-11-2026)',
       panel_notificada_en  = now(),
       espejo_vault_en      = now()
 WHERE hueco IS NOT NULL AND wa_confirmacion_en IS NULL AND panel_descartada_en IS NULL
   AND creado_en < '2026-11-03T15:00:00+01:00';
