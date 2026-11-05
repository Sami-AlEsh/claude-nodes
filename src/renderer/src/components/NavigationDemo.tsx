import clsx from 'clsx'
import type { NavigationMode } from '@shared/types'
import './NavigationDemo.css'

/** The three things each mode does, in the order the demo plays them. */
const STEPS: Record<NavigationMode, string[]> = {
  trackpad: ['Two fingers to pan', 'Pinch to zoom', 'Drag to select'],
  mouse: ['Drag to pan', 'Wheel to zoom', '⇧-drag to select']
}

/**
 * A small looping board for Settings › Board › Navigation: it pans, zooms and
 * draws a selection box the way the picked mode does, with each step named
 * under it. Still when macOS asks for reduced motion. Key it on the mode, so
 * a new pick starts from the first step.
 */
export function NavigationDemo({ mode }: { mode: NavigationMode }) {
  const steps = STEPS[mode]
  return (
    <div className={clsx('nav-demo', `is-${mode}`)} role="img" aria-label={`${steps.join(', ')}.`}>
      <div className="nav-demo-board">
        <div className="nav-demo-scene">
          <div className="nav-demo-world">
            {(['working', 'done', 'done', 'working'] as const).map((status, i) => (
              <span key={i} className={clsx('nav-demo-card', i === 1 || i === 2 ? 'is-picked' : undefined)}>
                <span className="nav-demo-dot" data-status={status} />
                <span className="nav-demo-line" />
                <span className="nav-demo-line is-short" />
              </span>
            ))}
          </div>
          <span className="nav-demo-box" />
          {mode === 'mouse' && <kbd className="nav-demo-key">⇧</kbd>}
          <span className="nav-demo-pointer">
            <svg className="nav-demo-arrow" viewBox="0 0 12 18" width="12" height="18">
              <path d="M1 1v14.5l3.6-3.4 2.4 5.4 2.3-1-2.3-5.3h5L1 1z" />
            </svg>
            {mode === 'mouse' ? (
              <>
                <span className="nav-demo-wheel">
                  <span className="nav-demo-wheel-tick" />
                </span>
              </>
            ) : (
              <>
                <span className="nav-demo-finger is-pan" />
                <span className="nav-demo-finger is-pan is-second" />
                <span className="nav-demo-finger is-pinch" />
                <span className="nav-demo-finger is-pinch is-second" />
              </>
            )}
          </span>
        </div>
      </div>
      <div className="nav-demo-steps" aria-hidden="true">
        {steps.map((step, i) => (
          <span key={step} className="nav-demo-step" data-step={i}>
            {step}
          </span>
        ))}
      </div>
    </div>
  )
}
