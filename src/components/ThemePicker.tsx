import { useEffect, useRef, useState } from 'react'

const THEMES = [
  { id: 'original', label: 'Light theme', swatch: '#2563eb' },
  { id: 'dark', label: 'Dark', swatch: '#050505' },
  { id: 'ocean', label: 'Ocean', swatch: '#00695c' },
  { id: 'spice', label: 'Spice', swatch: '#bf360c' },
  { id: 'forest', label: 'Forest', swatch: '#1b5e20' },
  { id: 'rose', label: 'Rose', swatch: '#c2185b' },
  { id: 'lavender', label: 'Lavender', swatch: '#6a1b9a' },
  { id: 'light', label: 'Slate', swatch: '#78909c' },
  { id: 'mocha', label: 'Mocha', swatch: '#4e342e' },
  { id: 'neon', label: 'Neon', swatch: '#00ff9f' },
  { id: 'midnight', label: 'Midnight', swatch: '#4d9fff' },
  { id: 'gold', label: 'Gold', swatch: '#d4a017' },
] as const

type ThemeName = (typeof THEMES)[number]['id']
type FontSize = 'normal' | 'large' | 'extra-large'
type ContrastPreference = 'standard' | 'high'
type MotionPreference = 'standard' | 'reduced'

const THEME_STORAGE_KEY = 'spg-theme'
const FONT_SIZE_STORAGE_KEY = 'spg-font-size'
const CONTRAST_STORAGE_KEY = 'spg-contrast'
const MOTION_STORAGE_KEY = 'spg-motion'

function isThemeName(value: string | null): value is ThemeName {
  return THEMES.some((theme) => theme.id === value)
}

function isFontSize(value: string | null): value is FontSize {
  return value === 'normal' || value === 'large' || value === 'extra-large'
}

function isContrastPreference(value: string | null): value is ContrastPreference {
  return value === 'standard' || value === 'high'
}

function isMotionPreference(value: string | null): value is MotionPreference {
  return value === 'standard' || value === 'reduced'
}

function applyTheme(theme: ThemeName) {
  const root = document.documentElement
  root.dataset.theme = theme
  // Theme presets replace the old binary class toggle. Clearing it avoids an
  // older :root.dark rule fighting the selected preset if a cached page still
  // has the class from a previous session.
  root.classList.remove('dark')
}

function applyFontSize(fontSize: FontSize) {
  document.documentElement.dataset.fontSize = fontSize
}

function applyContrast(contrast: ContrastPreference) {
  document.documentElement.dataset.contrast = contrast
}

function applyMotion(motion: MotionPreference) {
  document.documentElement.dataset.motion = motion
}

function persist(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Preferences still work for the current page when storage is unavailable.
  }
}

function ThemeButtons({
  theme,
  onSelect,
}: {
  theme: ThemeName
  onSelect: (theme: ThemeName) => void
}) {
  return (
    <div className="pw-theme-grid" role="group" aria-label="Choose a theme colour">
      {THEMES.map((item) => (
        <button
          key={item.id}
          type="button"
          className="pw-theme-choice"
          aria-pressed={theme === item.id}
          onClick={() => onSelect(item.id)}
        >
          <span
            className="pw-theme-choice__swatch"
            style={{ backgroundColor: item.swatch }}
            aria-hidden="true"
          />
          <span className="pw-theme-choice__label">{item.label}</span>
          {theme === item.id && (
            <span className="pw-theme-choice__check" aria-hidden="true">
              ✓
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export default function ThemePicker() {
  // Deterministic defaults keep SSR and hydration in sync. Saved preferences
  // are restored after mount and then applied directly to the root element.
  const [theme, setTheme] = useState<ThemeName>('original')
  const [fontSize, setFontSize] = useState<FontSize>('normal')
  const [contrast, setContrast] = useState<ContrastPreference>('standard')
  const [motion, setMotion] = useState<MotionPreference>('standard')
  const [accessibilityOpen, setAccessibilityOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDetailsElement>(null)
  const accessibilityMenuRef = useRef<HTMLDivElement>(null)
  const accessibilityButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let nextTheme: ThemeName = 'original'
    let nextFontSize: FontSize = 'normal'
    let nextContrast: ContrastPreference = 'standard'
    let nextMotion: MotionPreference = 'standard'

    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
      const savedFontSize = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY)
      const savedContrast = window.localStorage.getItem(CONTRAST_STORAGE_KEY)
      const savedMotion = window.localStorage.getItem(MOTION_STORAGE_KEY)

      // Older releases stored "system" for these settings. It is deliberately
      // ignored here and migrates naturally to the new explicit defaults.
      if (isThemeName(savedTheme)) nextTheme = savedTheme
      if (isFontSize(savedFontSize)) nextFontSize = savedFontSize
      if (isContrastPreference(savedContrast)) nextContrast = savedContrast
      if (isMotionPreference(savedMotion)) nextMotion = savedMotion
    } catch {
      // Privacy modes may deny localStorage; the defaults remain fully usable.
    }

    setTheme(nextTheme)
    setFontSize(nextFontSize)
    setContrast(nextContrast)
    setMotion(nextMotion)

    applyTheme(nextTheme)
    applyFontSize(nextFontSize)
    applyContrast(nextContrast)
    applyMotion(nextMotion)
  }, [])

  useEffect(() => {
    if (!accessibilityOpen) return

    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!accessibilityMenuRef.current?.contains(target)) {
        setAccessibilityOpen(false)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setAccessibilityOpen(false)
      accessibilityButtonRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [accessibilityOpen])

  const selectTheme = (next: ThemeName) => {
    setTheme(next)
    applyTheme(next)
    persist(THEME_STORAGE_KEY, next)
    if (themeMenuRef.current) themeMenuRef.current.open = false
  }

  const selectFontSize = (next: FontSize) => {
    setFontSize(next)
    applyFontSize(next)
    persist(FONT_SIZE_STORAGE_KEY, next)
  }

  const selectContrast = (next: ContrastPreference) => {
    setContrast(next)
    applyContrast(next)
    persist(CONTRAST_STORAGE_KEY, next)
  }

  const selectMotion = (next: MotionPreference) => {
    setMotion(next)
    applyMotion(next)
    persist(MOTION_STORAGE_KEY, next)
  }

  const resetAccessibility = () => {
    setFontSize('normal')
    setContrast('standard')
    setMotion('standard')

    applyFontSize('normal')
    applyContrast('standard')
    applyMotion('standard')

    try {
      window.localStorage.removeItem(FONT_SIZE_STORAGE_KEY)
      window.localStorage.removeItem(CONTRAST_STORAGE_KEY)
      window.localStorage.removeItem(MOTION_STORAGE_KEY)
    } catch {
      // Reset still applies to the current page if storage is unavailable.
    }
  }

  const toggleAccessibility = () => {
    if (themeMenuRef.current) themeMenuRef.current.open = false
    setAccessibilityOpen((open) => !open)
  }

  const selectedTheme = THEMES.find((item) => item.id === theme) ?? THEMES[0]

  return (
    <>
      {/* Theme is a compact button/menu on desktop. On mobile this entire
          control is hidden and the same colour choices move into Settings. */}
      <details className="pw-theme-menu" ref={themeMenuRef}>
        <summary className="pw-theme-menu__summary">
          <span>Theme</span>
          <span
            className="pw-theme-menu__swatch"
            style={{ backgroundColor: selectedTheme.swatch }}
            aria-hidden="true"
          />
          <span className="pw-sr-only">{selectedTheme.label} selected</span>
        </summary>
        <div className="pw-theme-menu__panel">
          <div className="pw-theme-menu__heading">
            <strong>Choose a theme</strong>
            <span>{selectedTheme.label} is selected</span>
          </div>
          <ThemeButtons theme={theme} onSelect={selectTheme} />
        </div>
      </details>

      <div className="pw-accessibility" ref={accessibilityMenuRef}>
        <button
          ref={accessibilityButtonRef}
          type="button"
          className="pw-accessibility__summary"
          aria-expanded={accessibilityOpen}
          aria-controls="pw-accessibility-panel"
          onClick={toggleAccessibility}
        >
          <span className="pw-accessibility__summary-desktop">Accessibility</span>
          <span className="pw-accessibility__summary-mobile">Settings</span>
        </button>
        {accessibilityOpen && (
          <div
            id="pw-accessibility-panel"
            className="pw-accessibility__panel"
            role="group"
            aria-label="Accessibility settings"
          >
            <div className="pw-accessibility__heading">
              <strong>Accessibility</strong>
              <span>Saved on this device</span>
            </div>

            <div className="pw-accessibility__theme-mobile">
              <span className="pw-accessibility__theme-title">Theme</span>
              <ThemeButtons theme={theme} onSelect={selectTheme} />
            </div>

            <label className="pw-accessibility__setting" htmlFor="pw-font-size">
              <span>Text size</span>
              <select
                id="pw-font-size"
                value={fontSize}
                onChange={(event) => selectFontSize(event.target.value as FontSize)}
              >
                <option value="normal">Normal</option>
                <option value="large">Large</option>
                <option value="extra-large">Extra large</option>
              </select>
            </label>

            <label className="pw-accessibility__setting" htmlFor="pw-contrast">
              <span>Contrast</span>
              <select
                id="pw-contrast"
                value={contrast}
                onChange={(event) =>
                  selectContrast(event.target.value as ContrastPreference)
                }
              >
                <option value="standard">Standard</option>
                <option value="high">High contrast</option>
              </select>
            </label>

            <label className="pw-accessibility__setting" htmlFor="pw-motion">
              <span>Motion</span>
              <select
                id="pw-motion"
                value={motion}
                onChange={(event) => selectMotion(event.target.value as MotionPreference)}
              >
                <option value="standard">Standard</option>
                <option value="reduced">Reduce motion</option>
              </select>
            </label>

            <button
              type="button"
              className="pw-accessibility__reset"
              onClick={resetAccessibility}
            >
              Reset accessibility settings
            </button>
          </div>
        )}
      </div>
    </>
  )
}
