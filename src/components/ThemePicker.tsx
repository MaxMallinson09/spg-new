import { useEffect, useState } from 'react'

const THEMES = [
  { id: 'original', label: 'Original', swatch: '#2563eb' },
  { id: 'dark', label: 'Dark', swatch: '#050505' },
  { id: 'ocean', label: 'Ocean', swatch: '#00695c' },
  { id: 'spice', label: 'Spice', swatch: '#bf360c' },
  { id: 'forest', label: 'Forest', swatch: '#1b5e20' },
  { id: 'rose', label: 'Rose', swatch: '#c2185b' },
  { id: 'lavender', label: 'Lavender', swatch: '#6a1b9a' },
  { id: 'light', label: 'Light', swatch: '#78909c' },
  { id: 'mocha', label: 'Mocha', swatch: '#4e342e' },
  { id: 'neon', label: 'Neon', swatch: '#00ff9f' },
  { id: 'midnight', label: 'Midnight', swatch: '#4d9fff' },
  { id: 'gold', label: 'Gold', swatch: '#d4a017' },
] as const

type ThemeName = (typeof THEMES)[number]['id']

const STORAGE_KEY = 'spg-theme'

function isThemeName(value: string | null): value is ThemeName {
  return THEMES.some((theme) => theme.id === value)
}

function applyTheme(theme: ThemeName) {
  const root = document.documentElement
  root.dataset.theme = theme
  // Theme presets replace the old binary class toggle. Clearing it avoids an
  // older :root.dark rule fighting the selected preset if a cached page still
  // has the class from a previous session.
  root.classList.remove('dark')
}

export default function ThemePicker() {
  // Keep the server render deterministic, then restore the saved/system choice
  // after mount so SSR and hydration never disagree about the selected option.
  const [theme, setTheme] = useState<ThemeName>('original')

  useEffect(() => {
    let next: ThemeName = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'original'

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (isThemeName(saved)) next = saved
    } catch {
      // Theme persistence is optional; privacy modes may deny localStorage.
    }

    setTheme(next)
    applyTheme(next)
  }, [])

  const selectTheme = (next: ThemeName) => {
    setTheme(next)
    applyTheme(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // The visual change still works even when persistence is unavailable.
    }
  }

  const selected = THEMES.find((item) => item.id === theme) ?? THEMES[0]

  return (
    <label className="pw-theme-picker">
      <span
        className="pw-theme-picker__swatch"
        style={{ backgroundColor: selected.swatch }}
        aria-hidden="true"
      />
      <span className="pw-sr-only">Theme</span>
      <select
        className="pw-theme-picker__select"
        value={theme}
        onChange={(event) => selectTheme(event.target.value as ThemeName)}
        aria-label="Theme"
      >
        {THEMES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}
