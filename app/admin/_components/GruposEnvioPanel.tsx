"use client";

// /admin → Newsletter → Grupos: mandar un mail a un grupo de contactos
// (familias del taller de Mirariak, apuntados a la plataforma…) sin pasar por
// la lista de la newsletter. Los grupos están en lib/grupos-envio.ts y la API
// en app/api/admin/grupos.

import { useCallback, useEffect, useMemo, useState } from "react";
import { avisosDeEstilo, claveDe, htmlGrupo, versionCompleta, type Campos, type Destinatario, type Excluido, type Idioma } from "@/lib/grupos-envio-html";

type Envio = { estado: "pendiente" | "aceptado" | "error"; error: string | null; enviado_en: string | null };
type Fila = Destinatario & { baja: boolean; envio: Envio | null };
interface Datos {
  grupos: { clave: string; nombre: string; descripcion: string }[];
  mails: { clave: string; grupo: string; asunto: string; actualizado: string; enviados: number }[];
  mail: { clave: string; grupo: string; campos: Campos } | null;
  destinatarios: Fila[];
  excluidos: Excluido[];
  faltaSql: boolean;
  enProduccion: boolean;
  remitente: string;
  pruebaA: string;
  error?: string;
}

const VACIO: Campos = { es: { subject: "", preheader: "", body: "" }, eu: { subject: "", preheader: "", body: "" } };
const ETIQUETA: Record<Idioma, string> = { eu: "Euskera", es: "Castellano" };
const inputClass = "w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 transition-colors";
const btn = "px-4 py-2 text-sm border transition-colors disabled:opacity-40";

export default function GruposEnvioPanel() {
  const pw = () => sessionStorage.getItem("admin_pw") || "";
  const [datos, setDatos] = useState<Datos | null>(null);
  const [grupo, setGrupo] = useState("");
  const [nombre, setNombre] = useState("");
  const [campos, setCampos] = useState<Campos>(VACIO);
  const [guardado, setGuardado] = useState<string>(""); // JSON de lo guardado, para saber si hay cambios
  const [excluir, setExcluir] = useState<Set<string>>(new Set());
  const [pruebaA, setPruebaA] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const [verExcluidos, setVerExcluidos] = useState(false);

  const clave = claveDe(nombre);

  const cargar = useCallback(async (g: string, c: string, rellenar: boolean) => {
    const q = new URLSearchParams();
    if (g) q.set("grupo", g);
    if (c) q.set("clave", c);
    const r = await fetch(`/api/admin/grupos?${q}`, { headers: { "x-admin-password": pw() } });
    const d = (await r.json()) as Datos;
    if (!r.ok) { setMsg({ tipo: "error", texto: d.error || "No se ha podido cargar." }); return; }
    setDatos(d);
    setPruebaA((p) => p || d.pruebaA);
    if (rellenar && d.mail) {
      setCampos(d.mail.campos);
      setGrupo(d.mail.grupo);
      setGuardado(JSON.stringify({ g: d.mail.grupo, c: d.mail.campos }));
    }
  }, []);

  // Primera carga: grupos y mails guardados (sin grupo elegido todavía).
  useEffect(() => {
    fetch("/api/admin/grupos", { headers: { "x-admin-password": sessionStorage.getItem("admin_pw") || "" } })
      .then((r) => r.json())
      .then((d: Datos) => {
        if (d.error) { setMsg({ tipo: "error", texto: d.error }); return; }
        setDatos(d);
        setPruebaA((p) => p || d.pruebaA);
      })
      .catch(() => setMsg({ tipo: "error", texto: "No se ha podido cargar." }));
  }, []);

  const cambiado = guardado !== JSON.stringify({ g: grupo, c: campos });
  const set = (i: Idioma, k: keyof Campos["es"], v: string) => setCampos((c) => ({ ...c, [i]: { ...c[i], [k]: v } }));

  const abrirGuardado = async (c: string) => {
    setMsg(null); setConfirmando(false); setExcluir(new Set());
    if (!c) { setNombre(""); setCampos(VACIO); setGrupo(""); setGuardado(""); await cargar("", "", false); return; }
    setNombre(c);
    await cargar("", c, true);
  };

  const elegirGrupo = async (g: string) => {
    setGrupo(g); setExcluir(new Set()); setConfirmando(false);
    await cargar(g, clave, false);
  };

  const idiomasListos = useMemo(() => new Set((["eu", "es"] as const).filter((i) => versionCompleta(campos[i]))), [campos]);
  const lista = datos?.destinatarios ?? [];
  const yaTienen = lista.filter((d) => d.envio?.estado === "aceptado" || d.envio?.estado === "pendiente");
  const bajas = lista.filter((d) => d.baja);
  const sinVersion = lista.filter((d) => !d.baja && !idiomasListos.has(d.idioma) && !yaTienen.includes(d));
  const total = lista.filter((d) => !excluir.has(d.email) && !d.baja && (yaTienen.includes(d) || idiomasListos.has(d.idioma))).length;
  const porEnviar = lista.filter((d) => !excluir.has(d.email) && !d.baja && idiomasListos.has(d.idioma) && (!d.envio || d.envio.estado === "error"));
  const cuenta = (xs: Fila[], i: Idioma) => xs.filter((d) => d.idioma === i).length;

  const post = async (body: object) => {
    const r = await fetch("/api/admin/grupos", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-password": pw() }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, d };
  };

  const guardar = async (): Promise<boolean> => {
    if (!clave) { setMsg({ tipo: "error", texto: "Ponle un nombre al envío (p. ej. «videos-mirariak»)." }); return false; }
    if (!grupo) { setMsg({ tipo: "error", texto: "Elige un grupo." }); return false; }
    const { ok, d } = await post({ accion: "guardar", clave, grupo, campos });
    if (!ok) { setMsg({ tipo: "error", texto: d.error || "No se ha guardado." }); return false; }
    setNombre(d.clave);
    setGuardado(JSON.stringify({ g: grupo, c: campos }));
    await cargar(grupo, d.clave, false);
    return true;
  };

  const onGuardar = async () => {
    setOcupado(true); setMsg(null);
    if (await guardar()) setMsg({ tipo: "ok", texto: `Guardado como «${clave}».` });
    setOcupado(false);
  };

  const onPrueba = async () => {
    setOcupado(true); setMsg(null);
    const { ok, d } = await post({ accion: "prueba", clave, campos, a: pruebaA });
    setMsg(ok ? { tipo: "ok", texto: `Prueba enviada a ${d.enviadoA} (${(d.versiones as string[]).map((v) => v.toUpperCase()).join(" y ")}).` } : { tipo: "error", texto: d.error || "No ha salido." });
    setOcupado(false);
  };

  const onEnviar = async () => {
    setOcupado(true); setMsg(null);
    if (cambiado && !(await guardar())) { setOcupado(false); return; }
    const saltar: string[] = [];
    let enviados = 0;
    const fallos: string[] = [];
    for (let vuelta = 0; vuelta < 50; vuelta++) {
      const { ok, d } = await post({ accion: "enviar", clave, confirmar: confirmacion, excluir: [...excluir], saltar });
      if (!ok) { setMsg({ tipo: "error", texto: d.error || "No ha salido." }); break; }
      enviados += d.enviados;
      for (const e of d.errores as { email: string; error: string }[]) { saltar.push(e.email); fallos.push(`${e.email}: ${e.error}`); }
      if (!d.quedan) {
        setMsg({ tipo: fallos.length ? "error" : "ok", texto: `Enviados ${enviados}.${fallos.length ? ` Fallaron ${fallos.length} (se reintentan al volver a enviar): ${fallos.join(" · ")}` : ""}` });
        break;
      }
    }
    setConfirmando(false); setConfirmacion("");
    await cargar(grupo, clave, false);
    setOcupado(false);
  };

  const grupoSel = datos?.grupos.find((g) => g.clave === grupo);

  return (
    <div className="space-y-6">
      <p className="text-[0.8rem] text-gray-500 leading-relaxed">
        Un mail suelto a un grupo de contactos, fuera de la lista de la newsletter. Sale desde <span className="text-gray-700">{datos?.remitente ?? "…"}</span>, un correo por persona, con la versión de su idioma. Lo que ya le ha llegado a alguien no se le repite.
      </p>
      {datos?.faltaSql && (
        <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2">Falta ejecutar <code>sql/envios_grupos.sql</code> en Supabase. Hasta entonces se puede mirar la lista y mandar pruebas, pero no guardar ni enviar.</p>
      )}

      {/* Qué mail y a qué grupo */}
      <div className="grid md:grid-cols-3 gap-4">
        <label className="block">
          <span className="block text-[0.72rem] uppercase tracking-wider text-gray-400 mb-1">Mail guardado</span>
          <select className={inputClass} value={datos?.mails.some((m) => m.clave === clave) ? clave : ""} onChange={(e) => abrirGuardado(e.target.value)}>
            <option value="">— Nuevo —</option>
            {datos?.mails.map((m) => (
              <option key={m.clave} value={m.clave}>{m.clave}{m.enviados ? ` · enviado a ${m.enviados}` : " · borrador"}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[0.72rem] uppercase tracking-wider text-gray-400 mb-1">Nombre del envío</span>
          <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="videos-mirariak" />
          {nombre && clave !== nombre && <span className="text-[0.72rem] text-gray-400">Se guarda como «{clave}»</span>}
        </label>
        <label className="block">
          <span className="block text-[0.72rem] uppercase tracking-wider text-gray-400 mb-1">Grupo</span>
          <select className={inputClass} value={grupo} onChange={(e) => elegirGrupo(e.target.value)}>
            <option value="">— Elige —</option>
            {datos?.grupos.map((g) => <option key={g.clave} value={g.clave}>{g.nombre}</option>)}
          </select>
          {grupoSel && <span className="text-[0.72rem] text-gray-400">{grupoSel.descripcion}</span>}
        </label>
      </div>

      {/* Textos y vista previa */}
      <div className="grid lg:grid-cols-2 gap-6">
        {(["eu", "es"] as const).map((i) => {
          const avisos = avisosDeEstilo(campos[i]);
          return (
            <div key={i} className="space-y-2">
              <p className="text-[0.72rem] uppercase tracking-wider text-gray-500">{ETIQUETA[i]}</p>
              <input className={inputClass} value={campos[i].subject} onChange={(e) => set(i, "subject", e.target.value)} placeholder={i === "eu" ? "Gaia" : "Asunto"} />
              <input className={inputClass} value={campos[i].preheader} onChange={(e) => set(i, "preheader", e.target.value)} placeholder="Preheader (opcional)" />
              <textarea className={`${inputClass} font-mono text-[0.8rem] leading-relaxed`} rows={14} value={campos[i].body} onChange={(e) => set(i, "body", e.target.value)} placeholder="Cuerpo. Una línea en blanco entre párrafos. [texto](url) para enlaces." />
              {avisos.length > 0 && <ul className="text-[0.75rem] text-amber-700 list-disc pl-5">{avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
              {versionCompleta(campos[i]) ? (
                <div className="border border-gray-200">
                  <p className="text-[0.72rem] text-gray-400 px-3 py-1 border-b border-gray-100">Vista previa · {campos[i].subject}</p>
                  <iframe title={`vista-${i}`} className="w-full h-[480px] bg-white" srcDoc={htmlGrupo(campos[i], i, "#")} />
                </div>
              ) : (
                <p className="text-[0.75rem] text-gray-400">Sin asunto o cuerpo: a quien tenga este idioma no le sale.</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Destinatarios */}
      {grupo && (
        <div>
          <p className="text-sm text-gray-700 mb-2">
            <strong>{lista.length}</strong> en el grupo ({cuenta(lista, "eu")} eu · {cuenta(lista, "es")} es)
            {" · "}<span className="text-green-700">{yaTienen.length} ya lo tienen</span>
            {bajas.length > 0 && <> · <span className="text-gray-500">{bajas.length} de baja</span></>}
            {excluir.size > 0 && <> · {excluir.size} quitados a mano</>}
            {sinVersion.length > 0 && <> · <span className="text-amber-700">{sinVersion.length} sin versión en su idioma</span></>}
            {" · "}<strong>por enviar: {porEnviar.length}</strong> ({cuenta(porEnviar, "eu")} eu · {cuenta(porEnviar, "es")} es)
          </p>
          <div className="border border-gray-200 max-h-[420px] overflow-auto">
            <table className="w-full text-[0.8rem]">
              <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
                <tr><th className="px-2 py-1 w-8"></th><th className="px-2 py-1">Nombre</th><th className="px-2 py-1">Correo</th><th className="px-2 py-1">Idioma</th><th className="px-2 py-1">Estado</th><th className="px-2 py-1">Notas</th></tr>
              </thead>
              <tbody>
                {lista.map((d) => {
                  const estado = d.baja ? "de baja" : d.envio?.estado === "aceptado" ? `enviado ${d.envio.enviado_en?.slice(0, 10) ?? ""}` : d.envio?.estado === "pendiente" ? "a medias (no se reintenta)" : d.envio?.estado === "error" ? `error: ${d.envio.error ?? ""}` : excluir.has(d.email) ? "quitado" : !idiomasListos.has(d.idioma) ? "sin versión" : "por enviar";
                  const color = d.baja || excluir.has(d.email) ? "text-gray-400" : d.envio?.estado === "aceptado" ? "text-green-700" : d.envio?.estado === "error" ? "text-red-600" : "";
                  return (
                    <tr key={d.email} className={`border-t border-gray-100 ${color}`}>
                      <td className="px-2 py-1">
                        <input type="checkbox" disabled={d.baja || !!d.envio && d.envio.estado !== "error"} checked={!excluir.has(d.email) && !d.baja}
                          onChange={(e) => setExcluir((s) => { const n = new Set(s); if (e.target.checked) n.delete(d.email); else n.add(d.email); return n; })} />
                      </td>
                      <td className="px-2 py-1">{d.nombre || "—"}</td>
                      <td className="px-2 py-1">{d.email}</td>
                      <td className="px-2 py-1 uppercase">{d.idioma}</td>
                      <td className="px-2 py-1">{estado}</td>
                      <td className="px-2 py-1 text-gray-500">{d.notas.join(" · ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(datos?.excluidos.length ?? 0) > 0 && (
            <button className="text-[0.75rem] text-gray-500 underline mt-2" onClick={() => setVerExcluidos((v) => !v)}>
              {verExcluidos ? "Ocultar" : "Ver"} los {datos!.excluidos.length} que no entran en el grupo
            </button>
          )}
          {verExcluidos && (
            <ul className="text-[0.75rem] text-gray-500 mt-1 space-y-0.5">{datos!.excluidos.map((x) => <li key={x.email}>{x.nombre || "—"} · {x.email} · {x.motivo}</li>)}</ul>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap items-end gap-3 border-t border-gray-200 pt-4">
        <button className={`${btn} border-gray-300 hover:border-gray-500`} disabled={ocupado} onClick={onGuardar}>Guardar{cambiado && clave ? " *" : ""}</button>
        <div className="flex items-end gap-2">
          <input className={`${inputClass} w-64`} value={pruebaA} onChange={(e) => setPruebaA(e.target.value)} />
          <button className={`${btn} border-gray-300 hover:border-gray-500`} disabled={ocupado || !idiomasListos.size} onClick={onPrueba}>Enviarme una prueba</button>
        </div>
        <button className={`${btn} border-[#1a1a1a] bg-[#1a1a1a] text-white`} disabled={ocupado || !grupo || !clave || !porEnviar.length || datos?.faltaSql}
          onClick={() => { setConfirmando(true); setConfirmacion(""); setMsg(null); }}>
          Enviar…
        </button>
      </div>

      {confirmando && (
        <div className="border border-red-300 bg-red-50 p-4 space-y-3">
          <p className="text-sm text-red-900">
            Vas a enviar <strong>«{clave}»</strong> al grupo <strong>{grupoSel?.nombre}</strong>: <strong>{porEnviar.length}</strong> correos ahora ({cuenta(porEnviar, "eu")} en euskera · {cuenta(porEnviar, "es")} en castellano).
            {yaTienen.length > 0 && <> Otros {yaTienen.length} ya lo tenían y no se repiten.</>}
            {cambiado && <> Antes se guardan los cambios de los textos.</>}
          </p>
          {!datos?.enProduccion && <p className="text-sm text-red-900">Esto no es producción: el envío real solo sale desde alainzulaika.com/admin. Aquí te lo rechazará.</p>}
          <p className="text-sm text-red-900">Para confirmar, escribe <code className="bg-white px-1">ENVIAR {total}</code> ({total} = los que lo tendrán al terminar).</p>
          <div className="flex gap-2">
            <input className={`${inputClass} w-48 bg-white`} value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoFocus />
            <button className={`${btn} border-red-700 bg-red-700 text-white`} disabled={ocupado || confirmacion.trim().toUpperCase() !== `ENVIAR ${total}`} onClick={onEnviar}>{ocupado ? "Enviando…" : "Enviar de verdad"}</button>
            <button className={`${btn} border-gray-300`} disabled={ocupado} onClick={() => setConfirmando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {msg && <p className={`text-sm ${msg.tipo === "ok" ? "text-green-700" : "text-red-600"}`}>{msg.texto}</p>}
    </div>
  );
}
