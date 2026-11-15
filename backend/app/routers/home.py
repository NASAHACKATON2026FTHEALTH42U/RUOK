"""Mensaje a casa (BE-22): mensajes personales del member por el enlace con la Tierra."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from app import i18n, models
from app.routers.deps import (
    ERRORS_404,
    ERRORS_409,
    ERRORS_AUTH,
    AuthDep,
    SessionDep,
    allow_member,
)
from app.schemas import HomeMessage, HomeMessageIn, StatusSummary
from app.services import comm_link, home_messages, members, summaries

router = APIRouter(
    tags=["behavioral"], dependencies=[AuthDep], responses={**ERRORS_AUTH, **ERRORS_404}
)


def _member(session: SessionDep, member_id: int) -> models.Member:
    m = members.get_member(session, member_id)
    if m is None:
        raise HTTPException(404, i18n.tr("Member desconocido: {id}", id=member_id))
    return m


@router.post(
    "/members/{member_id}/home-messages",
    response_model=HomeMessage,
    summary="Enviar un mensaje a casa (idempotente por UUID)",
    description="Sale por el enlace con la Tierra: con el retardo del entorno, o en cola si hay "
    "LOS. Cuando llega, casa responde (simulado). Reenviar el mismo `id` devuelve el mensaje "
    "original; el mismo `id` con otro texto → 409.",
    responses=ERRORS_409,
    dependencies=[Depends(allow_member("home:write"))],
)
def send_home_message(member_id: int, body: HomeMessageIn, session: SessionDep) -> HomeMessage:
    member = _member(session, member_id)
    try:
        row = home_messages.send(session, member, body.id, body.text)
    except home_messages.IdConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    except comm_link.UnknownEnvironment as exc:
        raise HTTPException(404, str(exc)) from exc
    return home_messages.to_schema(row)


@router.get(
    "/members/{member_id}/home-messages",
    response_model=list[HomeMessage],
    summary="Hilo de mensajes a casa",
    description="Lo enviado y las respuestas ya entregadas a bordo, por orden de envío. Una "
    "respuesta en camino no aparece hasta que llega.",
    dependencies=[Depends(allow_member("home:read"))],
)
def list_home_messages(member_id: int, session: SessionDep) -> list[HomeMessage]:
    return home_messages.list_thread(session, _member(session, member_id))


@router.get(
    "/members/{member_id}/summary",
    response_model=StatusSummary,
    summary="Resumen en texto del estado de hoy o de la semana",
    description="Para contárselo a casa: se genera con los datos reales (evaluación y "
    "mediciones), sin LLM. Solo palabras de estado y nombres de sistema.",
    dependencies=[Depends(allow_member("home:read"))],
)
def get_summary(
    member_id: int, session: SessionDep, period: Literal["day", "week"] = "day"
) -> StatusSummary:
    return summaries.summary(session, _member(session, member_id), period)
