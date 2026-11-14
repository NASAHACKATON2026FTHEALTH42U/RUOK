"""Tests de BE-12: liveness y estado global."""

from datetime import timedelta

import pytest

from app import clock
from app.schemas.common import Liveness, Status
from app.services.environments import get_environment
from app.services.liveness import combine_overall, compute_liveness, thresholds_for

CFG = {"stale_after_s": 300, "lost_after_s": 900, "eva_stale_after_s": 30, "ruok_timeout_s": 120}


# --- Criterio de aceptación ---------------------------------------------------


def test_member_without_heartbeat_is_never_overall_normal():
    """Con fast-forward del reloj de demo, la salud 'normal' nunca sobrevive."""
    mars = get_environment("mars").liveness
    last_seen = clock.now()

    # Sin heartbeat nunca.
    assert combine_overall(Status.normal, compute_liveness(None, clock.now(), mars)) != (
        Status.normal
    )

    # Recién visto: normal.
    assert combine_overall(Status.normal, compute_liveness(last_seen, clock.now(), mars)) == (
        Status.normal
    )

    # 5 min sin heartbeat: stale -> unknown.
    clock.advance(300)
    live = compute_liveness(last_seen, clock.now(), mars)
    assert live == Liveness.stale
    assert combine_overall(Status.normal, live) == Status.unknown

    # 15 min: lost -> critical.
    clock.advance(600)
    live = compute_liveness(last_seen, clock.now(), mars)
    assert live == Liveness.lost
    assert combine_overall(Status.normal, live) == Status.critical


# --- Umbrales por actividad ----------------------------------------------------


@pytest.mark.parametrize(
    ("activity", "expected"),
    [("normal", (300, 900)), ("eva", (30, 120)), ("sleep", (900, 2700))],
)
def test_thresholds_by_activity(activity, expected):
    assert thresholds_for(CFG, activity) == expected


def test_env_eva_lost_overrides_factor():
    assert thresholds_for({**CFG, "eva_lost_after_s": 60}, "eva") == (30, 60)


def test_accepts_pydantic_thresholds():
    assert thresholds_for(get_environment("iss").liveness, "eva") == (30, 120)


@pytest.mark.parametrize(
    ("age_s", "activity", "expected"),
    [
        (0, "normal", Liveness.active),
        (299, "normal", Liveness.active),
        (300, "normal", Liveness.stale),
        (899, "normal", Liveness.stale),
        (900, "normal", Liveness.lost),
        (29, "eva", Liveness.active),
        (30, "eva", Liveness.stale),
        (120, "eva", Liveness.lost),
        (600, "sleep", Liveness.active),  # 10 min dormido: todo bien
        (900, "sleep", Liveness.stale),
        (2700, "sleep", Liveness.lost),
    ],
)
def test_compute_liveness(age_s, activity, expected):
    now = clock.now()
    assert compute_liveness(now - timedelta(seconds=age_s), now, CFG, activity) == expected


def test_no_heartbeat_ever_is_stale_not_lost():
    assert compute_liveness(None, clock.now(), CFG) == Liveness.stale


# --- Estado global --------------------------------------------------------------


@pytest.mark.parametrize(
    ("health", "liveness", "expected"),
    [
        (Status.normal, Liveness.active, Status.normal),
        (Status.warning, Liveness.active, Status.warning),
        (Status.normal, Liveness.stale, Status.unknown),
        (Status.warning, Liveness.stale, Status.warning),
        (Status.critical, Liveness.stale, Status.critical),
        (Status.normal, Liveness.lost, Status.critical),
        (Status.unknown, Liveness.lost, Status.critical),
    ],
)
def test_combine_overall(health, liveness, expected):
    assert combine_overall(health, liveness) == expected
