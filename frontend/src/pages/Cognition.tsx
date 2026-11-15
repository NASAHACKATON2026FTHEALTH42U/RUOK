import { Suspense, useState } from 'react'
import { useActiveMemberId } from '../auth/useAuth'
import { COGNITIVE_TESTS, type CognitiveTestDef } from '../components/cognition/registry'
import { loadResults, resultsOf, saveResult } from '../components/cognition/results'
import type { CognitiveResult } from '../components/cognition/types'
import { Modal } from '../components/ui/Modal'
import { NoMemberSelected } from '../components/ui/NoMemberSelected'
import { useT } from '../i18n/t'
import { dateLocale } from '../i18n/lang'

/**
 * Tests cognitivos (FE-39): cinco pruebas cortas inspiradas en la batería «Cognition» de la NASA.
 * Orientativas: el resultado se guarda en el dispositivo para ver la evolución, no es un
 * diagnóstico ni crea alertas.
 */
export default function Cognition() {
  const t = useT()
  const memberId = useActiveMemberId()
  const [active, setActive] = useState<CognitiveTestDef | null>(null)
  const [finished, setFinished] = useState<CognitiveResult | null>(null)
  const [version, setVersion] = useState(0)

  if (memberId === null) return <NoMemberSelected />
  const results = loadResults(memberId)
  void version

  const finish = (r: CognitiveResult) => {
    if (active) saveResult(memberId, active.id, r)
    setFinished(r)
    setVersion((v) => v + 1)
  }
  const close = () => {
    setActive(null)
    setFinished(null)
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{t('Tests cognitivos')}</h1>
        <p className="mt-1 max-w-3xl text-env-muted">
          {t(
            'Pruebas cortas para seguir tu rendimiento mental durante la misión. Son orientativas: compáralas contigo mismo, no con otros.',
          )}
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {COGNITIVE_TESTS.map((test, i) => {
          const mine = resultsOf(results, test.id)
          const last = mine[0]
          const prev = mine[1]
          const delta = last && prev ? Math.round(last.score - prev.score) : null
          return (
            <li key={test.id} className="hud-panel flex flex-col">
              <h2 className="hud-panel-head">
                <b>{`C-0${i + 1}`}</b>
                {t(test.title)}
              </h2>
              <div className="flex flex-1 flex-col gap-2 px-4 py-3">
                <p>{t(test.what)}</p>
                <p className="text-sm text-env-muted">{t(test.why)}</p>
                <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                  <div className="text-sm">
                    {last ? (
                      <>
                        <p className="font-display text-2xl font-semibold tabular-nums">
                          {Math.round(last.score)}
                          <span className="ml-1 font-sans text-sm text-env-muted">/100</span>
                          {delta !== null && delta !== 0 && (
                            <span
                              className={`ml-2 font-sans text-sm ${delta > 0 ? 'text-st-ok' : 'text-st-warn'}`}
                            >
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-env-muted">
                          {t('Último: {when}', {
                            when: new Date(last.at).toLocaleString(dateLocale(), {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            }),
                          })}
                        </p>
                      </>
                    ) : (
                      <p className="text-env-muted">
                        {t('Sin hacer · {n} min', { n: test.minutes })}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive(test)}
                    className="hud-btn hud-btn-primary !h-11 px-5"
                  >
                    {last ? t('Repetir') : t('Empezar')}
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {active && (
        <Modal labelledBy="cog-title" onClose={close}>
          <div className="flex min-h-full flex-col bg-env-bg text-env-text">
            <header className="flex items-center justify-between gap-3 px-[clamp(1rem,3vw,2rem)] pt-4">
              <h2 id="cog-title" className="font-display text-[clamp(1.05rem,0.9rem+0.8vw,1.5rem)]">
                {t(active.title)}
              </h2>
              <button type="button" onClick={close} className="hud-btn !h-10 px-4 !text-xs">
                {finished ? t('Cerrar') : t('Salir')}
              </button>
            </header>
            <div className="flex flex-1 flex-col items-center justify-center px-[clamp(1rem,4vw,3rem)] py-6">
              {finished ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="hud-label">{t('Resultado')}</p>
                  <p className="font-display text-[clamp(3rem,2rem+5vw,5.5rem)] font-bold tabular-nums">
                    {Math.round(finished.score)}
                    <span className="text-[0.4em] text-env-muted">/100</span>
                  </p>
                  <p className="max-w-xl text-[clamp(1rem,0.9rem+0.5vw,1.25rem)]">
                    {finished.summary}
                  </p>
                  <p className="max-w-xl text-sm text-env-muted">
                    {t('Orientativo: compáralo con tus resultados anteriores.')}
                  </p>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFinished(null)}
                      className="hud-btn !h-12 px-6"
                    >
                      {t('Repetir')}
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="hud-btn hud-btn-primary !h-12 px-6"
                    >
                      {t('Hecho')}
                    </button>
                  </div>
                </div>
              ) : (
                <Suspense
                  fallback={<div className="h-40 w-full max-w-lg animate-pulse bg-env-surface" />}
                >
                  <active.Component key={version} onFinish={finish} onCancel={close} />
                </Suspense>
              )}
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
