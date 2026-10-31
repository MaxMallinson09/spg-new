export const THEMES = [
  { id: 'original', label: 'Light', swatch: '#2563eb' },
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

export const CHRISTMAS_THEME = { id: 'christmas', label: 'Christmas', swatch: '#146346' } as const

export type StandardThemeName = (typeof THEMES)[number]['id']
export type ThemeName = StandardThemeName | 'christmas'

export function isThemeName(value: string | null): value is StandardThemeName {
  // Christmas is temporary: never replace a saved year-round preference.
  return THEMES.some((theme) => theme.id === value)
}

export function isHighContrastTheme(theme: ThemeName) {
  return theme === 'original' || theme === 'dark'
}

export function isChristmasSeason(date = new Date()): boolean {
  // Local calendar dates: every December, from midnight on the 1st until Jan 1.
  return date.getMonth() === 11
}

export function themeOptions(christmasSeason: boolean) {
  return christmasSeason ? [CHRISTMAS_THEME] : THEMES
}

export function resolveTheme(
  preferred: StandardThemeName,
  contrast: 'standard' | 'high',
  christmasSeason: boolean,
): ThemeName {
  if (christmasSeason) return 'christmas'
  if (contrast === 'high') {
    return ['dark', 'neon', 'midnight'].includes(preferred) ? 'dark' : 'original'
  }
  return preferred
}

/** Refresh at local midnight and when a suspended/background page resumes. */
export function watchChristmasSeason(onChange: (active: boolean) => void): () => void {
  let timer: number
  const refresh = () => {
    const now = new Date()
    onChange(isChristmasSeason(now))
    window.clearTimeout(timer)
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    timer = window.setTimeout(refresh, midnight.getTime() - now.getTime() + 25)
  }
  window.addEventListener('focus', refresh)
  window.addEventListener('pageshow', refresh)
  document.addEventListener('visibilitychange', refresh)
  refresh()
  return () => {
    window.clearTimeout(timer)
    window.removeEventListener('focus', refresh)
    window.removeEventListener('pageshow', refresh)
    document.removeEventListener('visibilitychange', refresh)
  }
}
