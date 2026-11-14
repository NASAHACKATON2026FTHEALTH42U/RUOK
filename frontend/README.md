# frontend/ — app del member y consola /ground (React + Vite + TS)

Dueños: **Front A** y **Front B**. El scaffolding llega en **FE-01** (#4).

> Al crear el proyecto Vite en esta carpeta, ejecuta `npm create vite@latest . -- --template react-ts` y elige **"Ignore files and continue"** para conservar este README (o sustitúyelo por uno propio).

Estructura objetivo (ver [`docs/architecture.md`](../docs/architecture.md)):
```
frontend/src/
├── api/            client.ts, types.gen.ts (generado: no editar), mocks/
├── offline/        outbox IndexedDB, sincronización, caché del catálogo
├── environments/   temas y vocabulario de cada entorno
├── store/          Zustand
├── pages/          EnvironmentSelect, Dashboard, Measure, History, Missions, Alerts, Ground, CheckIn
├── components/     body/, dashboard/, measure/, alerts/, behavioral/, game/, ui/
└── styles/
```
