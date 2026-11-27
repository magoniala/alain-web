-- ============================================================
-- Pista del ayuntamiento para los centros de su municipio (27-11-2026)
-- Encargo: vault, 01 - PROYECTOS/🤖 Sistema automático/2026-11-23 Encargo — respuestas de
-- ayuntamientos que derivan a centros.md · código: lib/ayto-municipio.ts
-- Ejecutar a mano en el SQL editor de Supabase. Idempotente.
-- ============================================================
--
-- Lo que un ayuntamiento dice que sirve para sus centros (p. ej. Beasain: "la subvención
-- la piden los centros"). Se guarda con el botón «Guardar para los centros» de la tarjeta
-- del ayuntamiento, se copia al Registro de cada centro del municipio y se enseña en sus
-- tarjetas. El espejo la saca al frontmatter de la ficha del ayuntamiento (Instituciones/).

ALTER TABLE charlas_centros ADD COLUMN IF NOT EXISTS pista_para_centros text;

-- Beasain (recado de Gazteria del 23-11-2026), para que salga ya en las tarjetas de sus centros.
-- Las líneas en el Registro de sus tres centros ya están desde el 23-11.
UPDATE charlas_centros
   SET pista_para_centros = 'Gazteria (gazteria@beasain.eus): el ayuntamiento tiene una subvención para pagar estas actividades, pero la piden los centros: el centro elige y hace la actividad y luego la solicita. Decirlo al escribir al centro (la puede cubrir la subvención municipal).',
       actualizado_por = 'manual'
 WHERE tipo = 'ayuntamiento' AND nombre = 'Ayuntamiento de Beasain' AND pista_para_centros IS NULL;

-- Comprobación de la regla del Mail 1: charlas hechas y cobradas en los últimos 12 meses.
-- SELECT e.nombre, c.localidad, e.fecha_evento, e.fecha_cobro, e.estado_evento
--   FROM charlas_eventos e JOIN charlas_centros c ON c.id = e.centro_id
--  WHERE e.fecha_cobro IS NOT NULL AND e.fecha_evento BETWEEN current_date - 365 AND current_date;
