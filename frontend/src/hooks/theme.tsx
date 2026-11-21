import { createContext, useContext, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemePreference = 'dark' | 'light' | 'system'
const storageKey = 'opspilot.theme'
const ThemeContext = createContext<{
  preference: ThemePreference
  theme: 'dark' | 'light'
  setPreference: (preference: ThemePreference) => void
}>({ preference: 'dark', theme: 'dark', setPreference: () => {} })

function storedPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(storageKey)
    if (value === 'dark' || value === 'light' || value === 'system') return value
  } catch {
    // The preference still works for this session if storage is blocked.
  }
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(storedPreference)
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useLayoutEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    media.addEventListener('change', update)
    update()
    return () => media.removeEventListener('change', update)
  }, [])

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',
      getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim())
    try {
      localStorage.setItem(storageKey, preference)
    } catch {
      // A blocked storage policy does not prevent theme changes.
    }
  }, [preference, theme])

  return <ThemeContext.Provider value={{ preference, theme, setPreference }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
