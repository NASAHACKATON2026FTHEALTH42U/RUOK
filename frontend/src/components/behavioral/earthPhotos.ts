/**
 * Fotos de la Tierra empaquetadas en la app (FE-25): `public/earth/<id>.jpg`.
 * Todas son de la NASA (NASA Image and Video Library, Johnson Space Center), dominio público.
 * Créditos en docs/sources.md. Al estar en el build, se ven sin internet.
 */
export interface EarthPhoto {
  id: string
  src: string
  title: string
  caption: string
  date: string
}

export const EARTH_PHOTOS: EarthPhoto[] = [
  {
    id: 'as17-148-22727',
    src: '/earth/as17-148-22727.jpg',
    title: 'La canica azul',
    caption: 'La Tierra vista por la tripulación del Apolo 17 de camino a la Luna.',
    date: '7 de diciembre de 1972',
  },
  {
    id: 'as08-14-2383',
    src: '/earth/as08-14-2383.jpg',
    title: 'Salida de la Tierra',
    caption: 'La Tierra asomando sobre el horizonte lunar, fotografiada desde el Apolo 8.',
    date: '24 de diciembre de 1968',
  },
  {
    id: 'iss071e439624',
    src: '/earth/iss071e439624.jpg',
    title: 'Amanecer orbital',
    caption: 'Un amanecer ilumina la atmósfera y marca la frontera entre la noche y el día.',
    date: '6 de agosto de 2024 · Estación Espacial Internacional',
  },
  {
    id: 'iss071e364425',
    src: '/earth/iss071e364425.jpg',
    title: 'Nubes noctilucentes',
    caption: 'Nubes muy altas que brillan cuando el Sol ya está por debajo del horizonte.',
    date: '16 de julio de 2024 · Estación Espacial Internacional',
  },
  {
    id: 'iss072e518202',
    src: '/earth/iss072e518202.jpg',
    title: 'Luces de Yucatán',
    caption: 'Las ciudades de la península de Yucatán, el brillo de la atmósfera y las estrellas.',
    date: '23 de enero de 2025 · Estación Espacial Internacional',
  },
  {
    id: 'iss045e013851',
    src: '/earth/iss045e013851.jpg',
    title: 'La Tierra de noche',
    caption: 'Observación nocturna de la Tierra desde la Estación Espacial Internacional.',
    date: '17 de septiembre de 2015 · Estación Espacial Internacional',
  },
]

export const PHOTO_CREDIT = 'NASA · Johnson Space Center (dominio público)'

/** Índice siguiente o anterior, dando la vuelta. */
export function step(index: number, delta: number, length: number): number {
  return (((index + delta) % length) + length) % length
}
