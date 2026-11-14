"""BE-19: puntos, racha, insignias y leaderboard cooperativo."""

import uuid
from datetime import date, timedelta

import pytest
from sqlmodel import Session, delete

from app import clock, models
from app.db import engine
from app.schemas import BadgeDef, BadgeRule, EventType
from app.services import gamification, routine
from app.services.gamification import Stats, meets, streak

COMPLETE = "/api/v1/members/{}/tasks/{}/complete"
GAME = "/api/v1/members/{}/game"
BOARD = "/api/v1/environments/{}/leaderboard"

# Días sin mediciones del seed (todas son de antes de "ahora"): la racha empieza de cero.
AHEAD_DAYS = 60


@pytest.fixture(autouse=True)
def clean(client):
    with Session(engine) as s:
        s.exec(delete(models.BadgeAward))
        s.exec(delete(models.TaskCompletion))
        s.exec(delete(models.Task))
        s.exec(delete(models.EventLog).where(
            models.EventLog.type == EventType.task_completed.value))
        s.commit()
    clock.advance(AHEAD_DAYS * 86400)
    yield


def today() -> date:
    return routine.today()


def complete(client, task_type="resistive_exercise", day=None, member_id=1):
    tid = routine.task_id(day or today(), member_id, task_type)
    r = client.post(COMPLETE.format(member_id, tid),
                    json={"id": str(uuid.uuid4()), "completed_at": clock.now().isoformat()})
    assert r.status_code == 200, r.text
    return r.json()


def game(client, member_id=1) -> dict:
    r = client.get(GAME.format(member_id))
    assert r.status_code == 200, r.text
    return r.json()


def badge_ids(state: dict) -> set[str]:
    return {b["id"] for b in state["badges"]}


# ── Puro ─────────────────────────────────────────────────────────────


D = date(2031, 5, 10)


@pytest.mark.parametrize(("days", "expected"), [
    (set(), 0),
    ({D}, 1),
    ({D, D - timedelta(1), D - timedelta(2)}, 3),
    ({D - timedelta(1), D - timedelta(2)}, 2),  # hoy aún no: la racha sigue viva
    ({D, D - timedelta(2)}, 1),  # un hueco la corta
    ({D - timedelta(2)}, 0),  # ayer sin nada: ya está cortada
])
def test_streak(days, expected):
    assert streak(days, D) == expected


def _badge(kind, threshold, task_type=None) -> BadgeDef:
    return BadgeDef(id="b", name="B", description="",
                    rule=BadgeRule(kind=kind, threshold=threshold, task_type=task_type))


def test_badge_rules():
    from collections import Counter
    stats = Stats(points=120, completed=8, by_type=Counter(checkin=7, walk=1),
                  active_days={D, D - timedelta(1)}, perfect_days=0)
    assert meets(_badge("points", 100), stats, D)
    assert not meets(_badge("points", 121), stats, D)
    assert meets(_badge("tasks_completed", 8), stats, D)
    assert meets(_badge("tasks_completed", 7, "checkin"), stats, D)
    assert not meets(_badge("tasks_completed", 2, "walk"), stats, D)
    assert meets(_badge("streak", 2), stats, D)
    assert not meets(_badge("streak", 3), stats, D)
    assert not meets(_badge("perfect_days", 1), stats, D)


def test_real_badges_are_consistent():
    badges = gamification.load_badges()
    gamification.check_consistency(badges, routine.list_task_types())
    assert 5 <= len(badges) <= 6


def test_badge_with_unknown_task_type_is_rejected():
    with pytest.raises(ValueError, match="juggling"):
        gamification.check_consistency(
            [_badge("tasks_completed", 1, "juggling")], routine.list_task_types())
    with pytest.raises(ValueError, match="tasks_completed"):
        gamification.check_consistency(
            [_badge("streak", 1, "checkin")], routine.list_task_types())


# ── API ──────────────────────────────────────────────────────────────


def test_empty_game_state(client):
    assert game(client) == {"points": 0, "streak_days": 0, "badges": [], "crew_points": 0}


def test_completing_tasks_updates_points_and_streak(client):
    s1 = complete(client, day=today() - timedelta(2))
    assert (s1["points"], s1["streak_days"]) == (20, 0)  # hace 2 días: ayer cortó la racha
    s2 = complete(client, day=today() - timedelta(1))
    assert (s2["points"], s2["streak_days"]) == (40, 2)
    s3 = complete(client, day=today())
    assert (s3["points"], s3["streak_days"]) == (60, 3)
    assert badge_ids(s3) == {"first_step", "streak_3"}
    assert game(client) == s3


def test_streak_breaks_but_badges_are_kept(client):
    for back in (2, 1, 0):
        complete(client, day=today() - timedelta(back))
    earned = game(client)["badges"]
    clock.advance(3 * 86400)
    state = game(client)
    assert state["streak_days"] == 0
    assert state["badges"] == earned  # mismos ids y earned_at


def test_perfect_day_badge(client):
    for task_type in ("measure_bp", "resistive_exercise"):
        assert "perfect_day" not in badge_ids(complete(client, task_type))
    assert "perfect_day" in badge_ids(complete(client, "checkin"))


def test_points_badge_and_crew_points(client):
    for back in range(5):  # 5 días × 20 puntos = 100
        state = complete(client, day=today() - timedelta(back))
    assert state["points"] == 100
    assert "points_100" in badge_ids(state)
    other = complete(client, member_id=2)  # Okafor, también en Marte
    assert (other["points"], other["crew_points"]) == (20, 120)


def test_leaderboard_is_cooperative(client):
    complete(client, member_id=2)
    complete(client, "checkin", member_id=2)
    complete(client, member_id=1)
    r = client.get(BOARD.format("mars"))
    assert r.status_code == 200, r.text
    board = r.json()
    assert board["env_id"] == "mars"
    assert board["crew_points"] == 50
    ids = [m["member_id"] for m in board["members"]]
    assert ids == sorted(ids)  # orden de members, no ranking
    by_id = {m["member_id"]: m for m in board["members"]}
    assert (by_id[1]["points"], by_id[1]["streak_days"]) == (20, 1)
    assert (by_id[2]["points"], by_id[2]["name"]) == (30, "Ing. Okafor")


def test_leaderboard_unknown_env_is_404(client):
    assert client.get(BOARD.format("pluto")).status_code == 404


def test_game_of_unknown_member_is_404(client):
    assert client.get(GAME.format(999)).status_code == 404


def test_member_cannot_read_another_members_game(client, vega_auth):
    assert client.get(GAME.format(3), headers=vega_auth).status_code == 403
