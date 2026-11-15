/**
 * Generador de matrices de razonamiento (FE-39), determinista a partir de una semilla.
 *
 * Cada pieza tiene tres atributos (forma, número de figuras y relleno). Cada atributo sigue una
 * regla en la cuadrícula de 3×3: constante, cambia por fila, cambia por columna o se reparte en
 * diagonal (cuadrado latino). La pieza de la esquina inferior derecha es la respuesta.
 */
export type Shape = 'circle' | 'square' | 'triangle' | 'diamond'
export type Fill = 'outline' | 'solid' | 'hatch'
export type Count = 1 | 2 | 3

export interface Cell {
  shape: Shape
  count: Count
  fill: Fill
}

export type Attr = keyof Cell
export type Rule = 'const' | 'row' | 'col' | 'diag' | 'anti'

export interface Puzzle {
  /** Las 9 piezas por filas; la última (índice 8) es la que se oculta. */
  grid: Cell[]
  options: Cell[]
  /** Índice de la opción correcta en `options`. */
  answer: number
  rules: Record<Attr, Rule>
}

export const SHAPES: Shape[] = ['circle', 'square', 'triangle', 'diamond']
export const FILLS: Fill[] = ['outline', 'solid', 'hatch']
export const COUNTS: Count[] = [1, 2, 3]

/** Dificultad creciente: 1 regla al principio, 2 y 3 al final. */
const LEVELS: { rules: Partial<Record<Attr, Rule>>; options: number }[] = [
  { rules: { count: 'col' }, options: 4 },
  { rules: { shape: 'row' }, options: 4 },
  { rules: { shape: 'diag' }, options: 5 },
  { rules: { count: 'col', shape: 'row' }, options: 5 },
  { rules: { fill: 'col', shape: 'diag' }, options: 5 },
  { rules: { count: 'row', fill: 'diag' }, options: 6 },
  { rules: { shape: 'diag', count: 'col', fill: 'row' }, options: 6 },
  { rules: { shape: 'diag', count: 'anti', fill: 'col' }, options: 6 },
]

export const PUZZLE_COUNT = LEVELS.length

/** PRNG pequeño y determinista (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = a
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function slot(rule: Rule, r: number, c: number): number {
  switch (rule) {
    case 'const':
      return 0
    case 'row':
      return r
    case 'col':
      return c
    case 'diag':
      return (r + c) % 3
    case 'anti':
      return (r - c + 3) % 3
  }
}

export const cellKey = (c: Cell) => `${c.shape}-${c.count}-${c.fill}`

const DOMAIN: { [K in Attr]: readonly Cell[K][] } = {
  shape: SHAPES,
  count: COUNTS,
  fill: FILLS,
}

function makePuzzle(level: (typeof LEVELS)[number], rand: () => number): Puzzle {
  const rules: Record<Attr, Rule> = {
    shape: level.rules.shape ?? 'const',
    count: level.rules.count ?? 'const',
    fill: level.rules.fill ?? 'const',
  }
  const shapes = shuffle(SHAPES, rand).slice(0, 3)
  const fills = shuffle(FILLS, rand)
  // Una progresión de cantidad se lee mejor en orden (1, 2, 3 o 3, 2, 1).
  const progression = rules.count === 'row' || rules.count === 'col'
  const counts = progression
    ? rand() < 0.7
      ? [...COUNTS]
      : [...COUNTS].reverse()
    : shuffle(COUNTS, rand)

  const grid: Cell[] = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      grid.push({
        shape: shapes[slot(rules.shape, r, c)],
        count: counts[slot(rules.count, r, c)],
        fill: fills[slot(rules.fill, r, c)],
      })
    }
  }
  const correct = grid[8]

  // Distractores: la respuesta con un atributo cambiado. Primero los atributos que siguen una
  // regla (son los plausibles); luego, si faltan, los constantes y cambios dobles.
  const variants = (base: Cell, attrs: Attr[]): Cell[] =>
    attrs.flatMap((attr) =>
      DOMAIN[attr].filter((v) => v !== base[attr]).map((v) => ({ ...base, [attr]: v }) as Cell),
    )
  const ruled = (Object.keys(rules) as Attr[]).filter((a) => rules[a] !== 'const')
  const fixed = (Object.keys(rules) as Attr[]).filter((a) => rules[a] === 'const')
  const single = (attrs: Attr[]) => variants(correct, attrs)
  const doubles = single(ruled).flatMap((d) => variants(d, fixed))
  const candidates = [
    ...shuffle(single(ruled), rand),
    ...shuffle(single(fixed), rand),
    ...shuffle(doubles, rand),
  ]
  const seen = new Set([cellKey(correct)])
  const distractors: Cell[] = []
  for (const cand of candidates) {
    if (distractors.length >= level.options - 1) break
    const k = cellKey(cand)
    if (seen.has(k)) continue
    seen.add(k)
    distractors.push(cand)
  }

  const answer = Math.floor(rand() * (distractors.length + 1))
  const options = [...distractors]
  options.splice(answer, 0, correct)
  return { grid, options, answer, rules }
}

/** Los 8 patrones de una sesión, de más fácil a más difícil. */
export function makePuzzles(seed: number): Puzzle[] {
  const rand = rng(seed)
  return LEVELS.map((level) => makePuzzle(level, rand))
}

/** Puntuación 0–100: 80 % aciertos + 20 % rapidez (0 s → 20 puntos, 20 s o más → 0). */
export function scoreOf(correct: number, total: number, meanRtMs: number): number {
  if (total === 0) return 0
  const speed = Math.max(0, Math.min(1, 1 - meanRtMs / 20_000))
  return Math.round(80 * (correct / total) + 20 * speed)
}
