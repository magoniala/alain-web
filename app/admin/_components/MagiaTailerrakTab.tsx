"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EGOERAK, EGOERA_IZENA, MOTAK, MOTA_IZENA, type Edukia, type Egoera, type Katalogoa, type Liburutxoa, type Mota } from "@/lib/magia-edukiak-motak";

// Plataforma de magia /magia-tailerrak (QR de los librillos de los talleres).
// Desde aquí se edita todo lo que se ve: librillos, juegos (texto, material,
// vídeo), el regalo por email, los bloques cerrados, el orden y si algo está
// visible. Los cambios salen al momento en la web. Debajo, quién ha dejado el email.

const pw = () => sessionStorage.getItem("admin_pw") || "";
const campo = "w-full border border-gray-300 bg-white px-2.5 py-2 text-[0.85rem] text-gray-900";
const etiqueta = "mb-1 block text-[0.72rem] font-medium uppercase tracking-wide text-gray-400";
const boton = "border border-gray-300 bg-white px-3 py-1.5 text-[0.8rem] text-gray-700 hover:border-gray-500 disabled:opacity-40";
const botonOscuro = "bg-gray-900 px-3.5 py-2 text-[0.8rem] font-medium text-white hover:bg-gray-700 disabled:opacity-40";
const botonRojo = "border border-red-200 bg-white px-3 py-1.5 text-[0.8rem] text-red-700 hover:border-red-400 disabled:opacity-40";

interface Usuario { email: string; librillo: string | null; canal: string | null; created_at: string; newsletter_alta_at: string | null; accesos: string[] }
interface Datos { katalogoa: Katalogoa; usuarios: Usuario[] }

async function api(init?: RequestInit, query = "") {
  const r = await fetch("/api/admin/magia-tailerrak" + query, { ...init, headers: { "Content-Type": "application/json", "x-admin-password": pw() } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

const fecha = (iso: string) => new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const hoyMadrid = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
const diaMadrid = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
const slugDesde = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

const COLOR_EGOERA: Record<Egoera, string> = { irekia: "bg-emerald-50 text-emerald-800 border-emerald-200", emaila: "bg-cyan-50 text-cyan-800 border-cyan-200", ordainpekoa: "bg-amber-50 text-amber-800 border-amber-200", sekretua: "bg-gray-100 text-gray-700 border-gray-300" };
const CORTO_EGOERA: Record<Egoera, string> = { irekia: "Abierto", emaila: "Por email", ordainpekoa: "De pago", sekretua: "Secreto ???" };

function Cifra({ valor, titulo, detalle }: { valor: string | number; titulo: string; detalle?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[0.7rem] uppercase tracking-[0.18em] text-gray-400">{titulo}</p>
      <p className="mt-1 text-[1.9rem] font-semibold leading-none tabular-nums text-gray-900">{valor}</p>
      {detalle && <p className="mt-1 text-[0.78rem] text-gray-500">{detalle}</p>}
    </div>
  );
}

function Tarjeta({ titulo, children, extra, nota }: { titulo: string; children: React.ReactNode; extra?: React.ReactNode; nota?: string }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[0.95rem] font-semibold text-gray-900">{titulo}</h2>
        {extra}
      </div>
      {nota && <p className="mb-3 text-[0.78rem] text-gray-500">{nota}</p>}
      {children}
    </section>
  );
}

function Etiqueta({ egoera }: { egoera: Egoera }) {
  return <span className={`rounded border px-1.5 py-0.5 text-[0.68rem] font-medium ${COLOR_EGOERA[egoera]}`}>{CORTO_EGOERA[egoera]}</span>;
}

// ── Formulario de un contenido (nuevo o existente)

const VACIO = (liburutxoak: string[]): Edukia => ({ slug: "", mota: "jolasa", egoera: "irekia", izenburua: "", etiketa: "", sarrera: "", materiala: "", youtube: "", liburutxoak, ordena: 0, ikusgai: true, prezioa_cent: null });

function FormEdukia({ inicial, liburutxoak, nuevo, onCerrar, onGuardado }: { inicial: Edukia; liburutxoak: Liburutxoa[]; nuevo: boolean; onCerrar: () => void; onGuardado: () => Promise<void> }) {
  const [f, setF] = useState<Edukia>({ ...inicial, etiketa: inicial.etiketa ?? "", sarrera: inicial.sarrera ?? "", materiala: inicial.materiala ?? "", youtube: inicial.youtube ?? "" });
  const [estado, setEstado] = useState<"" | "guardando" | string>("");
  const set = <K extends keyof Edukia>(k: K, v: Edukia[K]) => setF((x) => ({ ...x, [k]: v }));
  const esSecreto = f.mota === "sekretua";

  async function guardar() {
    setEstado("guardando");
    try {
      await api({ method: "PUT", body: JSON.stringify({ mota: "edukia", edukia: { ...f, youtube: f.youtube || null } }) });
      await onGuardado();
      onCerrar();
    } catch (e) {
      setEstado((e as Error).message);
    }
  }

  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={etiqueta}>Título {esSecreto && "(no se muestra: sale «???»; sirve para reconocerlo aquí)"}</label>
        <input className={campo} value={f.izenburua} onChange={(e) => { set("izenburua", e.target.value); if (nuevo && !f.slug) set("slug", slugDesde(e.target.value)); }} placeholder="Goma saltaria" />
      </div>
      <div>
        <label className={etiqueta}>Identificador (URL interna, sin espacios)</label>
        <input className={campo} value={f.slug} disabled={!nuevo} onChange={(e) => set("slug", slugDesde(e.target.value))} placeholder="goma-saltaria" />
      </div>
      <div>
        <label className={etiqueta}>Tipo</label>
        <select className={campo} value={f.mota} onChange={(e) => { const m = e.target.value as Mota; set("mota", m); if (m === "sekretua") set("egoera", "sekretua"); if (m === "oparia" && f.egoera === "irekia") set("egoera", "emaila"); }}>
          {MOTAK.map((m) => <option key={m} value={m}>{MOTA_IZENA[m]}</option>)}
        </select>
      </div>
      <div>
        <label className={etiqueta}>Quién lo ve</label>
        <select className={campo} value={f.egoera} onChange={(e) => set("egoera", e.target.value as Egoera)}>
          {EGOERAK.map((m) => <option key={m} value={m}>{EGOERA_IZENA[m]}</option>)}
        </select>
      </div>
      <div>
        <label className={etiqueta}>En qué librillos (ninguno marcado = en todos)</label>
        <div className="flex flex-wrap gap-3 py-2">
          {liburutxoak.map((l) => (
            <label key={l.slug} className="flex items-center gap-1.5 text-[0.85rem] text-gray-800">
              <input type="checkbox" checked={f.liburutxoak.includes(l.slug)} onChange={(e) => set("liburutxoak", e.target.checked ? [...f.liburutxoak, l.slug] : f.liburutxoak.filter((s) => s !== l.slug))} />
              {l.etiketa}
            </label>
          ))}
        </div>
      </div>
      {!esSecreto && (
        <>
          <div>
            <label className={etiqueta}>Etiqueta pequeña (encima del título)</label>
            <input className={campo} value={f.etiketa ?? ""} onChange={(e) => set("etiketa", e.target.value)} placeholder="Magia gomekin" />
          </div>
          <div>
            <label className={etiqueta}>Vídeo de YouTube (enlace o id; vacío = «Laster: bideoa»)</label>
            <input className={campo} value={f.youtube ?? ""} onChange={(e) => set("youtube", e.target.value)} placeholder="https://youtu.be/…" />
          </div>
          <div className="sm:col-span-2">
            <label className={etiqueta}>Qué ve el público (en euskera)</label>
            <textarea className={campo} rows={3} value={f.sarrera ?? ""} onChange={(e) => set("sarrera", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={etiqueta}>Behar duzuna (material)</label>
            <input className={campo} value={f.materiala ?? ""} onChange={(e) => set("materiala", e.target.value)} placeholder="2 goma · billete bat" />
          </div>
        </>
      )}
      {f.egoera === "ordainpekoa" && (
        <div>
          <label className={etiqueta}>Precio en € (para cuando haya pago; hoy solo se guarda)</label>
          <input className={campo} type="number" min={0} step="0.5" value={f.prezioa_cent == null ? "" : f.prezioa_cent / 100} onChange={(e) => set("prezioa_cent", e.target.value === "" ? null : Math.round(Number(e.target.value) * 100))} />
        </div>
      )}
      <label className="flex items-center gap-2 text-[0.85rem] text-gray-800 sm:col-span-2">
        <input type="checkbox" checked={f.ikusgai} onChange={(e) => set("ikusgai", e.target.checked)} /> Visible en la web (desmarcar = oculto, sin borrar)
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button className={botonOscuro} disabled={estado === "guardando" || !f.izenburua.trim() || !f.slug} onClick={guardar}>{estado === "guardando" ? "Guardando…" : nuevo ? "Crear" : "Guardar"}</button>
        <button className={boton} onClick={onCerrar}>Cancelar</button>
        {estado && estado !== "guardando" && <span className="text-[0.8rem] text-red-600">{estado}</span>}
      </div>
    </div>
  );
}

// ── Pestaña

export default function MagiaTailerrakTab() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null); // slug en edición, o "nuevo"
  const [ocupado, setOcupado] = useState(false);
  const [nuevoLib, setNuevoLib] = useState<{ slug: string; etiketa: string } | null>(null);
  const [editLib, setEditLib] = useState<Record<string, string>>({});
  const [editGiltza, setEditGiltza] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    try {
      setDatos(await api());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    let vivo = true;
    api().then((d) => vivo && setDatos(d)).catch((e) => vivo && setError((e as Error).message));
    return () => { vivo = false; };
  }, []);

  const avisar = (m: string) => { setAviso(m); setTimeout(() => setAviso(""), 3500); };
  async function accion(fn: () => Promise<unknown>) {
    setOcupado(true);
    try { await fn(); await cargar(); } catch (e) { avisar((e as Error).message); } finally { setOcupado(false); }
  }

  const resumen = useMemo(() => {
    const u = datos?.usuarios ?? [];
    const porLibrillo: Record<string, number> = {};
    for (const x of u) porLibrillo[x.librillo ?? "?"] = (porLibrillo[x.librillo ?? "?"] ?? 0) + 1;
    return { total: u.length, hoy: u.filter((x) => diaMadrid(x.created_at) === hoyMadrid()).length, sinNewsletter: u.filter((x) => !x.newsletter_alta_at).length, porLibrillo };
  }, [datos]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!datos) return <p className="text-sm text-gray-400">Cargando…</p>;

  const k = datos.katalogoa;
  const enBd = k.iturria === "db";
  const etiketaOf = (s: string) => k.liburutxoak.find((l) => l.slug === s)?.etiketa ?? s;
  const juegos = k.edukiak.filter((e) => e.mota === "jolasa");
  const conVideo = juegos.filter((e) => e.youtube).length;
  // La columna giltza existe si la API la devuelve (aunque sea null).
  const giltzaBai = enBd && k.liburutxoak.some((l) => "giltza" in l);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.85rem] text-gray-500">
          QR de los librillos → <a className="underline" href="/magia-tailerrak" target="_blank" rel="noreferrer">alainzulaika.com/magia-tailerrak</a>
        </p>
        <div className="flex items-center gap-2">
          {aviso && <span className="text-[0.8rem] text-red-600">{aviso}</span>}
          <button className={boton} onClick={cargar}>Actualizar</button>
        </div>
      </div>

      {!enBd && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[0.85rem] text-amber-900">
          {k.errorea ? (
            <>Las tablas del catálogo no existen todavía. Ejecuta <code>sql/magia_edukiak.sql</code> en el SQL editor de Supabase (crea las tablas y carga los librillos impresos). Hasta entonces la web muestra el catálogo escrito en el código y aquí no se puede editar nada. <span className="text-amber-700">({k.errorea})</span></>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Las tablas existen pero están vacías: la web muestra el catálogo del código. Para poder editarlo, cárgalo en la base de datos.</span>
              <button className={botonOscuro} disabled={ocupado} onClick={() => accion(() => api({ method: "POST", body: JSON.stringify({ ekintza: "hasieratu" }) }))}>Cargar catálogo</button>
            </div>
          )}
        </div>
      )}

      {enBd && !giltzaBai && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[0.82rem] text-amber-900">
          Falta un paso para la <b>palabra mágica</b> de cada librillo: ejecuta <code>sql/magia_giltza.sql</code> en el SQL editor de Supabase. Hasta entonces cualquiera puede abrir cualquier librillo.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cifra titulo="Emails" valor={resumen.total} detalle={`${resumen.hoy} hoy`} />
        <Cifra titulo="Vídeos" valor={`${conVideo}/${juegos.length}`} detalle="juegos con vídeo" />
        {k.liburutxoak.slice(0, 2).map((l) => <Cifra key={l.slug} titulo={l.etiketa} valor={resumen.porLibrillo[l.slug] ?? 0} detalle="emails" />)}
      </div>

      <Tarjeta
        titulo="Librillos"
        nota="Cada librillo tiene su página (alainzulaika.com/magia-tailerrak/<identificador>). El orden es el de la portada. Palabra mágica: la que escribes a mano en cada ejemplar; sin ella no se abre ese librillo (da igual mayúsculas, tildes y espacios). Vacía = abierto a cualquiera. Si la cambias, quien ya entró tendrá que escribir la nueva (salvo que ya dejara su email con ese librillo)."
        extra={enBd && !nuevoLib && <button className={boton} onClick={() => setNuevoLib({ slug: "", etiketa: "" })}>+ Nuevo librillo</button>}
      >
        <ul className="divide-y divide-gray-100">
          {k.liburutxoak.map((l, i) => (
            <li key={l.slug} className="flex flex-wrap items-center gap-2 py-2">
              <div className="flex gap-1">
                <button className={boton} disabled={!enBd || ocupado || i === 0} title="Subir" onClick={() => accion(() => api({ method: "PATCH", body: JSON.stringify({ mota: "liburutxoa", slug: l.slug, norabidea: "gora" }) }))}>↑</button>
                <button className={boton} disabled={!enBd || ocupado || i === k.liburutxoak.length - 1} title="Bajar" onClick={() => accion(() => api({ method: "PATCH", body: JSON.stringify({ mota: "liburutxoa", slug: l.slug, norabidea: "behera" }) }))}>↓</button>
              </div>
              <input className={`${campo} max-w-[200px]`} disabled={!enBd} value={editLib[l.slug] ?? l.etiketa} onChange={(e) => setEditLib((x) => ({ ...x, [l.slug]: e.target.value }))} />
              <code className="text-[0.75rem] text-gray-500">/{l.slug}</code>
              <span className="text-[0.75rem] text-gray-500">{k.edukiak.filter((e) => e.mota === "jolasa" && e.liburutxoak.includes(l.slug)).length} juegos · {resumen.porLibrillo[l.slug] ?? 0} emails</span>
              {!l.ikusgai && <span className="rounded border border-gray-300 bg-gray-100 px-1.5 text-[0.68rem] text-gray-600">Oculto</span>}
              {giltzaBai && (
                <span className="flex items-center gap-1">
                  <span className="text-[0.72rem] text-gray-500">🔑</span>
                  <input className={`${campo} w-[150px]`} disabled={ocupado} value={editGiltza[l.slug] ?? l.giltza ?? ""} onChange={(e) => setEditGiltza((x) => ({ ...x, [l.slug]: e.target.value }))} placeholder="Palabra mágica" aria-label={`Palabra mágica de ${l.etiketa}`} />
                  {editGiltza[l.slug] != null && editGiltza[l.slug] !== (l.giltza ?? "") && (
                    <button className={botonOscuro} disabled={ocupado} onClick={() => accion(async () => { await api({ method: "PUT", body: JSON.stringify({ mota: "liburutxoa", liburutxoa: { ...l, giltza: editGiltza[l.slug] } }) }); setEditGiltza((x) => { const y = { ...x }; delete y[l.slug]; return y; }); })}>Guardar</button>
                  )}
                  {!l.giltza && <span className="whitespace-nowrap rounded border border-amber-200 bg-amber-50 px-1.5 text-[0.68rem] text-amber-800">Abierto a cualquiera</span>}
                </span>
              )}
              <span className="ml-auto flex gap-1">
                {editLib[l.slug] != null && editLib[l.slug] !== l.etiketa && (
                  <button className={botonOscuro} disabled={ocupado} onClick={() => accion(async () => { await api({ method: "PUT", body: JSON.stringify({ mota: "liburutxoa", liburutxoa: { ...l, etiketa: editLib[l.slug] } }) }); setEditLib((x) => { const y = { ...x }; delete y[l.slug]; return y; }); })}>Guardar</button>
                )}
                <button className={boton} disabled={!enBd || ocupado} onClick={() => accion(() => api({ method: "PUT", body: JSON.stringify({ mota: "liburutxoa", liburutxoa: { ...l, ikusgai: !l.ikusgai } }) }))}>{l.ikusgai ? "Ocultar" : "Mostrar"}</button>
                <button className={botonRojo} disabled={!enBd || ocupado} onClick={() => { if (confirm(`¿Borrar el librillo «${l.etiketa}»? Sus juegos no se borran, pero dejan de salir en él.`)) accion(() => api({ method: "DELETE" }, `?mota=liburutxoa&slug=${encodeURIComponent(l.slug)}`)); }}>Borrar</button>
              </span>
            </li>
          ))}
        </ul>
        {nuevoLib && (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div><label className={etiqueta}>Nombre</label><input className={campo} value={nuevoLib.etiketa} onChange={(e) => setNuevoLib({ etiketa: e.target.value, slug: nuevoLib.slug || slugDesde(e.target.value) })} placeholder="12-14 urte" /></div>
            <div><label className={etiqueta}>Identificador</label><input className={campo} value={nuevoLib.slug} onChange={(e) => setNuevoLib({ ...nuevoLib, slug: slugDesde(e.target.value) })} placeholder="12-14" /></div>
            <button className={botonOscuro} disabled={ocupado || !nuevoLib.slug || !nuevoLib.etiketa.trim()} onClick={() => accion(async () => { await api({ method: "PUT", body: JSON.stringify({ mota: "liburutxoa", liburutxoa: { ...nuevoLib, ordena: (k.liburutxoak.length + 1) * 10, ikusgai: true } }) }); setNuevoLib(null); })}>Crear</button>
            <button className={boton} onClick={() => setNuevoLib(null)}>Cancelar</button>
          </div>
        )}
      </Tarjeta>

      <Tarjeta
        titulo={`Contenidos (${k.edukiak.length})`}
        nota="En la web salen en este orden, agrupados: primero lo que se abre por email, luego los juegos abiertos y al final los candados. Pulsa un contenido para editarlo."
        extra={enBd && abierto !== "nuevo" && <button className={botonOscuro} onClick={() => setAbierto("nuevo")}>+ Nuevo contenido</button>}
      >
        {abierto === "nuevo" && <FormEdukia inicial={VACIO([])} liburutxoak={k.liburutxoak} nuevo onCerrar={() => setAbierto(null)} onGuardado={cargar} />}
        <ul className="mt-2 divide-y divide-gray-100">
          {k.edukiak.map((e, i) => (
            <li key={e.slug} className="py-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1">
                  <button className={boton} disabled={!enBd || ocupado || i === 0} title="Subir" onClick={() => accion(() => api({ method: "PATCH", body: JSON.stringify({ mota: "edukia", slug: e.slug, norabidea: "gora" }) }))}>↑</button>
                  <button className={boton} disabled={!enBd || ocupado || i === k.edukiak.length - 1} title="Bajar" onClick={() => accion(() => api({ method: "PATCH", body: JSON.stringify({ mota: "edukia", slug: e.slug, norabidea: "behera" }) }))}>↓</button>
                </div>
                <button className="min-w-0 flex-1 text-left" onClick={() => setAbierto(abierto === e.slug ? null : e.slug)}>
                  <span className={`text-[0.88rem] font-medium ${e.ikusgai ? "text-gray-900" : "text-gray-400 line-through"}`}>{e.izenburua}</span>
                  <span className="ml-2 text-[0.75rem] text-gray-500">{MOTA_IZENA[e.mota]}{e.etiketa ? ` · ${e.etiketa}` : ""}</span>
                  <span className="block text-[0.75rem] text-gray-500">{e.liburutxoak.length ? e.liburutxoak.map(etiketaOf).join(" · ") : "Todos los librillos"}</span>
                </button>
                <Etiqueta egoera={e.egoera} />
                {e.mota !== "sekretua" && (e.youtube ? <a className={`${boton} text-emerald-700`} href={`https://youtu.be/${e.youtube}`} target="_blank" rel="noreferrer">▶ Vídeo</a> : <span className="text-[0.72rem] text-gray-400">sin vídeo</span>)}
                {!e.ikusgai && <span className="rounded border border-gray-300 bg-gray-100 px-1.5 text-[0.68rem] text-gray-600">Oculto</span>}
                <button className={botonRojo} disabled={!enBd || ocupado} onClick={() => { if (confirm(`¿Borrar «${e.izenburua}»? No se puede deshacer. Si solo quieres quitarlo de la web, edítalo y desmarca «Visible».`)) accion(() => api({ method: "DELETE" }, `?mota=edukia&slug=${encodeURIComponent(e.slug)}`)); }}>Borrar</button>
              </div>
              {abierto === e.slug && <FormEdukia inicial={e} liburutxoak={k.liburutxoak} nuevo={false} onCerrar={() => setAbierto(null)} onGuardado={cargar} />}
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta titulo={`Quién ha dejado el email (${resumen.total})`} extra={<span className="text-[0.75rem] text-gray-500">{resumen.sinNewsletter} sin alta en la newsletter (falta la secuencia de talleres)</span>}>
        {datos.usuarios.length === 0 ? (
          <p className="text-[0.85rem] text-gray-500">Todavía nadie.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.82rem]">
              <thead className="text-[0.7rem] uppercase tracking-wide text-gray-400">
                <tr><th className="py-1.5 pr-3">Email</th><th className="py-1.5 pr-3">Librillo</th><th className="py-1.5 pr-3">Cuándo</th><th className="py-1.5">Newsletter</th></tr>
              </thead>
              <tbody>
                {datos.usuarios.map((u) => (
                  <tr key={u.email} className="border-t border-gray-100">
                    <td className="py-1.5 pr-3 text-gray-900">{u.email}</td>
                    <td className="py-1.5 pr-3 text-gray-700">{u.librillo ? etiketaOf(u.librillo) : "—"}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-gray-700">{fecha(u.created_at)}</td>
                    <td className="py-1.5 text-gray-500">{u.newsletter_alta_at ? "Sí" : "Pendiente"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
