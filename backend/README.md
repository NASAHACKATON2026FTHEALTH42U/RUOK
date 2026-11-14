# backend/ — servidor de a bordo (FastAPI + SQLModel + SQLite)

Dueños: **Back A** y **Back B**. El scaffolding llega en **BE-01** (#3).

Estructura objetivo (ver [`docs/architecture.md`](../docs/architecture.md)):
```
backend/
├── pyproject.toml
├── app/
│   ├── main.py  db.py  models.py  schemas.py  clock.py
│   ├── data/        environments.json, indicators.json, systems.json, interventions.json, protocols.json
│   ├── services/    assessment, alerts, liveness, comm_link, gamification, routine
│   ├── routers/     health, environments, catalog, members, measurements, assessment, alerts, tasks, game, link, demo
│   └── seed.py
└── tests/
```

Contrato de la API: [`docs/api-contract.md`](../docs/api-contract.md).
