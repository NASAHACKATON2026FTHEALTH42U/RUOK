"""Exporta las respuestas de la API a frontend/src/api/mocks/fixtures.gen.ts (FS-04).

Uso (desde frontend/):  npm run gen:mocks
Directo:                cd backend && uv run python scripts/export_mocks.py

Llama a cada endpoint con el TestClient de FastAPI (sin arrancar servidor, con una BD
temporal y el reloj congelado en FROZEN_NOW, así que la salida es determinista)
y escribe los datos como constantes TypeScript tipadas (`: Schema<...>`):
si el contrato cambia y los mocks dejan de encajar, `npm run build` falla.

Hoy los datos salen de app/stubs.py. Cuando los endpoints sean reales, ejecútalo
tras `POST /demo/reset` (seed de BE-07) para tener mocks con datos del seed.
"""

import json
import os
import sys
import tempfile
import uuid
from datetime import UTC, datetime
from pathlib import Path

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='ruok-mocks-')}/mocks.db"
# Clave JWT fija: el token del mock (tokenTemplate) tiene que ser determinista (BE-26).
os.environ["RUOK_JWT_SECRET"] = "ruok-mocks-jwt-secret-not-for-production"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session, delete  # noqa: E402

from app import clock, models, stubs  # noqa: E402
from app.db import engine  # noqa: E402
from app.main import app  # noqa: E402

# Reloj congelado: el mismo instante en cada ejecución, para que fixtures.gen.ts solo cambie
# cuando cambian los datos (y no dé conflictos de git por las marcas de tiempo). Se sustituye
# `datetime` dentro de app.clock (y no clock.now) porque los modelos guardan una referencia a
# clock.now en sus valores por defecto. Es el mismo instante que stubs.T0.
FROZEN_NOW = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)


class _FrozenDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return FROZEN_NOW if tz is not None else FROZEN_NOW.replace(tzinfo=None)


clock.datetime = _FrozenDatetime

API = "/api/v1"
OUT = Path(__file__).resolve().parents[2] / "frontend/src/api/mocks/fixtures.gen.ts"
NOW = "2026-11-14T10:00:00Z"


def _demo_state(post) -> None:
    """Deja a Cmdr. Vega (member 1) con un assessment de demo que mezcla los 4 estados.

    Desde BE-11 el assessment es real y el seed (BE-07) da datos normales, así que
    los mocks del front se quedarían todo en verde. En Marte:
    - cardiovascular `critical` (tensión 145 > warning 130–140) → escalado `autonomous`;
    - neuro-conductual `critical` (escenario `mars_sleep_bp`, sueño 3,5 h);
    - musculoesquelético `warning` (90 min de ejercicio);
    - radiación `unknown` (se borran sus mediciones: sin datos = desconocido);
    - inmune `normal`.
    """
    post("/demo/scenarios/mars_sleep_bp")
    now = clock.now().isoformat().replace("+00:00", "Z")
    post(
        "/members/1/measurements",
        {
            "measurements": [
                {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"mocks:{ind}")),
                    "indicator_id": ind,
                    "value": value,
                    "taken_at": now,
                }
                for ind, value in (("bp_systolic", 145), ("exercise_min", 90))
            ]
        },
    )
    with Session(engine) as s:
        s.exec(
            delete(models.Measurement).where(
                models.Measurement.member_id == 1,
                models.Measurement.indicator_id == "radiation_dose",
            )
        )
        s.commit()


def main() -> None:
    with TestClient(app) as c:

        def get(path: str):
            r = c.get(API + path)
            r.raise_for_status()
            return r.json()

        def post(path: str, body: dict | None = None):
            r = c.post(API + path, json=body)
            r.raise_for_status()
            return r.json()

        # Desde BE-06 el GET de mediciones lee la BD (vacía en este script): se
        # registra antes la medición de ejemplo para que los mocks tengan datos.
        sample = stubs.measurement(1)
        post(
            "/members/1/measurements",
            {
                "measurements": [
                    sample.model_dump(
                        mode="json", include={"id", "indicator_id", "value", "taken_at", "source"}
                    )
                ]
            },
        )

        _demo_state(post)

        envs = get("/environments")
        env_ids = [e["id"] for e in envs]
        fixtures: list[tuple[str, str, object]] = [
            ("health", "Schema<'HealthResponse'>", get("/health")),
            ("environments", "Schema<'Environment'>[]", envs),
            ("indicators", "Schema<'Indicator'>[]", get("/indicators")),
            ("systems", "Schema<'BodySystem'>[]", get("/systems")),
            ("interventions", "Schema<'Intervention'>[]", get("/interventions")),
            (
                "membersByEnv",
                "Record<string, Schema<'MemberSummary'>[]>",
                {e: get(f"/environments/{e}/members") for e in env_ids},
            ),
            (
                "assessmentByEnv",
                "Record<string, Schema<'Assessment'>>",
                {e: get(f"/members/1/assessment?env={e}") for e in env_ids},
            ),
            ("measurements", "Schema<'Measurement'>[]", get("/members/1/measurements")),
            ("alerts", "Schema<'Alert'>[]", get("/members/1/alerts")),
            (
                "groundByEnv",
                "Record<string, Schema<'GroundView'>>",
                {e: get(f"/environments/{e}/alerts?view=ground") for e in env_ids},
            ),
            ("tasks", "Schema<'Task'>[]", get("/members/1/tasks")),
            ("game", "Schema<'GameState'>", get("/members/1/game")),
            (
                "leaderboardByEnv",
                "Record<string, Schema<'Leaderboard'>>",
                {e: get(f"/environments/{e}/leaderboard") for e in env_ids},
            ),
            (
                "linkByEnv",
                "Record<string, Schema<'LinkStatus'>>",
                {e: get(f"/link?env={e}") for e in env_ids},
            ),
            ("events", "Schema<'Event'>[]", get("/events")),
            ("devices", "Schema<'Device'>[]", get("/devices")),
            ("controlOverview", "Schema<'ControlOverview'>", get("/control/overview")),
            ("networkInfo", "Schema<'NetworkInfo'>", get("/system/network-info")),
            ("users", "Schema<'User'>[]", get("/users")),
            ("demoUsers", "Schema<'DemoUser'>[]", get("/auth/demo-users")),
            (
                "tokenTemplate",
                "Schema<'TokenResponse'>",
                post("/auth/login", {"username": "vega", "password": "ruok-mars"}),
            ),
            (
                "heartbeatResult",
                "Schema<'HeartbeatResult'>",
                post("/members/1/heartbeat", {"device_id": "a3f9c2d1-7b6e-4f5a-8c9d-0e1f2a3b4c5d"}),
            ),
        ]
        operations = sorted(
            [m.upper(), p.removeprefix(API)]
            for p, ops in app.openapi()["paths"].items()
            if p.startswith(API)
            for m in ops
        )

    lines = [
        "// GENERADO por `npm run gen:mocks` (backend/scripts/export_mocks.py). NO EDITAR A MANO.",
        "// Respuestas de la API con sus tipos: si el contrato cambia, `npm run build` falla aquí.",
        "/* eslint-disable */",
        "import type { Schema } from '../client'",
        "",
        "/** Operaciones del contrato (método, ruta sin /api/v1). Cada una necesita un mock. */",
        f"export const CONTRACT_OPERATIONS = {json.dumps(operations, indent=2)} as const",
        "",
    ]
    for name, ts_type, data in fixtures:
        lines.append(
            f"export const {name}: {ts_type} = {json.dumps(data, indent=2, ensure_ascii=False)}"
        )
        lines.append("")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"✔ {OUT} ({len(fixtures)} fixtures, {len(operations)} operaciones)")


if __name__ == "__main__":
    main()
