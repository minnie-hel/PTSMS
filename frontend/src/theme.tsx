import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type ThemeMode = "light" | "dark"

const STORAGE_KEY = "ptsms_theme"

function readInitial(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === "light" || saved === "dark") return saved
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode
  document.documentElement.style.colorScheme = mode
}

// Apply before first paint so there is no flash of the wrong theme.
applyTheme(readInitial())

type ThemeValue = { mode: ThemeMode; toggle: () => void }

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readInitial)

  useEffect(() => {
    applyTheme(mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const value = useMemo<ThemeValue>(
    () => ({ mode, toggle: () => setMode((current) => (current === "dark" ? "light" : "dark")) }),
    [mode],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error("Theme is unavailable")
  return value
}
