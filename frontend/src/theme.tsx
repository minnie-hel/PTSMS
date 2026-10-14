import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type ThemeMode = "light" | "dark"

const STORAGE_KEY = "ptsms_color_mode"

function readInitial(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === "light" || saved === "dark") return saved
  return "light"
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
  }, [mode])

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      toggle: () =>
        setMode((current) => {
          const next = current === "dark" ? "light" : "dark"
          localStorage.setItem(STORAGE_KEY, next)
          return next
        }),
    }),
    [mode],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error("Theme is unavailable")
  return value
}
