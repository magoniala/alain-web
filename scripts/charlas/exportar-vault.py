#!/usr/bin/env python3
"""
Exporta el CRM de charlas del vault de Obsidian a un JSON que entiende
/api/admin/charlas/importar.

Uso:
    python3 exportar-vault.py "<ruta a .../Vías/Charlas>" salida.json

Lee Centros/*.md y Eventos/*.md. No modifica nada en el vault.

Cada ficha de centro se convierte en:
  { "nombre", "frontmatter": {...tal cual...}, "registro": [ {fecha, canal, texto, raw} ],
    "notas": "texto libre", "secciones_extra": {"## X": "..."} }

Las líneas de Registro tienen dos formatos históricos ("- fecha · Canal · texto" y
"- fecha - Canal - texto", además de líneas sin canal). Se intenta sacar fecha y
canal; si no se puede, la línea entera va en `texto` y `canal` queda null. La
línea original siempre se conserva en `raw`, así no se pierde nada.
"""
import json
import re
import sys
from pathlib import Path

import yaml

CANALES = {
    "llamada": "Llamada",
    "mail": "Mail",
    "mail ampa": "Mail AMPA",
    "whatsapp": "WhatsApp",
    "reunión": "Reunión",
    "reunion": "Reunión",
    "recibido": "Recibido",
    "respuesta": "Recibido",
    "sistema": "Sistema",
}

FECHA_RE = re.compile(r"^-\s*(\d{4}-\d{2}-\d{2})\s*(?:[·\-]\s*)?(.*)$")


def partir_frontmatter(texto: str):
    if not texto.startswith("---"):
        return {}, texto
    partes = texto.split("\n---", 1)
    if len(partes) < 2:
        return {}, texto
    fm_txt = partes[0][3:]
    cuerpo = partes[1].lstrip("\n")
    try:
        fm = yaml.safe_load(fm_txt) or {}
    except yaml.YAMLError as e:
        print(f"  ! YAML inválido: {e}", file=sys.stderr)
        fm = {}
    # Fechas: yaml las convierte a date; las queremos como texto ISO.
    for k, v in list(fm.items()):
        if hasattr(v, "isoformat"):
            fm[k] = v.isoformat()
        # YAML 1.1 convierte "no"/"sí"... en booleanos; en las fichas son texto
        # ("euskera: no"). Se deshace la conversión.
        if isinstance(v, bool):
            fm[k] = "sí" if v else "no"
    return fm, cuerpo


def secciones(cuerpo: str):
    """Devuelve dict '## Título' -> texto, respetando el orden."""
    out = {}
    actual = None
    buf = []
    for linea in cuerpo.splitlines():
        if linea.startswith("## "):
            if actual is not None:
                out[actual] = "\n".join(buf).strip()
            actual = linea.strip()
            buf = []
        elif actual is not None:
            buf.append(linea)
    if actual is not None:
        out[actual] = "\n".join(buf).strip()
    return out


def parsear_registro(texto: str):
    filas = []
    for linea in texto.splitlines():
        l = linea.rstrip()
        if not l.strip():
            continue
        if not l.lstrip().startswith("-"):
            # Continuación de la línea anterior (sangría o párrafo suelto)
            if filas:
                filas[-1]["texto"] += "\n" + l.strip()
                filas[-1]["raw"] += "\n" + l
            continue
        m = FECHA_RE.match(l.strip())
        if not m:
            filas.append({"fecha": None, "canal": None, "texto": l.strip().lstrip("- ").strip(), "raw": l})
            continue
        fecha, resto = m.group(1), m.group(2).strip()
        canal = None
        # Canal = primer tramo antes de · o - si coincide con uno conocido
        m2 = re.match(r"^([A-Za-zÁÉÍÓÚáéíóúñÑ ]{3,20}?)\s*[·\-]\s*(.*)$", resto)
        if m2 and m2.group(1).strip().lower() in CANALES:
            canal = CANALES[m2.group(1).strip().lower()]
            resto = m2.group(2).strip()
        if canal is None:
            canal = canal_por_contenido(resto)
        filas.append({"fecha": fecha, "canal": canal, "texto": resto, "raw": l})
    return filas


# Muchas líneas antiguas no llevan canal explícito ("Mail 2", "Seguimiento 1",
# "Respuesta: calendario cerrado"). Se deduce por cómo empiezan; si no hay
# pista clara, se deja null y lo decide quien lo lea.
PISTAS_CANAL = [
    (re.compile(r"^(ficha generada|fecha movida|estado|aparcad|reactivaci)", re.I), "Sistema"),
    (re.compile(r"^(respuesta|responde|contesta|me (dice|escribe|responde)|recibo|acuse)", re.I), "Recibido"),
    (re.compile(r"^(mail|correo|seguimiento|recordatorio|dossier|cierre|env[ií]o|reenv[ií]o|mando)", re.I), "Mail"),
    (re.compile(r"^(llamo|llamada|hablo|conserjer|no cogen|comunica|buz[oó]n)", re.I), "Llamada"),
    (re.compile(r"^(whatsapp|wa\b)", re.I), "WhatsApp"),
]


def canal_por_contenido(texto: str):
    for patron, canal in PISTAS_CANAL:
        if patron.search(texto):
            return canal
    return None


def exportar_centros(dir_centros: Path):
    centros = []
    for f in sorted(dir_centros.glob("*.md")):
        fm, cuerpo = partir_frontmatter(f.read_text(encoding="utf-8"))
        secs = secciones(cuerpo)
        registro = parsear_registro(secs.pop("## Registro", ""))
        notas = secs.pop("## Notas", "")
        centros.append(
            {
                "nombre": f.stem,
                "frontmatter": fm,
                "registro": registro,
                "notas": notas,
                "secciones_extra": secs,
                "mtime": f.stat().st_mtime,
            }
        )
    return centros


def exportar_eventos(dir_eventos: Path):
    eventos = []
    if not dir_eventos.exists():
        return eventos
    for f in sorted(dir_eventos.glob("*.md")):
        fm, cuerpo = partir_frontmatter(f.read_text(encoding="utf-8"))
        eventos.append({"nombre": f.stem, "frontmatter": fm, "cuerpo": cuerpo.strip()})
    return eventos


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    base = Path(sys.argv[1])
    salida = Path(sys.argv[2])
    centros = exportar_centros(base / "Centros")
    eventos = exportar_eventos(base / "Eventos")
    datos = {"version": 1, "origen": str(base), "centros": centros, "eventos": eventos}
    salida.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    n_reg = sum(len(c["registro"]) for c in centros)
    sin_fecha = sum(1 for c in centros for r in c["registro"] if not r["fecha"])
    sin_canal = sum(1 for c in centros for r in c["registro"] if r["fecha"] and not r["canal"])
    print(f"{len(centros)} centros · {len(eventos)} eventos · {n_reg} líneas de registro "
          f"({sin_fecha} sin fecha, {sin_canal} con fecha pero sin canal reconocido) → {salida}")


if __name__ == "__main__":
    main()
