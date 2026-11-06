import clsx from 'clsx'
import type { MouseMode } from '@shared/types'
import { MOUSE_DEMO_STEPS } from './mouseDemoSteps'
import './MouseDemo.css'

/**
 * A small looping board for Settings › Board › Mouse: a pointer pans, zooms
 * and draws a selection box the way the picked mode does, with the key or
 * mouse button held for each step shown in the corner and the step named
 * under it. Still when macOS asks for reduced motion. Key it on the mode, so
 * a new pick starts from the first step.
 */
export function MouseDemo({ mode }: { mode: MouseMode }) {
  const steps = MOUSE_DEMO_STEPS[mode]
  return (
    <div className="mouse-demo" role="img" aria-label={`${steps.map((s) => s.label).join(', ')}.`}>
      <div className="mouse-demo-board">
        <div className="mouse-demo-scene">
          <div className="mouse-demo-world">
            {(['working', 'done', 'done', 'working'] as const).map((status, i) => (
              <span key={i} className={clsx('mouse-demo-card', (i === 1 || i === 2) && 'is-picked')}>
                <span className="mouse-demo-dot" data-status={status} />
                <span className="mouse-demo-line" />
                <span className="mouse-demo-line is-short" />
              </span>
            ))}
          </div>
          <span className="mouse-demo-box" />
          {steps.map((step, i) =>
            step.key ? (
              <kbd key={i} className="mouse-demo-key" data-step={i}>
                {step.key}
              </kbd>
            ) : step.button === 'right' ? (
              <span key={i} className="mouse-demo-key is-button" data-step={i}>
                <RightButton />
              </span>
            ) : null
          )}
          <span className="mouse-demo-pointer">
            <svg className="mouse-demo-arrow" viewBox="0 0 12 18" width="12" height="18" aria-hidden="true">
              <path d="M1 1v14.5l3.6-3.4 2.4 5.4 2.3-1-2.3-5.3h5L1 1z" />
            </svg>
            <span className="mouse-demo-wheel">
              <span className="mouse-demo-wheel-tick" />
            </span>
          </span>
        </div>
      </div>
      <div className="mouse-demo-steps" aria-hidden="true">
        {steps.map((step, i) => (
          <span key={step.label} className="mouse-demo-step" data-step={i}>
            {step.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** A mouse seen from above with its right button held: the corner's badge for a right-drag. */
function RightButton() {
  return (
    <svg className="mouse-demo-mouse" viewBox="0 0 10 14" width="10" height="14" aria-hidden="true">
      <path className="mouse-demo-mouse-held" d="M5 0.75a4.25 4.25 0 0 1 4.25 4.25v1.1h-4.25z" />
      <rect x="0.75" y="0.75" width="8.5" height="12.5" rx="4.25" />
      <path d="M5 1.5v4.6M1.5 6.1h7" />
    </svg>
  )
}
