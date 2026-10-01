import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { api, clearSession, type SessionUser } from "./api"

type AuthValue = {
  user: SessionUser | null
  loading: boolean
  can: (code: string) => boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function refreshUser() {
    if (!localStorage.getItem("ptsms_access")) {
      setUser(null)
      return
    }
    setUser(await api<SessionUser>("/api/auth/me/"))
  }

  useEffect(() => {
    refreshUser()
      .catch(() => {
        clearSession()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      can: (code: string) => Boolean(user && (user.is_superadmin || user.permissions.includes(code))),
      signIn: async (email: string, password: string) => {
        const data = await api<{ access: string; refresh: string; user: SessionUser }>("/api/auth/token/", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        })
        localStorage.setItem("ptsms_access", data.access)
        localStorage.setItem("ptsms_refresh", data.refresh)
        setUser(data.user)
      },
      signOut: () => {
        clearSession()
        setUser(null)
      },
      refreshUser,
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("Auth is unavailable")
  return value
}
