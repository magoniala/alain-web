import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { generarAvisos, copiarSemana, semanaMarkdown, sumarDias, type Aviso, type Sesion } from "@/lib/ent";
import { aprobarPropuesta, proponerSiguiente, type Propuesta } from "@/lib/ent-ia";

// App de Entrenatzaile · fase 7a (lado de Alain).
//
//   GET  /api/admin/ent                         → clientes con su plan activo y la semana en curso
//   GET  /api/admin/ent?cliente=<id>            → cliente, plan activo, sesiones tipo y semanas
//   GET  /api/admin/ent?semana=<id>             → semana con sesiones, ejercicios, avisos y registros
//   GET  /api/admin/ent?semana=<id>&formato=md  → la semana en Markdown (formato de las notas del vault)
//   POST /api/admin/ent { accion, … }           → ver ACCIONES abajo

export const dynamic = "force-dynamic";

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });

const EDITABLE = {
  ent_clientes: ["email", "telefono", "idioma", "estado", "zonas_riesgo", "reglas", "material", "aviso_canal", "ficha_vault", "notas", "token"],
  ent_planes: ["nombre", "inicio", "fin", "frecuencia", "metas", "fases", "reglas_carga"],
  ent_semanas: ["titulo", "notas", "rir_objetivo", "fase", "lunes", "resumen"],
  ent_sesiones: ["nombre", "clave", "fecha", "duracion_min", "foco", "calentamiento", "notas", "estado", "sesion_tipo_id"],
  ent_ejercicios: ["nombre", "series", "reps", "carga", "tempo", "descanso", "rir", "notas", "video", "superserie", "campos", "orden"],
  ent_avisos: ["texto", "programado_para", "estado", "canal"],
} as const;

function filtrar(tabla: keyof typeof EDITABLE, campos: Record<string, unknown>) {
  const ok = new Set<string>(EDITABLE[tabla]);
  return Object.fromEntries(Object.entries(campos ?? {}).filter(([k]) => ok.has(k)));
}

async function detalleSemana(id: string) {
  const sb = supabaseCharlas();
  const [semana, sesiones, avisos] = await Promise.all([
    sb.from("ent_semanas").select("*").eq("id", id).single(),
    sb.from("ent_sesiones").select("*, ejercicios:ent_ejercicios(*)").eq("semana_id", id).order("fecha"),
    sb.from("ent_avisos").select("*").eq("semana_id", id).order("programado_para"),
  ]);
  if (semana.error) throw new Error(semana.error.message);
  const ses = ((sesiones.data ?? []) as Sesion[]).map((s) => ({ ...s, ejercicios: (s.ejercicios ?? []).sort((a, b) => a.orden - b.orden) }));
  const ids = ses.map((s) => s.id);
  const [series, formularios] = ids.length
    ? await Promise.all([
        sb.from("ent_series").select("*").in("sesion_id", ids).order("serie"),
        sb.from("ent_formularios").select("*").in("sesion_id", ids).order("creado_en"),
      ])
    : [{ data: [] }, { data: [] }];
  // Fotos de los formularios: URL firmada 1 h (bucket privado).
  const forms = (formularios.data ?? []) as { respuestas?: { fotos?: string[] } }[];
  const rutas = forms.flatMap((f) => f.respuestas?.fotos ?? []);
  const firmadas: Record<string, string> = {};
  if (rutas.length) {
    const { data } = await sb.storage.from("ent-fotos").createSignedUrls(rutas, 3600);
    for (const x of data ?? []) if (x.path && x.signedUrl) firmadas[x.path] = x.signedUrl;
  }
  return { semana: semana.data, sesiones: ses, avisos: (avisos.data ?? []) as Aviso[], series: series.data ?? [], formularios: forms.map((f) => ({ ...f, fotos_url: (f.respuestas?.fotos ?? []).map((r) => firmadas[r]).filter(Boolean) })) };
}

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const sb = supabaseCharlas();
  const url = new URL(req.url);
  try {
    const semanaId = url.searchParams.get("semana");
    if (semanaId) {
      const d = await detalleSemana(semanaId);
      if (url.searchParams.get("formato") === "md") {
        return new NextResponse(semanaMarkdown(d.semana, d.sesiones, d.avisos), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
      }
      return NextResponse.json(d);
    }

    const clienteId = url.searchParams.get("cliente");
    if (clienteId) {
      const [cliente, planes] = await Promise.all([
        sb.from("ent_clientes").select("*").eq("id", clienteId).single(),
        sb.from("ent_planes").select("id, nombre, inicio, fin, frecuencia, activo, metas, fases, reglas_carga, nota_vault").eq("cliente_id", clienteId).order("inicio", { ascending: false }),
      ]);
      if (cliente.error) return NextResponse.json({ error: cliente.error.message }, { status: 404 });
      const plan = (planes.data ?? []).find((p) => p.activo) ?? planes.data?.[0] ?? null;
      const [tipos, semanas] = plan
        ? await Promise.all([
            sb.from("ent_sesiones_tipo").select("*").eq("plan_id", plan.id).order("orden"),
            sb.from("ent_semanas").select("id, numero, lunes, titulo, fase, rir_objetivo, estado, sesiones:ent_sesiones(id, estado, fecha), avisos:ent_avisos(id, estado)").eq("plan_id", plan.id).order("numero"),
          ])
        : [{ data: [] }, { data: [] }];
      return NextResponse.json({ cliente: cliente.data, planes: planes.data ?? [], plan, tipos: tipos.data ?? [], semanas: semanas.data ?? [] });
    }

    // Propuestas de la IA por revisar (fase 7c)
    if (url.searchParams.get("propuestas") !== null) {
      const { data, error } = await sb.from("ent_propuestas").select("id, cliente_id, estado, propuesta, error, creado_en, cliente:ent_clientes(nombre), origen:ent_sesiones!ent_propuestas_sesion_origen_id_fkey(id, nombre, fecha, estado, rpe, minutos)").in("estado", ["revisar", "error"]).order("creado_en");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ propuestas: data ?? [] });
    }

    // Lista de clientes
    const { data: clientes, error } = await sb.from("ent_clientes").select("id, nombre, estado, aviso_canal, zonas_riesgo, token, push:ent_push(id)").order("estado").order("nombre");
    if (error) return NextResponse.json({ error: error.message, falta_sql: /ent_clientes/.test(error.message) }, { status: 500 });
    const ids = (clientes ?? []).map((c) => c.id);
    const h = hoy();
    const [planes, semanas, sesiones] = ids.length
      ? await Promise.all([
          sb.from("ent_planes").select("id, cliente_id, nombre, inicio, fin").in("cliente_id", ids).eq("activo", true),
          sb.from("ent_semanas").select("id, cliente_id, numero, lunes, estado, fase").in("cliente_id", ids).gte("lunes", sumarDias(h, -6)).lte("lunes", sumarDias(h, 7)).order("lunes"),
          sb.from("ent_sesiones").select("cliente_id, estado, fecha").in("cliente_id", ids).gte("fecha", sumarDias(h, -28)).lte("fecha", h),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
    const lista = (clientes ?? []).map((c) => {
      const plan = (planes.data ?? []).find((p) => p.cliente_id === c.id) ?? null;
      const sems = (semanas.data ?? []).filter((s) => s.cliente_id === c.id);
      const actual = sems.find((s) => s.lunes <= h && sumarDias(s.lunes, 6) >= h) ?? null;
      const siguiente = sems.find((s) => s.lunes > h) ?? null;
      const ult = (sesiones.data ?? []).filter((s) => s.cliente_id === c.id && s.fecha < h);
      const hechas = ult.filter((s) => s.estado === "hecha" || s.estado === "incompleta").length;
      return { ...c, plan, semana_actual: actual, semana_siguiente: siguiente, constancia_4s: { hechas, programadas: ult.length } };
    });
    return NextResponse.json({ clientes: lista });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const sb = supabaseCharlas();
  const b = await req.json().catch(() => ({}));
  try {
    switch (b.accion) {
      case "cliente_crear": {
        const nombre = String(b.nombre ?? "").trim();
        if (!nombre) return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
        const { data, error } = await sb.from("ent_clientes").insert({ nombre }).select().single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, cliente: data });
      }
      case "cliente_enlace": {
        // Genera (o regenera) el enlace personal del cliente.
        const token = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");
        const { error } = await sb.from("ent_clientes").update({ token }).eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, token });
      }
      case "cliente_guardar": {
        const { error } = await sb.from("ent_clientes").update(filtrar("ent_clientes", b.campos)).eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "plan_crear": {
        const { data, error } = await sb.from("ent_planes").insert({ cliente_id: b.cliente_id, nombre: b.nombre ?? "Plan", inicio: b.inicio ?? hoy(), activo: true }).select().single();
        if (error) throw new Error(error.message);
        await sb.from("ent_planes").update({ activo: false }).eq("cliente_id", b.cliente_id).neq("id", data.id);
        return NextResponse.json({ ok: true, plan: data });
      }
      case "plan_guardar": {
        const { error } = await sb.from("ent_planes").update(filtrar("ent_planes", b.campos)).eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "semana_nueva": {
        // Copiando la última (lo normal) o vacía.
        if (b.desde) return NextResponse.json({ ok: true, semana: await copiarSemana(b.desde) });
        const { data: plan } = await sb.from("ent_planes").select("id, cliente_id, inicio").eq("id", b.plan_id).single();
        if (!plan) return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });
        const { data: ult } = await sb.from("ent_semanas").select("numero, lunes").eq("plan_id", plan.id).order("numero", { ascending: false }).limit(1).maybeSingle();
        const ini = new Date(`${plan.inicio}T12:00:00Z`);
        const lunesIni = sumarDias(plan.inicio, 1 - (ini.getUTCDay() || 7));
        const { data, error } = await sb
          .from("ent_semanas")
          .insert({ plan_id: plan.id, cliente_id: plan.cliente_id, numero: (ult?.numero ?? 0) + 1, lunes: ult ? sumarDias(ult.lunes, 7) : lunesIni, estado: "borrador" })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, semana: data });
      }
      case "semana_guardar": {
        const { error } = await sb.from("ent_semanas").update(filtrar("ent_semanas", b.campos)).eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "semana_borrar": {
        const { data: s } = await sb.from("ent_semanas").select("estado").eq("id", b.id).single();
        if (s?.estado === "cerrada") return NextResponse.json({ error: "Una semana cerrada no se borra." }, { status: 400 });
        const { error } = await sb.from("ent_semanas").delete().eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "avisos_generar":
        return NextResponse.json({ ok: true, ...(await generarAvisos(b.semana_id)) });
      case "semana_programar": {
        // Regla del protocolo: no está programada hasta que tiene sus avisos.
        const { count } = await sb.from("ent_avisos").select("id", { count: "exact", head: true }).eq("semana_id", b.id).neq("estado", "cancelado");
        if (!count) await generarAvisos(b.id);
        const { error } = await sb.from("ent_semanas").update({ estado: "programada", programada_en: new Date().toISOString() }).eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "semana_reabrir": {
        const { error } = await sb.from("ent_semanas").update({ estado: "borrador" }).eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "sesion_crear": {
        const { data: sem } = await sb.from("ent_semanas").select("id, cliente_id, lunes, plan_id").eq("id", b.semana_id).single();
        if (!sem) return NextResponse.json({ error: "Semana no encontrada." }, { status: 404 });
        let base: { id: string; clave: string; nombre: string; dia_habitual: number | null; duracion_min: number | null } | null = null;
        if (b.sesion_tipo_id) base = (await sb.from("ent_sesiones_tipo").select("*").eq("id", b.sesion_tipo_id).single()).data;
        const fecha = b.fecha ?? sumarDias(sem.lunes, (base?.dia_habitual ?? 1) - 1);
        const { data, error } = await sb
          .from("ent_sesiones")
          .insert({ semana_id: sem.id, cliente_id: sem.cliente_id, sesion_tipo_id: base?.id ?? null, clave: base?.clave ?? b.clave ?? null, nombre: base?.nombre ?? b.nombre ?? "Sesión", fecha, duracion_min: base?.duracion_min ?? null })
          .select()
          .single();
        if (error) throw new Error(error.message);
        // Con sesión tipo: se copian los ejercicios de la última sesión de ese tipo.
        if (base) {
          const { data: prev } = await sb.from("ent_sesiones").select("id, ejercicios:ent_ejercicios(*)").eq("sesion_tipo_id", base.id).neq("id", data.id).lt("fecha", fecha).order("fecha", { ascending: false }).limit(1).maybeSingle();
          const ej = (prev?.ejercicios ?? []) as Record<string, unknown>[];
          if (ej.length) await sb.from("ent_ejercicios").insert(ej.map(({ id: _i, sesion_id: _s, creado_en: _c, ...e }) => ({ ...e, sesion_id: data.id, video: false })));
        }
        return NextResponse.json({ ok: true, sesion: data });
      }
      case "sesion_guardar": {
        const { error } = await sb.from("ent_sesiones").update(filtrar("ent_sesiones", b.campos)).eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "sesion_borrar": {
        const { error } = await sb.from("ent_sesiones").delete().eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "ejercicio_crear": {
        const { data: ult } = await sb.from("ent_ejercicios").select("orden").eq("sesion_id", b.sesion_id).order("orden", { ascending: false }).limit(1).maybeSingle();
        const { data, error } = await sb
          .from("ent_ejercicios")
          .insert({ sesion_id: b.sesion_id, orden: (ult?.orden ?? 0) + 1, nombre: b.nombre ?? "Ejercicio", ...filtrar("ent_ejercicios", b.campos ?? {}) })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, ejercicio: data });
      }
      case "ejercicio_guardar": {
        const { error } = await sb.from("ent_ejercicios").update(filtrar("ent_ejercicios", b.campos)).eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "ejercicio_borrar": {
        const { error } = await sb.from("ent_ejercicios").delete().eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "ejercicio_mover": {
        const { data: e } = await sb.from("ent_ejercicios").select("id, sesion_id, orden").eq("id", b.id).single();
        if (!e) return NextResponse.json({ error: "Ejercicio no encontrado." }, { status: 404 });
        const { data: todos } = await sb.from("ent_ejercicios").select("id, orden").eq("sesion_id", e.sesion_id).order("orden");
        const lista = (todos ?? []).map((x) => x.id);
        const i = lista.indexOf(e.id);
        const j = b.dir === "arriba" ? i - 1 : i + 1;
        if (j < 0 || j >= lista.length) return NextResponse.json({ ok: true });
        [lista[i], lista[j]] = [lista[j], lista[i]];
        await Promise.all(lista.map((id, k) => sb.from("ent_ejercicios").update({ orden: k + 1 }).eq("id", id)));
        return NextResponse.json({ ok: true });
      }
      case "propuesta_pedir": {
        // A mano desde el panel, para una sesión cerrada concreta (o para probar).
        const id = await proponerSiguiente(String(b.sesion_id));
        if (!id) return NextResponse.json({ error: "No toca: la sesión no está cerrada o ya tiene propuesta." }, { status: 400 });
        return NextResponse.json({ ok: true, propuesta_id: id });
      }
      case "propuesta_aprobar": {
        const r = await aprobarPropuesta(String(b.id), b.final as Propuesta, Array.isArray(b.correcciones) ? b.correcciones : []);
        return NextResponse.json({ ok: true, ...r });
      }
      case "propuesta_descartar": {
        const { error } = await sb.from("ent_propuestas").update({ estado: "descartada", motivo: b.motivo ?? null, resuelto_en: new Date().toISOString() }).eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "aviso_guardar": {
        const campos = filtrar("ent_avisos", b.campos);
        const { error } = await sb.from("ent_avisos").update({ ...campos, ...("texto" in campos ? { editado: true } : {}) }).eq("id", b.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
