import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import {
  ahora,
  db,
  devolver,
  devolverSegunRecuento,
  guardarConfig,
  leerConfig,
  pendientesSegunRecuento,
  recuentoCongelado,
  todasLasCompras,
  excluidos,
  type MotivoDevolucion,
} from "@/lib/preventa";
import { faseEn, normalizarEmail, resultado, FECHAS } from "@/lib/preventa-reglas";

// Panel → Preventa: compras, contador n de 3, familia y amigos, devoluciones,
// recuento, desistimientos y ajustes (vídeos y correos de prueba).

const CLAVES_CONFIG = ["video_A", "video_B", "correos_prueba", "prueba_fase"] as const;
const MOTIVOS: MotivoDevolucion[] = ["umbral_no", "diferencia_a", "desistimiento", "manual"];

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const [compras, fuera, congelado, pendientes, cfg, desist, devs, envios] = await Promise.all([
      todasLasCompras(),
      excluidos(),
      recuentoCongelado(),
      pendientesSegunRecuento(),
      leerConfig(),
      db().from("preventa_desistimientos").select("*").order("created_at", { ascending: false }),
      db().from("preventa_devoluciones").select("*").order("created_at", { ascending: false }),
      db().from("preventa_envios").select("clave"),
    ]);
    const enviosPorClave: Record<string, number> = {};
    for (const e of envios.data ?? []) enviosPorClave[e.clave] = (enviosPorClave[e.clave] ?? 0) + 1;
    return NextResponse.json({
      fase: faseEn(ahora()),
      fechas: FECHAS,
      cuenta: resultado(compras, fuera),
      recuento: congelado,
      pendientes: pendientes.map((p) => ({ compra_id: p.compra.id, email: p.compra.email, importe: p.importe, motivo: p.motivo })),
      compras: compras.filter((c) => c.estado !== "pendiente" && c.estado !== "expirado"),
      intentos: compras.filter((c) => c.estado === "pendiente" || c.estado === "expirado").length,
      excluidos: fuera,
      desistimientos: desist.data ?? [],
      devoluciones: devs.data ?? [],
      envios: enviosPorClave,
      config: Object.fromEntries(CLAVES_CONFIG.map((k) => [k, cfg[k] ?? ""])),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    switch (b.accion) {
      case "excluir": {
        const email = normalizarEmail(String(b.email ?? ""));
        if (!email) throw new Error("Falta el correo.");
        const { error } = await db().from("preventa_excluidos").upsert({ email, motivo: b.motivo ?? "familia o amigo" });
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "incluir": {
        const { error } = await db().from("preventa_excluidos").delete().eq("email", normalizarEmail(String(b.email ?? "")));
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "devolver": {
        const motivo = MOTIVOS.includes(b.motivo) ? (b.motivo as MotivoDevolucion) : "manual";
        const r = await devolver(String(b.compra_id), Number(b.importe_cent), motivo, b.nota ?? null);
        return NextResponse.json({ ok: true, ...r });
      }
      case "devolver_recuento": {
        if (!(await recuentoCongelado())) throw new Error("Todavía no se ha hecho el recuento (jue 10-dic, 9:00).");
        return NextResponse.json({ ok: true, ...(await devolverSegunRecuento()) });
      }
      case "config": {
        if (!(CLAVES_CONFIG as readonly string[]).includes(b.clave)) throw new Error("Ajuste desconocido.");
        await guardarConfig(b.clave, typeof b.valor === "string" ? b.valor.trim() : null);
        return NextResponse.json({ ok: true });
      }
      case "desistimiento_atendido": {
        const { error } = await db().from("preventa_desistimientos").update({ atendido: true }).eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      default:
        throw new Error("Acción desconocida.");
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
