-- Valoración presencial · fotos y vídeos desde la hoja (2026-11-03). Idempotente.
-- Bucket privado: solo se accede con la clave de servicio (URL firmadas desde el panel).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('valoraciones', 'valoraciones', false, 209715200)   -- 200 MB por fichero (vídeos)
ON CONFLICT (id) DO NOTHING;
