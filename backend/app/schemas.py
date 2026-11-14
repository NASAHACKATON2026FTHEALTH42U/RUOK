"""Schemas Pydantic de la API (fuente: docs/api-contract.md).

Mínimo de BE-01. FS-02 completa el resto del contrato.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"]
    server_time: datetime
