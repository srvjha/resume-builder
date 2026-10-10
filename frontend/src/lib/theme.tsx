import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'theme'

// Runs before first paint (inlined in <head>) so the page never flashes the wrong theme.
export const themeScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'light';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`

function systemPrefersDark() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

function readStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'dark' || value === 'system' ? value : 'light'
  } catch {
    return 'light'
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light unless the visitor picks otherwise.
  const [theme, setThemeState] = useState<Theme>('light')
  const [systemDark, setSystemDark] = useState(false)

  useEffect(() => {
    setThemeState(readStoredTheme())
    setSystemDark(systemPrefersDark())
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    // Every color transition would fire at once and smear the switch, so they are off for one frame.
    const pause = document.createElement('style')
    pause.append('*,*::before,*::after{transition:none !important}')
    document.head.append(pause)
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    void document.body.offsetHeight
    requestAnimationFrame(() => requestAnimationFrame(() => pause.remove()))
    // Keep the browser chrome color in step with a theme chosen by hand.
    const color = getComputedStyle(document.body).backgroundColor
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute('content', color))
  }, [resolvedTheme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this visit.
    }
  }, [])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
