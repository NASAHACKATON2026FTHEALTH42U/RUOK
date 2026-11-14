/**
 * TEMPORAL: página para comparar las paletas de los entornos (FE-02).
 * Borrar junto con su ruta (`/dev/themes`) y el enlace del pie antes del freeze.
 */
import type { CSSProperties } from 'react'
import { PLACEHOLDER_ENVIRONMENTS } from '../../environments'
import { defaultTheme, THEMES, type Theme } from '../../environments/themes'

const TOKENS = ['bg', 'surface', 'border', 'text', 'muted', 'primary', 'primaryText'] as const

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

function Ratio({ label, a, b, min }: { label: string; a: string; b: string; min: number }) {
  const r = contrast(a, b)
  return (
    <li className="flex justify-between gap-2">
      <span>{label}</span>
      <span className={r >= min ? '' : 'font-bold underline'}>
        {r.toFixed(1)}:1 {r >= min ? '✓' : `✗ (mín. ${min})`}
      </span>
    </li>
  )
}

function ThemeCard({ id, name, theme }: { id: string; name: string; theme: Theme }) {
  const t = theme
  const box: CSSProperties = {
    background: t.bg,
    color: t.text,
    borderColor: t.border,
    colorScheme: t.scheme,
  }

  return (
    <article className="overflow-hidden rounded-xl border" style={box}>
      {/* Cabecera de ejemplo */}
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ background: t.surface, borderColor: t.border }}
      >
        <strong>
          R U OK<span style={{ color: t.text }}>?</span>
        </strong>
        <code className="text-xs" style={{ color: t.muted }}>
          {id} · {t.scheme === 'dark' ? 'oscuro' : 'claro'}
        </code>
      </header>
      <nav className="flex gap-1 px-4 pt-3 text-sm">
        <span
          className="rounded-md px-3 py-1"
          style={{ background: t.primary, color: t.primaryText }}
        >
          Panel
        </span>
        <span className="rounded-md px-3 py-1" style={{ color: t.muted }}>
          Medir
        </span>
        <span className="rounded-md px-3 py-1" style={{ color: t.muted }}>
          Alertas
        </span>
      </nav>

      <div className="space-y-3 p-4">
        <h2 className="text-lg font-semibold">{name}</h2>

        {/* Tarjeta de ejemplo */}
        <div
          className="rounded-lg border p-3"
          style={{ background: t.surface, borderColor: t.border }}
        >
          <p className="font-medium">Frecuencia cardiaca</p>
          <p className="text-sm" style={{ color: t.muted }}>
            Texto secundario: última medición hace 2 h.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm font-medium"
              style={{ background: t.primary, color: t.primaryText }}
            >
              Botón primario
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm"
              style={{ borderColor: t.border, color: t.text }}
            >
              Secundario
            </button>
          </div>
        </div>

        <p className="text-sm">
          Primary como texto (no recomendado):{' '}
          <span style={{ color: t.primary }} className="font-medium">
            enlace de ejemplo
          </span>
        </p>

        {/* Muestras y códigos */}
        <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {TOKENS.map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span
                className="h-5 w-5 shrink-0 rounded border"
                style={{ background: t[k], borderColor: t.border }}
              />
              <span>
                {k}
                <br />
                <code style={{ color: t.muted }}>{t[k]}</code>
              </span>
            </li>
          ))}
        </ul>

        <ul className="space-y-0.5 border-t pt-2 text-xs" style={{ borderColor: t.border }}>
          <Ratio label="text / bg" a={t.text} b={t.bg} min={4.5} />
          <Ratio label="text / surface" a={t.text} b={t.surface} min={4.5} />
          <Ratio label="muted / bg" a={t.muted} b={t.bg} min={4.5} />
          <Ratio label="muted / surface" a={t.muted} b={t.surface} min={4.5} />
          <Ratio label="primary / bg (no texto)" a={t.primary} b={t.bg} min={3} />
          <Ratio label="primaryText / primary" a={t.primaryText} b={t.primary} min={4.5} />
          <Ratio label="primary como texto / bg" a={t.primary} b={t.bg} min={4.5} />
        </ul>
      </div>
    </article>
  )
}

export default function ThemePreview() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Paletas por entorno (temporal)</h1>
      <p className="mt-1 text-sm text-env-muted">
        Vista de desarrollo para elegir colores. Los colores del semáforo no dependen del tema.
      </p>
      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <ThemeCard id="default" name="Por defecto (sin entorno)" theme={defaultTheme} />
        {PLACEHOLDER_ENVIRONMENTS.map((env) => (
          <ThemeCard
            key={env.id}
            id={env.id}
            name={env.name}
            theme={THEMES[env.id] ?? defaultTheme}
          />
        ))}
      </div>
    </section>
  )
}
