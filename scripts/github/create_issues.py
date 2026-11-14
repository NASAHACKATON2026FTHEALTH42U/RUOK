#!/usr/bin/env python3
"""Sincroniza el backlog (backlog.yaml) con GitHub: labels, milestones, issues y Kanban.

Uso:
    python3 scripts/github/create_issues.py --dry-run   # solo valida y genera docs/backlog.md
    python3 scripts/github/create_issues.py             # sincroniza todo con GitHub (requiere gh auth)

Es idempotente: identifica cada issue por el prefijo "[ID]" del título.
  1. Crea labels y milestones que falten.
  2. Crea las issues nuevas, en orden.
  3. Reescribe título, cuerpo (con enlaces #n reales) y labels gestionados de todas.
  4. Añade las issues al Project (Kanban) y rellena Área, Prioridad y Componente.
  5. Regenera docs/backlog.md.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
BACKLOG = Path(__file__).with_name("backlog.yaml")
DOCS_BACKLOG = ROOT / "docs" / "backlog.md"
ORG = "NASAHACKATON2026FTHEALTH42U"
PROJECT_NUMBER = "1"

AREA_LABEL = {a: f"area:{a}" for a in ("backend", "frontend", "fullstack", "content")}
AREA_FIELD = {"backend": "Backend", "frontend": "Frontend", "fullstack": "Fullstack", "content": "Content"}
MANAGED_PREFIXES = ("area:", "comp:", "module:")
PRIORITIES = ("P0-blocker", "P1", "P2")


# ───────────────────────── helpers ─────────────────────────
def gh(*args: str, input_: str | None = None, retries: int = 3) -> str:
    for attempt in range(retries):
        res = subprocess.run(["gh", *args], input=input_, capture_output=True, text=True)
        if res.returncode == 0:
            return res.stdout
        time.sleep(2 * (attempt + 1))  # cortes de red puntuales
    sys.exit(f"gh {' '.join(args)} falló:\n{res.stderr}")


def graphql(query: str) -> dict:
    return json.loads(gh("api", "graphql", "-f", f"query={query}"))["data"]


def comp_label(key: str) -> str:
    return f"comp:{key}"


def full_title(issue: dict, comps: dict) -> str:
    c = comps[issue["comp"]]
    return f"[{issue['id']}] {c['emoji']} {c['short']} · {issue['title']}"


def blocks_map(issues: list[dict]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {i["id"]: [] for i in issues}
    for i in issues:
        for d in i.get("depends", []):
            out[d].append(i["id"])
    return out


def ref(id_: str, numbers: dict[str, int]) -> str:
    n = numbers.get(id_)
    return f"#{n} ({id_})" if n else f"`{id_}`"


def render_body(issue: dict, blocks: list[str], numbers: dict[str, int], comps: dict, slug: str | None) -> str:
    doc = issue.get("docs")
    doc_link = f"[docs/{doc}](https://github.com/{slug}/blob/main/docs/{doc})" if slug and doc else f"`docs/{doc}`"
    c = comps[issue["comp"]]
    lines = [
        f"**ID:** `{issue['id']}` · **Componente:** {c['emoji']} {c['name']} · **Área:** {issue['area']} · **Prioridad:** {issue['priority']}",
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


def labels_for(issue: dict) -> set[str]:
    return {AREA_LABEL[issue["area"]], issue["priority"], comp_label(issue["comp"])}


def validate(data: dict) -> None:
    issues, comps = data["issues"], data["components"]
    ids = [i["id"] for i in issues]
    assert len(ids) == len(set(ids)), "IDs duplicados en backlog.yaml"
    for i in issues:
        assert i["comp"] in comps, f"{i['id']}: componente desconocido {i['comp']}"
        assert i["area"] in AREA_LABEL, f"{i['id']}: área desconocida {i['area']}"
        assert i["priority"] in PRIORITIES, f"{i['id']}: prioridad desconocida {i['priority']}"
        for d in i.get("depends", []):
            assert d in ids, f"{i['id']} depende de {d}, que no existe"


# ───────────────────────── docs/backlog.md ─────────────────────────
def write_backlog_md(data: dict, numbers: dict[str, int], slug: str | None) -> None:
    issues, comps = data["issues"], data["components"]
    blocks = blocks_map(issues)

    def link(i: dict) -> str:
        n = numbers.get(i["id"])
        return f"[#{n}](https://github.com/{slug}/issues/{n})" if n and slug else "—"

    def comp_cell(i: dict) -> str:
        c = comps[i["comp"]]
        return f"{c['emoji']} {c['short']}"

    out = [
        "# Backlog",
        "",
        "> Generado por `scripts/github/create_issues.py` desde `scripts/github/backlog.yaml`. **No editar a mano**: edita el YAML y vuelve a ejecutar el script.",
        "",
        f"📋 Kanban: https://github.com/orgs/{ORG}/projects/{PROJECT_NUMBER}",
        "",
        "**Cómo coger trabajo:** elige la issue de **tu área** con la prioridad más alta (`P0-blocker` → `P1` → `P2`) cuyas dependencias estén cerradas. Asígnatela antes de empezar.",
        "",
        "## Componentes",
        "Cada issue pertenece a **un componente**: la parte del sistema que resuelve. Aparece en el título (`[BE-02] 🗄️ BD · …`), en el label `comp:*` y en el campo *Componente* del Kanban.",
        "",
        "| Componente | Label | Qué incluye | Issues |",
        "|---|---|---|---|",
    ]
    for key, c in comps.items():
        its = [i for i in issues if i["comp"] == key]
        out.append(f"| {c['emoji']} **{c['short']}** | `comp:{key}` | {c['name']} | {', '.join(i['id'] for i in its)} |")
    out.append("")

    for key, ms in data["milestones"].items():
        out += [f"## {ms['title']}", "", ms["description"], "",
                "| ID | Componente | Issue | Área | Prio | Depende de | Bloquea |",
                "|---|---|---|---|---|---|---|"]
        for i in (x for x in issues if x["milestone"] == key):
            deps = ", ".join(i.get("depends", [])) or "—"
            blk = ", ".join(blocks[i["id"]]) or "—"
            out.append(f"| {i['id']} | {comp_cell(i)} | {link(i)} {i['title']} | {i['area']} | {i['priority']} | {deps} | {blk} |")
        out.append("")

    p0 = [i for i in issues if i["priority"] == "P0-blocker"]
    p0_ids = {i["id"] for i in p0}
    out += ["## Ruta crítica (P0)", "", "```mermaid", "graph LR"]
    for i in p0:
        nid = i["id"].replace("-", "_")
        out.append(f'  {nid}["{i["id"]} · {comps[i["comp"]]["short"]}<br/>{i["title"][:40]}"]')
        for d in i.get("depends", []):
            if d in p0_ids:
                out.append(f"  {d.replace('-', '_')} --> {nid}")
    out += ["```", ""]
    DOCS_BACKLOG.write_text("\n".join(out), encoding="utf-8")
    print(f"✔ {DOCS_BACKLOG.relative_to(ROOT)} actualizado")


# ───────────────────────── Project (Kanban) ─────────────────────────
def sync_project(data: dict, numbers: dict[str, int], slug: str) -> None:
    issues, comps = data["issues"], data["components"]
    proj = graphql(f'{{ organization(login:"{ORG}"){{ projectV2(number:{PROJECT_NUMBER}){{ id }} }} }}')
    pid = proj["organization"]["projectV2"]["id"]

    def fields() -> dict:
        return {f["name"]: f for f in json.loads(gh("project", "field-list", PROJECT_NUMBER, "--owner", ORG, "--format", "json"))["fields"]}

    f = fields()
    if "Componente" not in f:
        gh("project", "field-create", PROJECT_NUMBER, "--owner", ORG, "--name", "Componente",
           "--data-type", "SINGLE_SELECT", "--single-select-options", ",".join(c["short"] for c in comps.values()))
        f = fields()
    # opciones de Componente: conserva ids existentes, añade nuevas, aplica color y descripción
    existing = {o["name"]: o["id"] for o in f["Componente"]["options"]}
    opts = []
    for c in comps.values():
        oid = f'id:"{existing[c["short"]]}", ' if c["short"] in existing else ""
        name = c["short"].replace('"', "")
        desc = f'{c["emoji"]} {c["name"]}'.replace('"', "'")
        opts.append(f'{{{oid}name:"{name}", color:{c["project"]}, description:"{desc}"}}')
    graphql(f'mutation{{ updateProjectV2Field(input:{{fieldId:"{f["Componente"]["id"]}", singleSelectOptions:[{",".join(opts)}]}}){{ clientMutationId }} }}')
    f = fields()
    opt = lambda name: {o["name"]: o["id"] for o in f[name]["options"]}
    comp_o, area_o, prio_o, status_o = opt("Componente"), opt("Área"), opt("Prioridad"), opt("Status")

    items = {i["content"]["number"]: i for i in
             json.loads(gh("project", "item-list", PROJECT_NUMBER, "--owner", ORG, "--limit", "500", "--format", "json"))["items"]
             if i.get("content", {}).get("number")}

    def set_opt(item_id: str, field: str, option_id: str) -> None:
        gh("project", "item-edit", "--id", item_id, "--project-id", pid,
           "--field-id", f[field]["id"], "--single-select-option-id", option_id)

    for i in issues:
        n = numbers[i["id"]]
        item = items.get(n)
        if item is None:
            item_id = json.loads(gh("project", "item-add", PROJECT_NUMBER, "--owner", ORG,
                                    "--url", f"https://github.com/{slug}/issues/{n}", "--format", "json"))["id"]
            set_opt(item_id, "Status", status_o["Todo"])
            current = {}
        else:
            item_id = item["id"]
            current = {k.lower(): v for k, v in item.items()}
        wanted = {"Componente": comps[i["comp"]]["short"], "Área": AREA_FIELD[i["area"]], "Prioridad": i["priority"]}
        option_ids = {"Componente": comp_o, "Área": area_o, "Prioridad": prio_o}
        for field, value in wanted.items():
            if current.get(field.lower()) != value:
                set_opt(item_id, field, option_ids[field][value])
    print("✔ Kanban sincronizado (Área, Prioridad, Componente)")


# ───────────────────────── main ─────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="No toca GitHub; solo valida y genera docs/backlog.md")
    ap.add_argument("--no-project", action="store_true", help="No sincroniza el Kanban")
    args = ap.parse_args()

    data = yaml.safe_load(BACKLOG.read_text(encoding="utf-8"))
    validate(data)
    issues, comps = data["issues"], data["components"]

    if args.dry_run:
        write_backlog_md(data, {}, None)
        print(f"Dry run: {len(issues)} issues válidas, {len(comps)} componentes.")
        return

    slug = json.loads(gh("repo", "view", "--json", "nameWithOwner"))["nameWithOwner"]
    print(f"Repo: {slug}")

    # 1. Labels (área/prioridad del YAML + uno por componente)
    wanted_labels = dict(data["labels"])
    for key, c in comps.items():
        wanted_labels[comp_label(key)] = {"color": c["color"], "description": f"{c['emoji']} {c['name']}"[:100]}
    existing_labels = {l["name"]: l for l in json.loads(gh("label", "list", "--limit", "300", "--json", "name,color,description"))}
    for name, cfg in wanted_labels.items():
        if name not in existing_labels:
            gh("label", "create", name, "--color", cfg["color"], "--description", cfg["description"])
            print(f"  + label {name}")
        elif existing_labels[name]["color"].lower() != cfg["color"].lower() or existing_labels[name]["description"] != cfg["description"]:
            gh("label", "edit", name, "--color", cfg["color"], "--description", cfg["description"])
    for name in existing_labels:  # labels gestionados que ya no se usan (p. ej. module:*)
        if name.startswith(MANAGED_PREFIXES) and name not in wanted_labels:
            gh("label", "delete", name, "--yes")
            print(f"  - label {name}")

    # 2. Milestones
    ms_titles = {m["title"] for m in json.loads(gh("api", f"repos/{slug}/milestones?state=all&per_page=100"))}
    for cfg in data["milestones"].values():
        if cfg["title"] not in ms_titles:
            gh("api", f"repos/{slug}/milestones", "-f", f"title={cfg['title']}", "-f", f"description={cfg['description']}")
            print(f"  + milestone {cfg['title']}")

    # 3. Issues existentes (idempotencia por prefijo [ID])
    existing = json.loads(gh("issue", "list", "--state", "all", "--limit", "500", "--json", "number,title,labels"))
    numbers: dict[str, int] = {}
    current: dict[str, dict] = {}
    for e in existing:
        m = re.match(r"\[([A-Z]+-\d+)\]", e["title"])
        if m:
            numbers[m.group(1)] = e["number"]
            current[m.group(1)] = e
    blocks = blocks_map(issues)

    for i in issues:  # crear nuevas
        if i["id"] in numbers:
            continue
        cmd = ["issue", "create", "--title", full_title(i, comps), "--body-file", "-",
               "--milestone", data["milestones"][i["milestone"]]["title"]]
        for l in sorted(labels_for(i)):
            cmd += ["--label", l]
        url = gh(*cmd, input_=render_body(i, blocks[i["id"]], numbers, comps, slug)).strip()
        numbers[i["id"]] = int(url.rsplit("/", 1)[-1])
        print(f"  + #{numbers[i['id']]} {full_title(i, comps)}")

    # 4. Reescribir título, cuerpo y labels gestionados
    for i in issues:
        n = str(numbers[i["id"]])
        cmd = ["issue", "edit", n, "--title", full_title(i, comps), "--body-file", "-"]
        have = {l["name"] for l in current.get(i["id"], {}).get("labels", [])}
        want = labels_for(i)
        managed_have = {l for l in have if l.startswith(MANAGED_PREFIXES) or l in PRIORITIES}
        for l in sorted(want - have):
            cmd += ["--add-label", l]
        for l in sorted(managed_have - want):
            cmd += ["--remove-label", l]
        gh(*cmd, input_=render_body(i, blocks[i["id"]], numbers, comps, slug))
    print("✔ Títulos, cuerpos y labels actualizados")

    if not args.no_project:
        sync_project(data, numbers, slug)

    write_backlog_md(data, numbers, slug)


if __name__ == "__main__":
    main()
