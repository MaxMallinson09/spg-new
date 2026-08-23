import { useState, useCallback, useEffect } from 'react'

import UserMenu from './UserMenu'

// Child-friendly, neutral words only: food, colors, nature, and everyday
// objects/places. No scary, violent, offensive, or awkward-to-dictate words.
//
// Animal names are deliberately excluded. They used to make up a large slice
// of the list ('Pig', 'Koala', 'Bunny' and 26 others) and were removed on
// request, so do not reintroduce them when topping the list up — reach for
// food, nature or object words instead.
//
// Words are chosen to survive being read aloud over the phone. Avoid exact
// homophones ('ball'/'bawl', 'bean'/'been', 'ice'/'eyes'), silent letters,
// unusual spellings, and words close enough to profanity to become awkward on
// a poor line ('beach', 'ship'). Simple to hear and write beats clever.
//
// Keep the list professionally neutral as well: avoid human descriptors,
// slang/innuendo, terms with obvious social or political baggage, and words
// that can sound childish or patronising when dictated to another person.
//
// The list is kept to words that read the same either side of the Atlantic.
// American-only terms ('candy', 'truck', 'corn', 'taco', 'bagel', 'wagon',
// 'cabin') were removed: a word the reader would never use themselves is a
// word they hesitate over when dictating it.
//
// Every entry is 3-5 characters. That is load-bearing, not cosmetic: three
// words plus two digits and a symbol have to fit the 12-16 character budget
// below, and candidates that overflow are thrown away. Adding a longer word
// therefore shrinks the usable keyspace instead of growing it.
const WORDS = [
  'Album', 'Amber', 'Apple', 'Audio', 'Badge', 'Bench', 'Bike', 'Boat',
  'Book', 'Boot', 'Brick', 'Broom', 'Brush', 'Bus', 'Cable', 'Card',
  'Cave', 'Chair', 'Cloud', 'Coin', 'Cube',
  'Cup', 'Desk', 'Door', 'Drop', 'Drum', 'Dust', 'Earth', 'Egg',
  'Fan', 'Farm', 'Field', 'Film', 'Flag', 'Fruit',
  'Game', 'Gift', 'Glass', 'Glove', 'Gold', 'Green', 'Grid', 'Hat',
  'Hill', 'Home', 'Honey', 'House', 'Jar', 'Jet', 'Kit',
  'Lake', 'Lamp', 'Land', 'Laser', 'Lava', 'Leaf', 'Lemon', 'Log',
  'Mango', 'Map', 'Moon', 'Motor', 'Note', 'Ocean',
  'Onion', 'Oven', 'Paint', 'Panel', 'Paper', 'Park', 'Pasta', 'Pen',
  'Piano', 'Pink', 'Pizza', 'Plant', 'Plate', 'Pond',
  'Ramp', 'Rice', 'River', 'Robot', 'Rock', 'Room',
  'Ruby', 'Sand', 'Shelf', 'Sink', 'Slide', 'Snow', 'Sock', 'Soup',
  'Star', 'Sugar', 'Table', 'Tag', 'Tent', 'Tile', 'Toast',
  'Town', 'Train', 'Tree', 'Video', 'Watch', 'Wire',
``
  'Zip', 'Zone',
]

// Words short enough that any three of them always land inside the length
// budget (4+4+4+3 = 15). Used as the guaranteed-terminating fallback below.
const SHORT_WORDS = WORDS.filter((word) => word.length <= 4)

// Symbols that are unambiguous when spoken aloud. '$', '%', '&' and '#' were
// dropped because 'dollar sign' / 'percent' / 'ampersand' / 'hash' get
// misheard or mis-typed more often than they are worth ('#' also goes by
// pound, number sign and hashtag, so listeners disagree on what was said).
// Advanced mode deliberately reuses this same set rather than widening it.
const SPECIAL_CHARS = ['!', '@', '*', '?']

const MIN_LENGTH = 12
const MAX_LENGTH = 16
const WORD_COUNT = 3
const DIGIT_POSITIONS = [1, 2, 3]
const MAX_ATTEMPTS = 500

// Advanced mode: the user picks the length, so these only bound the slider.
// 'I' / 'l' / '1' / 'O' / '0' are kept in: advanced passwords are meant to be
// copied and pasted rather than dictated, and dropping them would cost
// entropy for a readability benefit this mode is not aiming at.
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'.split('')
const DIGITS = '0123456789'.split('')
const ADVANCED_ALPHABET = [...UPPERCASE, ...LOWERCASE, ...DIGITS, ...SPECIAL_CHARS]

const ADVANCED_MIN_LENGTH = 10
const ADVANCED_MAX_LENGTH = 24
const ADVANCED_DEFAULT_LENGTH = 16

const UINT32_RANGE = 0x100000000

/**
 * Uniform random integer in [0, maxExclusive) taken from the platform CSPRNG.
 *
 * Math.random() is not usable here: V8 implements it as xorshift128+, and its
 * internal state can be recovered from a handful of observed outputs. Since a
 * single page session hands out many passwords, that would let anyone who saw
 * one of them derive the others.
 */
function randomInt(maxExclusive: number): number {
  // Discard the short tail of the uint32 range that does not divide evenly,
  // otherwise the modulo below would favour the lowest values.
  const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive
  const buffer = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return value % maxExclusive
}

function randomItem<T>(list: T[]): T {
  return list[randomInt(list.length)]
}

function randomDigits(): string {
  return String(randomInt(10)) + String(randomInt(10))
}

/** Three distinct words, with two digits after any word, then one symbol. */
function buildCandidate(list: string[]): string {
  const picked: string[] = []
  while (picked.length < WORD_COUNT) {
    const word = randomItem(list)
    if (!picked.includes(word)) picked.push(word)
  }

  const digitPosition = randomItem(DIGIT_POSITIONS)
  return [
    ...picked.slice(0, digitPosition),
    randomDigits(),
    ...picked.slice(digitPosition),
    randomItem(SPECIAL_CHARS),
  ].join('')
}

export function generatePassword(): string {
  // Rejecting whole candidates keeps every accepted password equally likely,
  // so the keyspace is exactly the set of in-budget combinations.
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = buildCandidate(WORDS)
    if (candidate.length >= MIN_LENGTH && candidate.length <= MAX_LENGTH) {
      return candidate
    }
  }
  // Any three SHORT_WORDS are in budget by construction, so this always
  // returns a well-formed password rather than truncating one.
  return buildCandidate(SHORT_WORDS)
}

/**
 * Advanced mode: `length` characters drawn from the full alphabet, with one
 * character of each class seeded up front so the result always satisfies the
 * "needs an uppercase/number/symbol" rules sites impose.
 *
 * Seeding then shuffling matters. Placing the guaranteed characters at fixed
 * positions would tell an attacker where the symbol is; the Fisher-Yates pass
 * below (also CSPRNG-driven) leaves every arrangement equally likely.
 */
export function generateAdvancedPassword(length: number): string {
  const size = Math.min(
    ADVANCED_MAX_LENGTH,
    Math.max(ADVANCED_MIN_LENGTH, Math.floor(length)),
  )

  const chars = [
    randomItem(UPPERCASE),
    randomItem(LOWERCASE),
    randomItem(DIGITS),
    randomItem(SPECIAL_CHARS),
  ]
  while (chars.length < size) {
    chars.push(randomItem(ADVANCED_ALPHABET))
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}

type CopyState = 'idle' | 'copied' | 'failed'

export default function PasswordGenerator() {
  // Generated after mount, never during SSR: the server and the client would
  // otherwise render two different passwords and fail hydration.
  const [password, setPassword] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [spin, setSpin] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [length, setLength] = useState(ADVANCED_DEFAULT_LENGTH)
  const [isDark, setIsDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const [now, setNow] = useState<Date | null>(null)

  // Covers the first render and every later change of mode or length, so the
  // password on screen always matches the controls above it.
  useEffect(() => {
    setPassword(advanced ? generateAdvancedPassword(length) : generatePassword())
    setCopyState('idle')
  }, [advanced, length])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const regenerate = useCallback(() => {
    setPassword(advanced ? generateAdvancedPassword(length) : generatePassword())
    setCopyState('idle')
    setSpin(true)
    window.setTimeout(() => setSpin(false), 420)
  }, [advanced, length])

  const copy = useCallback(async () => {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    window.setTimeout(() => setCopyState('idle'), 1800)
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
        <button
          type="button"
          onClick={() => setIsDark((prev) => !prev)}
          className="pw-theme-toggle"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
            </svg>
          )}
        </button>
        <UserMenu />
      </header>

      <main className="pw-card">
        <span className="pw-eyebrow">Simple Password Generator</span>
        <h1 className="pw-title">Generate a secure password</h1>
        <p className="pw-subtitle">
          {advanced
            ? 'Fully random characters at whatever length you need.'
            : 'Three words, two numbers, one symbol — easy to read, easy to remember.'}
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
          <code
            className={`pw-display__text ${advanced ? 'pw-display__text--dense' : ''}`}
            aria-hidden={password === null || undefined}
          >
            {password ?? '·········'}
          </code>
          <span className="pw-display__meta">
            {password ? `${password.length} characters` : 'Picking your words…'}
          </span>
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
            {copyState === 'copied'
              ? 'Copied!'
              : copyState === 'failed'
                ? "Couldn't copy"
                : 'Copy'}
          </button>
        </div>

        {/* The Copy button relabels itself on success, but a label change on the
            focused element is announced inconsistently across screen readers.
            This region states the outcome outright. */}
        <p className="pw-sr-only" role="status" aria-live="polite">
          {copyState === 'copied'
            ? 'Password copied to the clipboard.'
            : copyState === 'failed'
              ? 'Could not copy the password. Select it and copy it manually.'
              : ''}
        </p>

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
              <li>One of ! ? @ *</li>
            </>
          ) : (
            <>
              <li>12&ndash;16 characters long</li>
              <li>Three easy words that are simple to say out loud</li>
              <li>Two numbers in a varying position</li>
              <li>One special character</li>
            </>
          )}
        </ul>
      </main>
    </>
  )
}
