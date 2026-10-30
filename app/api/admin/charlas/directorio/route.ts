import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { MAPEOS, aFichas, aplicarMapeo, descargarTabla, importarFichas, leerTabla, resumir, urlDeDataset } from "@/lib/charlas-directorio";

// Importar un directorio oficial de centros desde el panel (fase 3).
//
//   POST /api/admin/charlas/directorio
//     JSON:      { accion, territorio, mapeo?, url? , dataset? }
//     multipart: campos accion, territorio, mapeo? + fichero (CSV/TSV/XLSX/JSON)
//
//   accion = inspeccionar  → columnas del fichero y tres filas de muestra
//          = previsualizar → cuántos centros con ESO/Bachillerato quedan, por tipo, y una muestra. No toca nada.
//          = importar      → crea las fichas que no existan (estado "0 Por llamar"). Idempotente por nombre.
//
//   url     = enlace directo al CSV/XLSX (se descarga desde Vercel, que sí tiene red abierta)
//   dataset = id de datos.gob.es (p. ej. a15002917-centros-educativos1): se resuelve la distribución CSV/XLSX
//
// El espejo escribe las fichas nuevas en el vault en su siguiente pasada.

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    let accion = "previsualizar";
    let territorio = "";
    let mapeoNombre = "";
    let contenido: Buffer | null = null;
    let nombre = "directorio";
    let tipo = "";
    let fuente = "";

    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      accion = String(fd.get("accion") ?? accion);
      territorio = String(fd.get("territorio") ?? "");
      mapeoNombre = String(fd.get("mapeo") ?? "");
      const f = fd.get("fichero");
      if (!(f instanceof File)) return NextResponse.json({ error: "Falta el fichero." }, { status: 400 });
      contenido = Buffer.from(await f.arrayBuffer());
      nombre = f.name;
      tipo = f.type;
      fuente = `fichero ${f.name}`;
    } else {
      const body = (await req.json().catch(() => ({}))) as { accion?: string; territorio?: string; mapeo?: string; url?: string; dataset?: string };
      accion = body.accion ?? accion;
      territorio = body.territorio ?? "";
      mapeoNombre = body.mapeo ?? "";
      let url = body.url ?? "";
      if (!url && body.dataset) {
        const d = await urlDeDataset(body.dataset);
        if (!d) return NextResponse.json({ error: `No encuentro distribuciones descargables en datos.gob.es para ${body.dataset}.` }, { status: 404 });
        url = d.url;
      }
      if (!url) return NextResponse.json({ error: "Falta url, dataset o fichero." }, { status: 400 });
      const d = await descargarTabla(url);
      contenido = d.contenido;
      nombre = d.nombre;
      tipo = d.tipo;
      fuente = url;
    }

    const filas = leerTabla(contenido, nombre, tipo);
    if (accion === "inspeccionar") {
      return NextResponse.json({ fuente, filas: filas.length, columnas: Object.keys(filas[0] ?? {}), muestra: filas.slice(0, 3) });
    }
    if (!territorio) return NextResponse.json({ error: "Falta territorio." }, { status: 400 });
    const mapeo = MAPEOS[mapeoNombre || (territorio.toLowerCase() === "navarra" ? "navarra" : "cantabria")];
    if (!mapeo) return NextResponse.json({ error: `Mapeo desconocido: ${mapeoNombre}` }, { status: 400 });

    const { col, filas: mapeadas } = aplicarMapeo(filas, mapeo);
    const fichas = aFichas(mapeadas, territorio);
    const base = { fuente, filas: filas.length, columnas_usadas: col, resumen: resumir(fichas), muestra: fichas.slice(0, 5).map((f) => ({ nombre: f.nombre, ...f.frontmatter })) };
    if (accion === "previsualizar") return NextResponse.json(base);
    if (accion !== "importar") return NextResponse.json({ error: `Acción desconocida: ${accion}` }, { status: 400 });
    const res = await importarFichas(fichas);
    return NextResponse.json({ ...base, importacion: res, ok: res.errores.length === 0 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
