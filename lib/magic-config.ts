import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export interface Testimonial {
  quote: string;
  author: string;
}

export interface MagicConfig {
  hideSchedule: boolean;
  testimonialsEnabled: boolean;
  testimonials: Testimonial[];
}

const DEFAULT_CONFIG: MagicConfig = {
  hideSchedule: false,
  testimonialsEnabled: false,
  testimonials: [],
};

export async function getMagicConfig(): Promise<MagicConfig> {
  const { data } = await supabase
    .from("magic_config")
    .select("hide_schedule, testimonials_enabled, testimonials")
    .eq("landing", "magic")
    .single();

  if (!data) return DEFAULT_CONFIG;
  return {
    hideSchedule: !!data.hide_schedule,
    testimonialsEnabled: !!data.testimonials_enabled,
    testimonials: Array.isArray(data.testimonials) ? data.testimonials : [],
  };
}

export async function setMagicConfig(
  patch: Partial<{ hideSchedule: boolean; testimonialsEnabled: boolean; testimonials: Testimonial[] }>
) {
  const update: Record<string, unknown> = { landing: "magic", updated_at: new Date().toISOString() };
  if (patch.hideSchedule !== undefined) update.hide_schedule = patch.hideSchedule;
  if (patch.testimonialsEnabled !== undefined) update.testimonials_enabled = patch.testimonialsEnabled;
  if (patch.testimonials !== undefined) update.testimonials = patch.testimonials;
  await supabase.from("magic_config").upsert(update, { onConflict: "landing" });
}

// El bloque de horarios de Gante es una promo puntual (6-8 de agosto de
// 2026) y debe desaparecer solo a partir del 9 de agosto, 00:00 hora de
// Bruselas. Vercel corre en UTC, así que la fecha se calcula explícitamente
// en esa zona horaria en vez de compararla con la hora del servidor.
const SCHEDULE_HIDE_FROM = "2026-08-09";

function brusselsDateString(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Brussels" }).format(d);
}

export function isScheduleBlockInDateRange(now: Date = new Date()): boolean {
  return brusselsDateString(now) < SCHEDULE_HIDE_FROM;
}
