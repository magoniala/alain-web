-- Config de la landing /magic: flag manual para ocultar el bloque de
-- horarios (Bloque 0) y testimonios (desactivados hasta rellenarlos).
-- Ejecutar una sola vez en el SQL editor de Supabase.

create table if not exists magic_config (
  landing text primary key default 'magic',
  hide_schedule boolean not null default false,
  testimonials_enabled boolean not null default false,
  testimonials jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into magic_config (landing) values ('magic')
on conflict (landing) do nothing;
