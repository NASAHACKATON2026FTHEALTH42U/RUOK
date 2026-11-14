import type { Vocabulary } from '../store/environment'

/**
 * Lista provisional de entornos para el selector de la cabecera.
 *
 * TODO(FS-04): sustituir por `GET /environments` (o sus mocks). La fuente de verdad es
 * `backend/app/data/environments.json`; aquí solo están el slug, el nombre y el vocabulario
 * (copiados de docs/environments.md) para poder navegar y probar los textos.
 */
export const PLACEHOLDER_ENVIRONMENTS = [
  {
    id: 'iss',
    name: 'Estación Espacial Internacional',
    vocabulary: { member: 'astronauta', crew: 'tripulación', ground: 'flight surgeon' },
  },
  {
    id: 'moon',
    name: 'Base lunar Artemis',
    vocabulary: { member: 'astronauta', crew: 'tripulación', ground: 'flight surgeon' },
  },
  {
    id: 'mars',
    name: 'Base marciana',
    vocabulary: { member: 'astronauta', crew: 'tripulación', ground: 'flight surgeon' },
  },
  {
    id: 'earth',
    name: 'Analógico terrestre',
    vocabulary: { member: 'participante', crew: 'equipo', ground: 'médico' },
  },
  {
    id: 'hospital',
    name: 'Planta de hospital',
    vocabulary: { member: 'paciente', crew: 'planta', ground: 'enfermería' },
  },
  {
    id: 'geriatric',
    name: 'Residencia geriátrica',
    vocabulary: { member: 'residente', crew: 'residencia', ground: 'cuidador' },
  },
] as const satisfies readonly { id: string; name: string; vocabulary: Vocabulary }[]

export type EnvironmentId = (typeof PLACEHOLDER_ENVIRONMENTS)[number]['id']
