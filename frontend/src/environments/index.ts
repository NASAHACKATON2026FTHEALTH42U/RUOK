/**
 * Lista provisional de entornos para el selector de la cabecera.
 *
 * TODO(FE-02): sustituir por `GET /environments` (o sus mocks, FS-04). La fuente de verdad
 * es `backend/app/data/environments.json`; aquí solo están los slugs y nombres para navegar.
 */
export const PLACEHOLDER_ENVIRONMENTS = [
  { id: 'iss', name: 'Estación Espacial Internacional' },
  { id: 'moon', name: 'Base lunar Artemis' },
  { id: 'mars', name: 'Base marciana' },
  { id: 'earth', name: 'Analógico terrestre' },
  { id: 'hospital', name: 'Planta de hospital' },
  { id: 'geriatric', name: 'Residencia geriátrica' },
] as const

export type EnvironmentId = (typeof PLACEHOLDER_ENVIRONMENTS)[number]['id']
