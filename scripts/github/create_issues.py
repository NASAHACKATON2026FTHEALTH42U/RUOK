#!/usr/bin/env python3
"""Crea labels, milestones e issues en GitHub a partir de backlog.yaml.

Uso:
    python3 scripts/github/create_issues.py --dry-run      # solo genera docs/backlog.md
    python3 scripts/github/create_issues.py                # crea todo en GitHub (requiere gh auth)

Es idempotente: si ya existe una issue cuyo título empieza por "[ID]", no la recrea.
Pasada 1: crea las issues en orden. Pasada 2: reescribe los cuerpos con enlaces #n reales.
Al final regenera docs/backlog.md con los números de issue.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
BACKLOG = Path(__file__).with_name("backlog.yaml")
DOCS_BACKLOG = ROOT / "docs" / "backlog.md"
DOCS_URL = "../blob/main/docs/{}"  # relativo a la issue: /<owner>/<repo>/issues/n -> ../blob/main/docs

AREA_LABEL = {a: f"area:{a}" for a in ("backend", "frontend", "fullstack", "content")}


def gh(*args: str, input_: str | None = None) -> str:
    res = subprocess.run(["gh", *args], input=input_, capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(f"gh {' '.join(args)} falló:\n{res.stderr}")
    return res.stdout


def repo_slug() -> str:
    return json.loads(gh("repo", "view", "--json", "nameWithOwner"))["nameWithOwner"]


def blocks_map(issues: list[dict]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {i["id"]: [] for i in issues}
    for i in issues:
        for d in i.get("depends", []):
            out.setdefault(d, []).append(i["id"])
    return out


def ref(id_: str, numbers: dict[str, int]) -> str:
    n = numbers.get(id_)
    return f"#{n} ({id_})" if n else f"`{id_}`"


def render_body(issue: dict, blocks: list[str], numbers: dict[str, int], slug: str | None) -> str:
    doc = issue.get("docs")
    doc_link = (
        f"[docs/{doc}](https://github.com/{slug}/blob/main/docs/{doc})" if slug and doc else f"`docs/{doc}`"
    )
    lines = [
        f"**ID:** `{issue['id']}` · **Área:** {issue['area']} · **Prioridad:** {issue['priority']}",
        "",
        f"📄 Contexto: {doc_link}",
        "",
        "### Tareas",
        *[f"- [ ] {t}" for t in issue.get("tasks", [])],
        "",
        "### Criterios de aceptación",
        *[f"- [ ] {a}" for a in issue.get("acceptance", [])],
        "",
        "### Dependencias",
        f"- **Depende de:** {', '.join(ref(d, numbers) for d in issue.get('depends', [])) or '—'}",
        f"- **Bloquea:** {', '.join(ref(b, numbers) for b in blocks) or '—'}",
    ]
    return "\n".join(lines)


def labels_for(issue: dict) -> list[str]:
    labels = [AREA_LABEL[issue["area"]], issue["priority"]]
    labels += [f"module:{m}" for m in issue.get("modules", [])]
    return labels


def write_backlog_md(data: dict, numbers: dict[str, int], slug: str | None) -> None:
    issues = data["issues"]
    blocks = blocks_map(issues)
    out = [
        "# Backlog",
        "",
        "> Generado por `scripts/github/create_issues.py` desde `scripts/github/backlog.yaml`. **No editar a mano**: edita el YAML y vuelve a ejecutar el script.",
        "",
        "**Cómo coger trabajo:** elige la issue de **tu área** con prioridad más alta (`P0-blocker` → `P1` → `P2`) cuyas dependencias estén cerradas. Asígnatela antes de empezar.",
        "",
        "Leyenda: `P0-blocker` = genera dependencias, hacer primero · `P1` = MVP · `P2` = si da tiempo (se corta en el freeze).",
        "",
    ]
    for key, ms in data["milestones"].items():
        out += [f"## {ms['title']}", "", ms["description"], "",
                "| ID | Issue | Área | Prio | Depende de | Bloquea |", "|---|---|---|---|---|---|"]
        for i in (x for x in issues if x["milestone"] == key):
            n = numbers.get(i["id"])
            link = f"[#{n}](https://github.com/{slug}/issues/{n})" if n and slug else "—"
            deps = ", ".join(i.get("depends", [])) or "—"
            blk = ", ".join(blocks[i["id"]]) or "—"
            out.append(f"| {i['id']} | {link} {i['title']} | {i['area']} | {i['priority']} | {deps} | {blk} |")
        out.append("")

    # Grafo mermaid solo de P0 (la ruta crítica)
    p0 = [i for i in issues if i["priority"] == "P0-blocker"]
    p0_ids = {i["id"] for i in p0}
    out += ["## Ruta crítica (P0)", "", "```mermaid", "graph LR"]
    for i in p0:
        nid = i["id"].replace("-", "_")
        out.append(f'  {nid}["{i["id"]}<br/>{i["title"][:40]}"]')
        for d in i.get("depends", []):
            if d in p0_ids:
                out.append(f"  {d.replace('-', '_')} --> {nid}")
    out += ["```", ""]
    DOCS_BACKLOG.write_text("\n".join(out), encoding="utf-8")
    print(f"✔ {DOCS_BACKLOG.relative_to(ROOT)} actualizado")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="No toca GitHub; solo genera docs/backlog.md")
    args = ap.parse_args()

    data = yaml.safe_load(BACKLOG.read_text(encoding="utf-8"))
    issues = data["issues"]
    ids = [i["id"] for i in issues]
    assert len(ids) == len(set(ids)), "IDs duplicados en backlog.yaml"
    for i in issues:
        for d in i.get("depends", []):
            assert d in ids, f"{i['id']} depende de {d}, que no existe"

    if args.dry_run:
        write_backlog_md(data, {}, None)
        print(f"Dry run: {len(issues)} issues válidas.")
        return

    slug = repo_slug()
    print(f"Repo: {slug}")

    # Labels
    existing_labels = {l["name"] for l in json.loads(gh("label", "list", "--limit", "200", "--json", "name"))}
    for name, cfg in data["labels"].items():
        if name not in existing_labels:
            gh("label", "create", name, "--color", cfg["color"], "--description", cfg["description"])
            print(f"  + label {name}")

    # Milestones
    ms_list = json.loads(gh("api", f"repos/{slug}/milestones?state=all&per_page=100"))
    ms_titles = {m["title"] for m in ms_list}
    for cfg in data["milestones"].values():
        if cfg["title"] not in ms_titles:
            gh("api", f"repos/{slug}/milestones", "-f", f"title={cfg['title']}", "-f", f"description={cfg['description']}")
            print(f"  + milestone {cfg['title']}")

    # Issues existentes (idempotencia)
    existing = json.loads(gh("issue", "list", "--state", "all", "--limit", "500", "--json", "number,title"))
    numbers: dict[str, int] = {}
    for e in existing:
        m = re.match(r"\[([A-Z]+-\d+)\]", e["title"])
        if m:
            numbers[m.group(1)] = e["number"]

    blocks = blocks_map(issues)

    # Pasada 1: crear
    for i in issues:
        if i["id"] in numbers:
            continue
        title = f"[{i['id']}] {i['title']}"
        body = render_body(i, blocks[i["id"]], numbers, slug)
        cmd = ["issue", "create", "--title", title, "--body-file", "-",
               "--milestone", data["milestones"][i["milestone"]]["title"]]
        for l in labels_for(i):
            cmd += ["--label", l]
        url = gh(*cmd, input_=body).strip()
        numbers[i["id"]] = int(url.rsplit("/", 1)[-1])
        print(f"  + #{numbers[i['id']]} {title}")

    # Pasada 2: reescribir cuerpos con enlaces reales
    for i in issues:
        body = render_body(i, blocks[i["id"]], numbers, slug)
        gh("issue", "edit", str(numbers[i["id"]]), "--body-file", "-", input_=body)
    print("✔ Cuerpos actualizados con enlaces de dependencias")

    write_backlog_md(data, numbers, slug)


if __name__ == "__main__":
    main()
