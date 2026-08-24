import { useEffect, useState } from 'react'

const THEMES = [
  { id: 'original', label: 'Original' },
  { id: 'dark', label: 'Dark' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'spice', label: 'Spice' },
  { id: 'forest', label: 'Forest' },
  { id: 'rose', label: 'Rose' },
  { id: 'lavender', label: 'Lavender' },
  { id: 'light', label: 'Light' },
  { id: 'mocha', label: 'Mocha' },
  { id: 'neon', label: 'Neon' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'gold', label: 'Gold' },
] as const

type ThemeName = (typeof THEMES)[number]['id']
type ThemeChoice = ThemeName | 'system'
type FontSize = 'normal' | 'large' | 'extra-large'
type ContrastPreference = 'system' | 'standard' | 'high'
type MotionPreference = 'system' | 'reduced'

const THEME_STORAGE_KEY = 'spg-theme'
const FONT_SIZE_STORAGE_KEY = 'spg-font-size'
const CONTRAST_STORAGE_KEY = 'spg-contrast'
const MOTION_STORAGE_KEY = 'spg-motion'

function isThemeName(value: string | null): value is ThemeName {
  return THEMES.some((theme) => theme.id === value)
}

function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === 'system' || isThemeName(value)
}

function isFontSize(value: string | null): value is FontSize {
  return value === 'normal' || value === 'large' || value === 'extra-large'
}

function isContrastPreference(value: string | null): value is ContrastPreference {
  return value === 'system' || value === 'standard' || value === 'high'
}

function isMotionPreference(value: string | null): value is MotionPreference {
  return value === 'system' || value === 'reduced'
}

function applyTheme(theme: ThemeChoice) {
  const root = document.documentElement
  const resolvedTheme: ThemeName =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'original'
      : theme

  root.dataset.theme = resolvedTheme
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

export default function ThemePicker() {
  // Deterministic defaults keep SSR and hydration in sync. Saved preferences
  // are restored after mount and then applied directly to the root element.
  const [theme, setTheme] = useState<ThemeChoice>('system')
  const [fontSize, setFontSize] = useState<FontSize>('normal')
  const [contrast, setContrast] = useState<ContrastPreference>('system')
  const [motion, setMotion] = useState<MotionPreference>('system')

  useEffect(() => {
    let nextTheme: ThemeChoice = 'system'
    let nextFontSize: FontSize = 'normal'
    let nextContrast: ContrastPreference = 'system'
    let nextMotion: MotionPreference = 'system'

    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
      const savedFontSize = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY)
      const savedContrast = window.localStorage.getItem(CONTRAST_STORAGE_KEY)
      const savedMotion = window.localStorage.getItem(MOTION_STORAGE_KEY)

      if (isThemeChoice(savedTheme)) nextTheme = savedTheme
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
    if (theme !== 'system') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncTheme = () => applyTheme('system')
    media.addEventListener('change', syncTheme)
    return () => media.removeEventListener('change', syncTheme)
  }, [theme])

  const selectTheme = (next: ThemeChoice) => {
    setTheme(next)
    applyTheme(next)
    persist(THEME_STORAGE_KEY, next)
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

  const resetPreferences = () => {
    setTheme('system')
    setFontSize('normal')
    setContrast('system')
    setMotion('system')

    applyTheme('system')
    applyFontSize('normal')
    applyContrast('system')
    applyMotion('system')

    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY)
      window.localStorage.removeItem(FONT_SIZE_STORAGE_KEY)
      window.localStorage.removeItem(CONTRAST_STORAGE_KEY)
      window.localStorage.removeItem(MOTION_STORAGE_KEY)
    } catch {
      // Reset still applies to the current page if storage is unavailable.
    }
  }

  return (
    <details className="pw-accessibility">
      <summary className="pw-accessibility__summary">Accessibility</summary>
      <div
        className="pw-accessibility__panel"
        role="group"
        aria-label="Accessibility and display settings"
      >
        <div className="pw-accessibility__heading">
          <strong>Accessibility &amp; display</strong>
          <span>Saved on this device</span>
        </div>

        <label className="pw-accessibility__setting" htmlFor="pw-theme">
          <span>Theme</span>
          <select
            id="pw-theme"
            value={theme}
            onChange={(event) => selectTheme(event.target.value as ThemeChoice)}
          >
            <option value="system">System (light/dark)</option>
            {THEMES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

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
            <option value="system">Device setting</option>
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
            <option value="system">Device setting</option>
            <option value="reduced">Reduce motion</option>
          </select>
        </label>

        <button
          type="button"
          className="pw-accessibility__reset"
          onClick={resetPreferences}
        >
          Reset accessibility settings
        </button>
      </div>
    </details>
  )
}
