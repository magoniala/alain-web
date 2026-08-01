import { NextResponse } from "next/server";
import { getMagicConfig, setMagicConfig, type Testimonial } from "@/lib/magic-config";
import { requireAdminAuth as auth } from "@/lib/admin-auth";

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const config = await getMagicConfig();
  return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } });
}

function isTestimonialArray(v: unknown): v is Testimonial[] {
  return (
    Array.isArray(v) &&
    v.every((t) => t && typeof t === "object" && typeof t.quote === "string" && typeof t.author === "string")
  );
}

export async function PATCH(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const patch: Partial<{ hideSchedule: boolean; testimonialsEnabled: boolean; testimonials: Testimonial[] }> = {};
  if (typeof body.hideSchedule === "boolean") patch.hideSchedule = body.hideSchedule;
  if (typeof body.testimonialsEnabled === "boolean") patch.testimonialsEnabled = body.testimonialsEnabled;
  if (isTestimonialArray(body.testimonials)) patch.testimonials = body.testimonials;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  await setMagicConfig(patch);
  return NextResponse.json({ ok: true });
}
