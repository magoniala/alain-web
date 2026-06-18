import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  const formData = await req.formData();
  const password = formData.get("password") as string;
  const file = formData.get("file") as File | null;

  if (password !== process.env.NEWSLETTER_PASSWORD) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!file) {
    return NextResponse.json({ error: "Falta archivo." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Formato no permitido." }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("newsletter-images")
    .upload(filename, buffer, { contentType: file.type });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage
    .from("newsletter-images")
    .getPublicUrl(filename);

  return NextResponse.json({ url: publicUrl });
}
