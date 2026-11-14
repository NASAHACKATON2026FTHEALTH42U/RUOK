# RUOK — Documentación

> **R U OK? (Are You OK?)** es una herramienta de autoevaluación de salud para astronautas que se adapta al entorno: ISS, Luna, Marte… y también hospitales y residencias geriátricas en la Tierra. Funciona **100 % en local** (es el ordenador de a bordo), simula el enlace con la Tierra con su retardo real y **nunca da por bueno un estado sin datos recientes**.

Reto: NASA Space Apps Challenge 2026, *Create Health Monitoring Software for Astronauts on Space Missions*.
Presentación: **domingo 16:00**.

## Índice

| Documento | Para quién | Qué contiene |
|---|---|---|
| [vision-and-scope.md](vision-and-scope.md) | Todos | Reto, idea central, diferenciadores, alcance del MVP y roadmap |
| [architecture.md](architecture.md) | Dev | Stack, estructura de carpetas, principio local-first y despliegue |
| [api-contract.md](api-contract.md) | Front + Back | **Fuente de verdad** de la API v0: convenciones, endpoints y esquemas |
| [data-model.md](data-model.md) | Back, Front B | **UML de SQLite e IndexedDB**: tablas, índices, stores y flujo de sincronización |
| [environments.md](environments.md) | Back A, Front A | Perfiles de entorno (ISS, Luna, Marte, Tierra, Hospital, Geriatría) |
| [alerts-and-escalation.md](alerts-and-escalation.md) | Back B, Front B | Alertas automáticas y manuales, escalera de escalado y enlace simulado |
| [offline-and-liveness.md](offline-and-liveness.md) | Todos los dev | Sin pérdida de datos, heartbeat, check-in "R U OK?" y consola as-of |
| [behavioral-health.md](behavioral-health.md) | Front B, Back B, Supervisor | Módulo de aislamiento y confinamiento |
| [team-and-schedule.md](team-and-schedule.md) | Todos | Roles, cronograma, hitos y reglas de trabajo |
| [backlog.md](backlog.md) | Todos | Backlog priorizado por dependencias, con enlace a las GitHub Issues |
| [demo-script.md](demo-script.md) | Supervisor + todos | Guion de la demo y plan B |
| [sources.md](sources.md) | Supervisor | Referencias NASA HRP / ESA y otras fuentes |

## Reglas de oro
0. **Nunca hagas push directo a `main`.** Todo entra por PR con la CI en verde. Lee [`LEEME.txt`](../LEEME.txt).

1. **El contrato manda.** Cualquier cambio en la API se hace primero en [api-contract.md](api-contract.md) y se avisa en el canal del equipo.
2. **Sin datos = desconocido.** Nada se pinta en verde si no hay datos recientes.
3. **Local-first.** Nada depende de internet ni de la nube.
4. **Congelación de funcionalidades el domingo a las 11:00.** A partir de ahí solo se arreglan bugs y se pule.

> ⚠️ RUOK es un prototipo de hackathon y **no es un dispositivo médico**.
