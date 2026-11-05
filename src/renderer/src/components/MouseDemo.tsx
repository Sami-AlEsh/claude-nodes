import clsx from 'clsx'
import type { MouseMode } from '@shared/types'
import './MouseDemo.css'

/** What the mouse does in each mode, in the order the demo plays them (pan, zoom, select), with the key held for it, if any. */
const STEPS: Record<MouseMode, { label: string; key?: string }[]> = {
  withKeyboard: [
    { label: 'Space + drag to pan', key: 'Space' },
    { label: '⌘ + wheel to zoom', key: '⌘' },
    { label: 'Drag to select' }
  ],
  mouseOnly: [{ label: 'Drag to pan' }, { label: 'Wheel to zoom' }, { label: '⇧ + drag to select', key: '⇧' }]
}

/**
 * A small looping board for Settings › Board › Mouse: a pointer pans, zooms
 * and draws a selection box the way the picked mode does, with the key held
 * for each step shown in the corner and the step named under it. Still when
 * macOS asks for reduced motion. Key it on the mode, so a new pick starts
 * from the first step.
 */
export function MouseDemo({ mode }: { mode: MouseMode }) {
  const steps = STEPS[mode]
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
          {steps.map(
            (step, i) =>
              step.key && (
                <kbd key={i} className="mouse-demo-key" data-step={i}>
                  {step.key}
                </kbd>
              )
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
