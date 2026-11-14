"""Modo "a bordo" (BE-24): FastAPI sirve el build del front (`frontend/dist`).

Un solo proceso y un solo puerto: los móviles de la red local abren
`http://<ip-del-servidor>:8000` y la API está en el mismo origen (`/api/v1`), sin CORS.

- Si existe el build, cualquier GET que no sea de la API devuelve el fichero pedido o,
  si no existe, `index.html` (fallback SPA: las rutas las resuelve React Router).
- Si no hay build (desarrollo con `npm run dev`, CI), no se monta nada.
- La ruta del build se puede cambiar con `FRONTEND_DIST`.
"""

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

DEFAULT_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
# Prefijos que nunca caen en el fallback SPA: un 404 de la API sigue siendo un 404 JSON.
RESERVED = ("api/", "docs", "redoc", "openapi.json")


def frontend_dist() -> Path:
    return Path(os.environ.get("FRONTEND_DIST") or DEFAULT_DIST)


def mount_frontend(app: FastAPI, dist: Path | None = None) -> bool:
    """Registra el fallback SPA. Llamar DESPUÉS de incluir los routers de la API.

    Devuelve False (y no hace nada) si no hay build.
    """
    dist = (dist or frontend_dist()).resolve()
    index = dist / "index.html"
    if not index.is_file():
        return False

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        if full_path == "api" or full_path.startswith(RESERVED):
            raise HTTPException(404, "Not Found")
        candidate = (dist / full_path).resolve()
        # Solo ficheros dentro del build (sin salir con ../).
        if full_path and candidate.is_file() and candidate.is_relative_to(dist):
            return FileResponse(candidate)
        # index.html sin caché: tras un build nuevo, los móviles cargan la versión nueva.
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    return True
