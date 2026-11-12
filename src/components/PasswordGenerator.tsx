import { useState, useCallback, useEffect, useRef } from 'react'

import ThemePicker from './ThemePicker'
import UserMenu from './UserMenu'
import PasswordText from './PasswordText'

import {
  generateSimplePassword,
  generateAdvancedPassword,
  formatSimplePasswordReading,
  ADVANCED_MIN_LENGTH,
  ADVANCED_MAX_LENGTH,
  ADVANCED_DEFAULT_LENGTH,
  type GeneratedPassword,
} from '../lib/passwords'

export { generatePassword, generateAdvancedPassword } from '../lib/passwords'

type CopyState = 'idle' | 'copied' | 'failed'

export default function PasswordGenerator() {
  // Generated after mount, never during SSR: the server and the client would
  // otherwise render two different passwords and fail hydration.
  const [generated, setGenerated] = useState<GeneratedPassword | null>(null)
  const password = generated?.password ?? null
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const copyAttempt = useRef(0)
  const [spin, setSpin] = useState(false)
  const [advanced, setAdvanced] = useState(true)
  const [showReadingGuide, setShowReadingGuide] = useState(false)
  const [length, setLength] = useState(ADVANCED_DEFAULT_LENGTH)
  const [now, setNow] = useState<Date | null>(null)
  const readingGuide = !advanced && showReadingGuide && generated
    ? formatSimplePasswordReading(generated)
    : null

  // Covers the first render and every later change of mode or length, so the
  // password on screen always matches the controls above it.
  useEffect(() => {
    setGenerated(
      advanced ? { password: generateAdvancedPassword(length) } : generateSimplePassword(),
    )
    copyAttempt.current += 1
    setCopyState('idle')
  }, [advanced, length])

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const regenerate = useCallback(() => {
    setGenerated(
      advanced ? { password: generateAdvancedPassword(length) } : generateSimplePassword(),
    )
    copyAttempt.current += 1
    setCopyState('idle')
    setSpin(true)
    window.setTimeout(() => setSpin(false), 420)
  }, [advanced, length])

  const copy = useCallback(async () => {
    if (!password) return
    const attempt = ++copyAttempt.current
    let outcome: CopyState = 'copied'
    try {
      await navigator.clipboard.writeText(password)
    } catch {
      outcome = 'failed'
    }
    if (copyAttempt.current !== attempt) return

    setCopyState(outcome)
    if (outcome === 'copied') {
      window.setTimeout(() => {
        if (copyAttempt.current === attempt) setCopyState('idle')
      }, 1800)
    }
  }, [password])

  return (
    <>
      {/* Sits outside <main> so it is exposed as the page banner. It is
          position: fixed, so pulling it out of the card changes nothing
          visually. */}
      <header className="pw-taskbar">
        {now && (
          <span className="pw-taskbar__clock">
            {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            {' · '}
            {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
        <ThemePicker />
        <UserMenu />
      </header>

      <main className="pw-card">
        <span className="pw-eyebrow">Simple Password Generator</span>
        <h1 className="pw-title">Generate a secure password</h1>
        <p className="pw-subtitle">
          {advanced
            ? 'Fully random characters at whatever length you need.'
            : 'Two words, a three-digit number, one symbol — easy to read, easy to remember.'}
        </p>

        <div className="pw-mode">
          {/* A real checkbox, so it is a switch to assistive tech and reachable
              by keyboard for free; the track and knob below are just its
              visible skin. */}
          <label className="pw-switch" htmlFor="pw-advanced">
            <input
              id="pw-advanced"
              type="checkbox"
              role="switch"
              className="pw-switch__input"
              checked={advanced}
              onChange={(event) => setAdvanced(event.target.checked)}
            />
            <span className="pw-switch__track" aria-hidden="true">
              <span className="pw-switch__knob" />
            </span>
            <span className="pw-switch__text">
              Advanced mode
              <span className="pw-switch__hint">
                {advanced ? 'Random characters, your chosen length' : 'Word-based, easy to say aloud'}
              </span>
            </span>
          </label>
          {!advanced && (
            <label className="pw-switch" htmlFor="pw-reading-guide">
              <input
                id="pw-reading-guide"
                type="checkbox"
                role="switch"
                className="pw-switch__input"
                checked={showReadingGuide}
                onChange={(event) => setShowReadingGuide(event.target.checked)}
              />
              <span className="pw-switch__track" aria-hidden="true">
                <span className="pw-switch__knob" />
              </span>
              <span className="pw-switch__text">How to say it</span>
            </label>
          )}
        </div>

        {advanced && (
          <div className="pw-length">
            <div className="pw-length__header">
              <label className="pw-length__label" htmlFor="pw-length">
                Password length
              </label>
              <output className="pw-length__value" htmlFor="pw-length">
                {length}
              </output>
            </div>
            <input
              id="pw-length"
              type="range"
              className="pw-length__slider"
              min={ADVANCED_MIN_LENGTH}
              max={ADVANCED_MAX_LENGTH}
              step={1}
              value={length}
              onChange={(event) => setLength(Number(event.target.value))}
            />
            <div className="pw-length__scale" aria-hidden="true">
              <span>{ADVANCED_MIN_LENGTH}</span>
              <span>{ADVANCED_MAX_LENGTH}</span>
            </div>
          </div>
        )}

        <div className="pw-display" role="status" aria-live="polite">
          <h2 className="pw-sr-only">Your password</h2>
          {/* The dotted placeholder is pure filler while the first password is
              generated; the meta line below already says so in words. */}
          <PasswordText password={password} advanced={advanced} parts={generated?.parts} />
          <span className="pw-display__meta">
            {password ? `${password.length} characters` : 'Picking your words…'}
          </span>
          {password && (
            <span className="pw-display__hint">
              {advanced
                ? 'Case-sensitive · no spaces'
                : 'Only the first letter is a capital · no spaces'}
            </span>
          )}
          {readingGuide && (
            <div className="pw-display__reading">
              <span className="pw-display__meta">Read aloud</span>
              <span className="pw-display__hint">{readingGuide}</span>
            </div>
          )}
        </div>

        <div className="pw-actions">
          <button
            type="button"
            onClick={regenerate}
            className={`pw-btn pw-btn--primary ${spin ? 'pw-btn--spin' : ''}`}
          >
            <span className="pw-btn__icon" aria-hidden="true">
              &#8635;
            </span>
            New password
          </button>
          <button
            type="button"
            onClick={copy}
            className="pw-btn pw-btn--ghost"
            disabled={!password}
          >
            {copyState === 'copied' ? 'Copied!' : 'Copy'}
          </button>
          <p
            className={copyState === 'failed' ? 'pw-copy-feedback' : 'pw-sr-only'}
            role="status"
            aria-live="polite"
          >
            {copyState === 'copied'
              ? 'Password copied to the clipboard.'
              : copyState === 'failed'
                ? 'Couldn’t copy. Select the password and copy it manually.'
                : ''}
          </p>
        </div>

        <h2 className="pw-sr-only">What every password contains</h2>
        {/* role="list" is redundant in theory, but `list-style: none` strips
            list semantics in Safari/VoiceOver and this list is the only place
            the password rules are stated. */}
        <ul className="pw-checklist" role="list">
          {advanced ? (
            <>
              <li>{length} characters long</li>
              <li>Upper and lower case letters</li>
              <li>At least one number</li>
              <li>One of ! ? *</li>
            </>
          ) : (
            <>
              <li>10&ndash;14 characters long</li>
              <li>Two easy words that are simple to say out loud</li>
              <li>Only the first letter is capitalised</li>
              <li>Three digits between the words or after both words</li>
              <li>One special character</li>
            </>
          )}
        </ul>
      </main>
    </>
  )
}
