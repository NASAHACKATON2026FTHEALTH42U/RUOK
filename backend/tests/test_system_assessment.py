import pytest

from app.schemas.common import EscalationMode, Status
from app.services.assessment import (
    build_escalation,
    escalation_for_level,
    escalation_mode,
    find_protocol,
    overall_status,
    recommendations_for,
    system_status,
    worst_status,
)

# Fixtures con la forma de docs/api-contract.md (Environment) y del formato
# propuesto para data/protocols.json.
LADDER = {"escalation_ladder": ["self", "crew", "ground"], "external_from_level": 2}
MARS = {"id": "mars", "comm_delay_s": 840, **LADDER}
ISS = {"id": "iss", "comm_delay_s": 0, **LADDER}
MOON = {"id": "moon", "comm_delay_s": 30, **LADDER}
SOLO = {"id": "solo", "comm_delay_s": 0, "escalation_ladder": ["self"], "external_from_level": 1}

PROTOCOLS = [
    {
        "id": "proto_bp_high",
        "system_id": "cardiovascular",
        "statuses": ["warning", "critical"],
        "message": "Sigue el protocolo de tensión alta.",
        "steps": ["Siéntate", "Repite la medición"],
        "recommendations": [
            {"id": "rec_bp_rest", "text": "Descansa", "priority": 2},
            {"id": "rec_bp_repeat", "text": "Repite en reposo en 15 min", "priority": 1},
        ],
    },
    {
        "id": "proto_no_data",
        "system_id": "cardiovascular",
        "statuses": ["unknown"],
        "recommendations": [{"id": "rec_measure", "text": "Toma una medición", "priority": 1}],
    },
]


# --- Acceptance criterion -------------------------------------------------


def test_onboard_levels_never_carry_the_delay():
    """BE-31: en Marte una alerta a la tripulación nunca lleva los 840 s."""
    esc = build_escalation(Status.critical, MARS)
    assert (esc.target_role, esc.mode, esc.delay_s) == ("crew", EscalationMode.realtime, 0)
    assert build_escalation(Status.critical, ISS).mode == EscalationMode.realtime


def test_external_level_on_mars_is_autonomous():
    esc = escalation_for_level(2, Status.critical, MARS)
    assert (esc.target_role, esc.mode, esc.delay_s) == ("ground", EscalationMode.autonomous, 840)


@pytest.mark.parametrize(
    ("env", "status", "expected"),
    [
        (MARS, Status.warning, EscalationMode.delayed),  # autónomo solo si critical
        (MOON, Status.critical, EscalationMode.delayed),  # 30 s: < 60 s
        (ISS, Status.critical, EscalationMode.realtime),  # sin retardo
    ],
)
def test_external_level_mode_depends_on_delay(env, status, expected):
    esc = escalation_for_level(2, status, env)
    assert esc.mode == expected
    assert esc.delay_s == env["comm_delay_s"]


@pytest.mark.parametrize("level", [0, 1])
@pytest.mark.parametrize("env", [MARS, MOON, ISS], ids=["mars", "moon", "iss"])
def test_onboard_levels_are_realtime_everywhere(env, level):
    esc = escalation_for_level(level, Status.critical, env)
    assert (esc.mode, esc.delay_s) == (EscalationMode.realtime, 0)


def test_level_is_clamped_to_the_ladder():
    assert escalation_for_level(9, Status.critical, MARS).target_role == "ground"
    assert escalation_for_level(-1, Status.critical, MARS).target_role == "self"


# --- worst / system / overall ---------------------------------------------


@pytest.mark.parametrize(
    ("statuses", "expected"),
    [
        (["normal", "normal"], Status.normal),
        (["normal", "unknown"], Status.unknown),  # unknown no cuenta como normal
        (["unknown", "warning"], Status.warning),
        (["warning", "critical", "normal"], Status.critical),
        ([], Status.unknown),
    ],
)
def test_worst_status(statuses, expected):
    assert worst_status(statuses) == expected


def test_system_and_overall_use_worst():
    cardio = system_status([Status.normal, Status.warning])
    neuro = system_status([Status.unknown])
    assert cardio == Status.warning
    assert overall_status([cardio, neuro, Status.normal]) == Status.warning
    assert overall_status([Status.normal, neuro]) == Status.unknown


# --- escalation mode -------------------------------------------------------


@pytest.mark.parametrize(
    ("delay", "status", "expected"),
    [
        (0, Status.critical, EscalationMode.realtime),
        (4, Status.warning, EscalationMode.realtime),
        (5, Status.warning, EscalationMode.delayed),
        (30, Status.critical, EscalationMode.delayed),  # < 60 s: no autónomo
        (60, Status.warning, EscalationMode.delayed),  # autónomo solo si critical
        (60, Status.critical, EscalationMode.autonomous),
        (840, Status.critical, EscalationMode.autonomous),
    ],
)
def test_escalation_mode(delay, status, expected):
    assert escalation_mode(delay, status) == expected


# --- escalation block -------------------------------------------------------


def test_warning_stays_on_self():
    esc = build_escalation(Status.warning, MARS)
    assert (esc.level, esc.target_role) == (0, "self")
    assert esc.delay_s == 0  # self es de a bordo
    assert esc.protocol_id is None


def test_critical_goes_to_next_level():
    esc = build_escalation(Status.critical, MARS)
    assert (esc.level, esc.target_role) == (1, "crew")


def test_critical_with_single_level_ladder_stays_on_self():
    esc = build_escalation(Status.critical, SOLO)
    assert (esc.level, esc.target_role) == (0, "self")


def test_moon_critical_to_crew_is_realtime():
    assert build_escalation(Status.critical, MOON).mode == EscalationMode.realtime


def test_escalation_carries_protocol():
    proto = find_protocol("cardiovascular", Status.critical, PROTOCOLS)
    esc = build_escalation(Status.critical, MARS, proto)
    assert esc.protocol_id == "proto_bp_high"
    assert esc.message == "Sigue el protocolo de tensión alta."


# --- protocols / recommendations -------------------------------------------


def test_find_protocol_by_system_and_status():
    assert find_protocol("cardiovascular", "warning", PROTOCOLS)["id"] == "proto_bp_high"
    assert find_protocol("cardiovascular", "unknown", PROTOCOLS)["id"] == "proto_no_data"
    assert find_protocol("cardiovascular", "normal", PROTOCOLS) is None
    assert find_protocol("musculoskeletal", "warning", PROTOCOLS) is None


def test_recommendations_sorted_by_priority():
    proto = find_protocol("cardiovascular", "warning", PROTOCOLS)
    assert [r.id for r in recommendations_for(proto)] == ["rec_bp_repeat", "rec_bp_rest"]


def test_no_protocol_no_recommendations():
    assert recommendations_for(None) == []
