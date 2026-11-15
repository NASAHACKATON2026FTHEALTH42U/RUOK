#!/usr/bin/env python3
"""Genera la wiki de GitHub a partir de la documentación del repo (docs/).

La fuente de verdad sigue siendo `docs/`: la wiki es una copia para leerla cómoda en GitHub.
No se edita a mano; se regenera con este script.

    python3 scripts/github/build_wiki.py --out /ruta/wiki      # solo genera los ficheros
    python3 scripts/github/build_wiki.py --publish             # clona <repo>.wiki, regenera y sube

Qué hace:
- Una página por documento (nombres en `PAGES`), `Home` desde docs/README.md, `_Sidebar` con
  el índice y `_Footer` con el aviso de que no es un dispositivo médico.
- Reescribe los enlaces: entre documentos → páginas de la wiki; al resto del repo (código,
  maquetas, LEEME.txt…) → enlaces absolutos al fichero en la rama `main`.

Requisito de GitHub: las wikis de repos **privados** necesitan un plan de pago; en el plan
Free solo existen si el repo es público. Además, la primera página hay que crearla una vez
desde la web (pestaña Wiki → "Create the first page") para que exista `<repo>.wiki.git`.
"""

from __future__ import annotations

import argparse
import posixpath
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = "NASAHACKATON2026FTHEALTH42U/RUOK"
BLOB = f"https://github.com/{REPO}/blob/main/"
TREE = f"https://github.com/{REPO}/tree/main/"

# Documento del repo → nombre de la página de la wiki (GitHub muestra los guiones como espacios).
PAGES: dict[str, str] = {
    "docs/README.md": "Home",
    "docs/status.md": "Estado-del-proyecto",
    "docs/vision-and-scope.md": "Vision-y-alcance",
    "docs/architecture.md": "Arquitectura",
    "docs/backend.md": "Backend",
    "frontend/README.md": "Frontend",
    "docs/api-contract.md": "Contrato-de-la-API",
    "docs/data-model.md": "Modelo-de-datos",
    "docs/auth-and-roles.md": "Login-y-roles",
    "docs/control-center-and-devices.md": "Centro-de-control-y-dispositivos",
    "docs/environments.md": "Entornos",
    "docs/alerts-and-escalation.md": "Alertas-y-escalado",
    "docs/offline-and-liveness.md": "Offline-y-liveness",
    "docs/behavioral-health.md": "Salud-conductual",
    "docs/design/hud-style.md": "Estilo-HUD",
    "docs/team-and-schedule.md": "Equipo-y-cronograma",
    "docs/backlog.md": "Backlog",
    "docs/demo-script.md": "Guion-de-demo",
    "docs/sources.md": "Fuentes",
    "README.md": "Puesta-en-marcha",
}

# Índice lateral: grupos de páginas.
SIDEBAR: list[tuple[str, list[str]]] = [
    ("Empezar", ["Home", "Estado-del-proyecto", "Puesta-en-marcha", "Vision-y-alcance"]),
    ("Diseño", ["Arquitectura", "Contrato-de-la-API", "Modelo-de-datos", "Login-y-roles",
                "Entornos", "Estilo-HUD"]),
    ("Funcionalidad", ["Alertas-y-escalado", "Offline-y-liveness", "Salud-conductual",
                       "Centro-de-control-y-dispositivos"]),
    ("Desarrollo", ["Backend", "Frontend", "Backlog"]),
    ("Equipo y demo", ["Equipo-y-cronograma", "Guion-de-demo", "Fuentes"]),
]

_LINK = re.compile(r"(?<!!)\[([^\]]*)\]\(([^)\s]+)\)")
_FENCE = re.compile(r"^(```|~~~)")


def _title(page: str) -> str:
    return "Inicio" if page == "Home" else page.replace("-", " ")


def _rewrite_target(target: str, source: str) -> str:
    """Enlace de `source` (ruta del doc en el repo) convertido para la wiki."""
    if re.match(r"^[a-z][a-z0-9+.-]*:", target) or target.startswith("#"):
        return target  # http(s), mailto… o ancla de la misma página
    path, _, anchor = target.partition("#")
    resolved = posixpath.normpath(posixpath.join(posixpath.dirname(source), path))
    page = PAGES.get(resolved)
    if page is not None:
        return page + (f"#{anchor}" if anchor else "")
    if resolved.startswith(".."):
        return target  # fuera del repo: se deja como está
    base = TREE if (ROOT / resolved).is_dir() else BLOB
    return base + resolved + (f"#{anchor}" if anchor else "")


def convert(text: str, source: str) -> str:
    """Reescribe los enlaces de un documento (sin tocar los bloques de código)."""
    out, in_code = [], False
    for line in text.splitlines():
        if _FENCE.match(line.lstrip()):
            in_code = not in_code
        elif not in_code:
            line = _LINK.sub(
                lambda m: f"[{m.group(1)}]({_rewrite_target(m.group(2), source)})", line
            )
        out.append(line)
    return "\n".join(out) + "\n"


def build(out: Path) -> list[str]:
    """Escribe las páginas en `out` y devuelve sus nombres."""
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.md"):
        old.unlink()  # las páginas de docs que ya no existen desaparecen de la wiki
    written = []
    for source, page in PAGES.items():
        src = ROOT / source
        if not src.exists():
            print(f"  ! falta {source}: se omite", file=sys.stderr)
            continue
        banner = (
            f"> 📄 Generado desde [`{source}`]({BLOB}{source}). No edites esta página: cambia "
            "el fichero del repo y regenera la wiki (`scripts/github/build_wiki.py`).\n\n"
        )
        (out / f"{page}.md").write_text(
            banner + convert(src.read_text(encoding="utf-8"), source), encoding="utf-8"
        )
        written.append(page)

    known = set(written)
    lines = ["### R U OK?", ""]
    for group, pages in SIDEBAR:
        lines.append(f"**{group}**")
        lines += [f"- [{_title(p)}]({p})" for p in pages if p in known]
        lines.append("")
    rest = sorted(known - {p for _, pages in SIDEBAR for p in pages})
    if rest:
        lines.append("**Otros**")
        lines += [f"- [{_title(p)}]({p})" for p in rest]
    (out / "_Sidebar.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    (out / "_Footer.md").write_text(
        "⚠️ R U OK? es un prototipo de hackathon (NASA Space Apps Challenge 2026) y "
        "**no es un dispositivo médico**. La fuente de esta wiki es la carpeta "
        f"[`docs/`]({TREE}docs) del repositorio.\n",
        encoding="utf-8",
    )
    return written


def publish() -> int:
    """Clona la wiki, regenera las páginas y hace push."""
    remote = f"git@github.com:{REPO}.wiki.git"
    with tempfile.TemporaryDirectory(prefix="ruok-wiki-") as tmp:
        clone = subprocess.run(
            ["git", "clone", "--quiet", remote, tmp], capture_output=True, text=True
        )
        if clone.returncode != 0:
            print(
                "No se ha podido clonar la wiki. Comprueba que:\n"
                "  1. el repo es público o la organización tiene un plan de pago (las wikis de\n"
                "     repos privados no existen en el plan Free);\n"
                "  2. la wiki está activada (Settings → Features → Wikis);\n"
                "  3. has creado la primera página desde la web (pestaña Wiki).\n"
                f"Detalle: {clone.stderr.strip()}",
                file=sys.stderr,
            )
            return 1
        pages = build(Path(tmp))
        git = ["git", "-C", tmp]
        subprocess.run([*git, "add", "-A"], check=True)
        if subprocess.run([*git, "diff", "--cached", "--quiet"]).returncode == 0:
            print("La wiki ya está al día.")
            return 0
        subprocess.run(
            [*git, "commit", "--quiet", "-m", "Wiki regenerada desde docs/"], check=True
        )
        subprocess.run([*git, "push", "--quiet"], check=True)
        print(f"Wiki publicada: {len(pages)} páginas → https://github.com/{REPO}/wiki")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, help="carpeta donde generar las páginas")
    parser.add_argument("--publish", action="store_true", help="clona la wiki y la sube")
    args = parser.parse_args()
    if args.publish:
        return publish()
    out = args.out or Path(tempfile.mkdtemp(prefix="ruok-wiki-"))
    if out.exists() and any(out.iterdir()) and not (out / "_Sidebar.md").exists():
        print(f"{out} no está vacía y no parece una wiki: elige otra carpeta", file=sys.stderr)
        return 1
    pages = build(out)
    print(f"{len(pages)} páginas generadas en {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
