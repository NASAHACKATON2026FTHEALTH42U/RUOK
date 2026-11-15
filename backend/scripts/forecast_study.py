"""Estudio de simulación de la previsión (FS-09): de dónde salen las constantes del modelo.

Uso (desde backend/):  uv run python scripts/forecast_study.py [series por caso]

Genera series sintéticas, en unidades del ruido σ, con los comportamientos que puede tener
un indicador (estable, tendencia, rampa reciente, cambio de nivel, valor suelto…) y mide,
para varias configuraciones de `app/services/forecast.py`:

- el error absoluto medio del valor previsto frente al valor esperado REAL a 3 y 7 pasos;
- cuántas veces anuncia un cambio que no existe en una serie estable (previsión a más de
  1,5 σ de la media en algún paso).

La configuración «elegida» es la del módulo (PHI, DISCOUNT, OUTLIER_SIGMAS y RUN_MOVES); las
demás cambian una sola constante, y «Holt clásico» quita todo lo robusto. Es determinista
(semilla fija) y no toca la base de datos.
"""

import random
import sys
from math import inf
from pathlib import Path
from statistics import fmean

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import forecast  # noqa: E402

HORIZON = 7
SIZES = (30, 10)  # puntos de historial
CHOSEN = {
    name: getattr(forecast, name) for name in ("PHI", "DISCOUNT", "OUTLIER_SIGMAS", "RUN_MOVES")
}
VARIANTS: dict[str, dict[str, float]] = {
    "elegida": {},
    "PHI = 0,9": {"PHI": 0.9},
    "DISCOUNT = 1 (sin recencia)": {"DISCOUNT": 1.0},
    "DISCOUNT = 0,9": {"DISCOUNT": 0.9},
    "sin recorte ni Huber": {"OUTLIER_SIGMAS": inf},
    "sin regla de racha": {"RUN_MOVES": 10**6},
    "racha de 3 cambios": {"RUN_MOVES": 3},
    "Holt clásico (PHI 0,9)": {
        "PHI": 0.9,
        "DISCOUNT": 1.0,
        "OUTLIER_SIGMAS": inf,
        "RUN_MOVES": 10**6,
    },
}


def _mean(kind: str, n: int, rng: random.Random) -> list[float]:
    """Valor esperado real de la serie en cada paso (historial + horizonte)."""
    total = n + HORIZON
    if kind == "estable":
        return [0.0] * total
    if kind == "tendencia":
        return [0.3 * t for t in range(total)]
    if kind == "rampa que sigue":
        return [0.6 * max(0, t - (n - 6)) for t in range(total)]
    if kind == "rampa que para":
        return [0.6 * min(max(0, t - (n - 6)), 5) for t in range(total)]
    if kind == "cambio hace 5":
        return [6.0 if t >= n - 5 else 0.0 for t in range(total)]
    if kind == "cambio hace 2":
        return [6.0 if t >= n - 2 else 0.0 for t in range(total)]
    if kind == "cambio + rampa":
        return [6.0 + 0.6 * (t - (n - 5)) if t >= n - 5 else 0.0 for t in range(total)]
    if kind == "suelto al final":
        return [6.0 if t == n - 1 else 0.0 for t in range(total)]
    if kind == "suelto hace 3":
        return [6.0 if t == n - 3 else 0.0 for t in range(total)]
    walk, x = [], 0.0
    for _ in range(total):
        x = x + rng.gauss(0, 0.5) if kind == "paseo aleatorio" else 0.7 * x + rng.gauss(0, 0.7)
        walk.append(x)
    return walk


CASES = (
    "estable",
    "tendencia",
    "rampa que sigue",
    "rampa que para",
    "cambio hace 5",
    "cambio hace 2",
    "cambio + rampa",
    "suelto al final",
    "suelto hace 3",
    "paseo aleatorio",
    "AR(1)",
)


def _project(history: list[float]) -> list[float]:
    """Valores previstos a 1 … HORIZON pasos con el modelo completo."""
    fit = forecast._model(history, [True] * len(history))
    return [value for value, _ in forecast._project(fit, 1.0, HORIZON)]


Series = list[tuple[list[float], list[float]]]  # (historial, valor esperado real del horizonte)


def _evaluate(series: Series, stable: bool) -> tuple[float, float, float]:
    """(error a 3 pasos, error a 7 pasos, falsos cambios) de la configuración activa."""
    at3, at7, spurious = [], [], 0
    for history, truth in series:
        values = _project(history)
        at3.append(abs(values[2] - truth[2]))
        at7.append(abs(values[6] - truth[6]))
        spurious += stable and any(abs(v) > 1.5 for v in values)
    return fmean(at3), fmean(at7), spurious / len(series)


def main(reps: int) -> None:
    for n in SIZES:
        data: dict[str, Series] = {}
        for kind in CASES:
            rng = random.Random(f"{kind}:{n}")
            data[kind] = []
            for _ in range(reps):
                mean = _mean(kind, n, rng)
                history = [m + rng.gauss(0, 1) for m in mean[:n]]
                data[kind].append((history, mean[n:]))

        print(f"\n== {n} puntos de historial, {reps} series por caso ==")
        print("Error absoluto medio del valor previsto (en σ) a 3 / 7 pasos; «falsos» = cambios")
        print("anunciados en la serie estable.\n")
        header = f"{'configuración':<30}{'media 3':>8}{'media 7':>8}{'falsos':>8}"
        print(f"{header}   peor caso (a 7 pasos)")
        for label, changes in VARIANTS.items():
            for name, value in {**CHOSEN, **changes}.items():
                setattr(forecast, name, value)
            results = {kind: _evaluate(data[kind], kind == "estable") for kind in CASES}
            worst = max(CASES, key=lambda kind: results[kind][1])
            print(
                f"{label:<30}"
                f"{fmean(r[0] for r in results.values()):>8.2f}"
                f"{fmean(r[1] for r in results.values()):>8.2f}"
                f"{results['estable'][2]:>8.0%}"
                f"   {worst}: {results[worst][1]:.2f}"
            )
        for name, value in CHOSEN.items():
            setattr(forecast, name, value)


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 150)
