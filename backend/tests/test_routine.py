"""BE-18: rutina diaria. Generación desde environment.routine, completado idempotente por
UUID y autocompletado con mediciones."""

import uuid
from datetime import UTC, date, datetime

import pytest
from sqlmodel import Session, col, delete, select

from app import clock, models
from app.db import engine
from app.schemas import EventType, TaskType
from app.services import environments, routine

# Un día sin mediciones del seed (el seed genera ~30 días hacia atrás desde hoy).
DAY = date(2031, 3, 10)
TASKS = "/api/v1/members/{}/tasks"
COMPLETE = "/api/v1/members/{}/tasks/{}/complete"
MEASURE = "/api/v1/members/{}/measurements"


def at(hour: int) -> str:
    return datetime(DAY.year, DAY.month, DAY.day, hour, tzinfo=UTC).isoformat()


def completion(**kw) -> dict:
    return {"id": str(uuid.uuid4()), "completed_at": at(9), **kw}


def get_tasks(client, member_id=1, day=DAY, **kw) -> list[dict]:
    r = client.get(TASKS.format(member_id), params={"date": day.isoformat()}, **kw)
    assert r.status_code == 200, r.text
    return r.json()


def measure(client, member_id, *items):
    body = {"measurements": [
        {"id": str(uuid.uuid4()), "indicator_id": i, "value": v, "taken_at": t}
        for i, v, t in items
    ]}
    r = client.post(MEASURE.format(member_id), json=body)
    assert r.status_code == 200, r.text
    return body


def count(model) -> int:
    with Session(engine) as s:
        return len(s.exec(select(model)).all())


def task_events() -> list[models.EventLog]:
    with Session(engine) as s:
        return list(s.exec(
            select(models.EventLog).where(models.EventLog.type == EventType.task_completed.value)
        ).all())


@pytest.fixture(autouse=True)
def clean(client):
    """Sin tareas, completados ni mediciones de DAY de otros tests (la BD es compartida)."""
    with Session(engine) as s:
        s.exec(delete(models.Measurement).where(
            col(models.Measurement.taken_at) >= datetime(2031, 1, 1, tzinfo=UTC)))
        s.exec(delete(models.TaskCompletion))
        s.exec(delete(models.Task))
        s.exec(delete(models.EventLog).where(
            models.EventLog.type == EventType.task_completed.value))
        s.commit()
    # Hoy, lejos de las mediciones del seed: /complete sincroniza el día de hoy (BE-19)
    # y las del seed sumarían puntos.
    clock.advance(60 * 86400)
    yield


# ── Generación (pura) ────────────────────────────────────────────────


def test_plan_day_follows_environment_routine():
    tasks = routine.plan_day(environments.get_environment("mars"), 1, DAY)
    assert [t.id for t in tasks] == [
        "t_2031-03-10_1_measure_bp",
        "t_2031-03-10_1_resistive_exercise",
        "t_2031-03-10_1_checkin",
    ]
    bp = tasks[0]
    assert (bp.points, bp.due, bp.indicator_id, bp.date) == (10, "morning", "bp_systolic", DAY)
    assert tasks[1].points == 20 and tasks[1].indicator_id is None


def test_plan_day_repeats_with_numbered_ids_and_slots():
    tasks = routine.plan_day(environments.get_environment("geriatric"), 17, DAY)
    water = [t for t in tasks if t.task_type == "hydration"]
    assert [t.id for t in water] == [f"t_2031-03-10_17_hydration_{n}" for n in (1, 2, 3)]
    assert [t.due for t in water] == ["morning", "afternoon", "evening"]
    assert water[1].title.endswith("(2/3)")
    assert {t.points for t in water} == {5}


def test_real_task_types_and_routines_are_consistent():
    types = routine.load_task_types()
    routine.check_consistency(types, environments.list_environments())
    assert {"measure_bp", "checkin", "walk", "hydration"} <= {t.id for t in types}


def test_unknown_task_type_or_indicator_is_rejected():
    env = environments.get_environment("mars")
    bad_env = env.model_copy(update={"routine": [
        env.routine[0].model_copy(update={"task_type": "juggling"})]})
    with pytest.raises(ValueError, match="juggling"):
        routine.check_consistency(routine.load_task_types(), [bad_env])
    bad_type = TaskType(id="measure_bp", title="x", indicator_id="no_such_indicator")
    with pytest.raises(ValueError, match="no_such_indicator"):
        routine.check_consistency([bad_type], [])


# ── GET /tasks ───────────────────────────────────────────────────────


def test_get_generates_once_and_returns_contract_shape(client):
    first = get_tasks(client)
    assert [t["task_type"] for t in first] == ["measure_bp", "resistive_exercise", "checkin"]
    assert all(t["completed"] is False for t in first)
    assert set(first[0]) == {"id", "task_type", "title", "points", "due", "completed",
                             "indicator_id"}
    assert get_tasks(client) == first  # repetir no duplica
    assert count(models.Task) == 3


def test_get_defaults_to_today(client):
    r = client.get(TASKS.format(1))
    assert r.status_code == 200
    assert r.json()[0]["id"].startswith(f"t_{routine.today().isoformat()}_1_")


def test_get_unknown_member_is_404(client):
    assert client.get(TASKS.format(999)).status_code == 404


# ── POST /complete ───────────────────────────────────────────────────


def test_complete_is_idempotent_by_uuid(client):
    tid = get_tasks(client)[1]["id"]  # resistive_exercise, 20 puntos
    body = completion()
    r1 = client.post(COMPLETE.format(1, tid), json=body)
    assert r1.status_code == 200, r1.text
    assert r1.json()["points"] == 20
    r2 = client.post(COMPLETE.format(1, tid), json=body)  # reintento del outbox
    assert r2.status_code == 200
    assert r2.json()["points"] == 20
    assert count(models.TaskCompletion) == 1
    assert len(task_events()) == 1
    assert next(t for t in get_tasks(client) if t["id"] == tid)["completed"] is True


def test_completed_task_with_another_uuid_does_not_add_twice(client):
    tid = get_tasks(client)[1]["id"]
    client.post(COMPLETE.format(1, tid), json=completion())
    r = client.post(COMPLETE.format(1, tid), json=completion())  # otro dispositivo
    assert r.status_code == 200
    assert r.json()["points"] == 20
    assert count(models.TaskCompletion) == 1


def test_same_uuid_for_another_task_is_409(client):
    tasks = get_tasks(client)
    body = completion()
    assert client.post(COMPLETE.format(1, tasks[1]["id"]), json=body).status_code == 200
    r = client.post(COMPLETE.format(1, tasks[2]["id"]), json=body)
    assert r.status_code == 409
    assert count(models.TaskCompletion) == 1


def test_crew_points_add_up_the_environment(client):
    for member_id in (1, 2):  # los dos en Marte
        tid = get_tasks(client, member_id)[1]["id"]
        r = client.post(COMPLETE.format(member_id, tid), json=completion())
    assert r.json()["points"] == 20
    assert r.json()["crew_points"] == 40


def test_unknown_or_foreign_task_is_404(client):
    get_tasks(client, 2)
    assert client.post(COMPLETE.format(1, "t_nope"), json=completion()).status_code == 404
    foreign = "t_2031-03-10_2_resistive_exercise"  # existe, pero es de Okafor
    assert client.post(COMPLETE.format(1, foreign), json=completion()).status_code == 404


def test_complete_from_outbox_before_the_day_was_generated(client):
    r = client.post(COMPLETE.format(1, "t_2031-03-10_1_checkin"), json=completion())
    assert r.status_code == 200, r.text
    assert r.json()["points"] == 10
    assert len(get_tasks(client)) == 3
    with Session(engine) as s:
        day_tasks = s.exec(select(models.Task).where(models.Task.date == DAY)).all()
    assert len(day_tasks) == 3


def test_member_cannot_complete_another_members_task(client, vega_auth):
    tid = get_tasks(client, 2)[1]["id"]
    r = client.post(COMPLETE.format(2, tid), json=completion(), headers=vega_auth)
    assert r.status_code == 403


def test_task_completed_event(client):
    tid = get_tasks(client)[1]["id"]
    client.post(COMPLETE.format(1, tid), json=completion())
    (ev,) = task_events()
    assert (ev.env_id, ev.member_id, ev.ref_id) == ("mars", 1, tid)
    assert ev.payload["points"] == 20 and ev.payload["auto"] is False


# ── Autocompletado con mediciones ────────────────────────────────────


def test_measurement_autocompletes_its_task(client):
    get_tasks(client)
    body = measure(client, 1, ("bp_systolic", 118, at(8)))
    tasks = {t["task_type"]: t["completed"] for t in get_tasks(client)}
    assert tasks == {"measure_bp": True, "resistive_exercise": False, "checkin": False}
    (ev,) = task_events()
    assert ev.payload["auto"] is True
    # Reenviar el mismo lote no completa nada más.
    client.post(MEASURE.format(1), json=body)
    assert count(models.TaskCompletion) == 1


def test_measurement_before_the_day_is_generated_counts(client):
    measure(client, 1, ("mood", 4, at(20)))
    tasks = {t["task_type"]: t["completed"] for t in get_tasks(client)}
    assert tasks["checkin"] is True


def test_measurement_of_another_day_does_not_complete(client):
    get_tasks(client)
    measure(client, 1, ("bp_systolic", 118, "2031-03-11T08:00:00+00:00"))
    assert not any(t["completed"] for t in get_tasks(client))


def test_each_measurement_completes_one_repetition(client):
    measure(client, 17, ("hydration_ml", 250, at(8)), ("hydration_ml", 250, at(13)))
    water = [t for t in get_tasks(client, 17) if t["task_type"] == "hydration"]
    assert [t["completed"] for t in water] == [True, True, False]
    get_tasks(client, 17)  # volver a pedirlas no reutiliza las mismas mediciones
    assert count(models.TaskCompletion) == 2
