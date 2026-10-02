import { useState, type FormEvent } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "../auth"
import { CompanyMark, DEFAULT_BRAND_NAME, useCompany } from "../company"
import { Banner, Field } from "../ui"

export function LoginPage() {
  const { signIn, user } = useAuth()
  const { company, loading: brandingLoading } = useCompany()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-panel">
        <div className="login-card">
          <header className="login-brand">
            <div className="login-logo-slot" aria-busy={brandingLoading}>
              <CompanyMark large />
            </div>
            <h1>{company.welcome_title || `Welcome to ${company.name || DEFAULT_BRAND_NAME}`}</h1>
          </header>
          <form className="login-form" onSubmit={submit}>
            <Banner>{error}</Banner>
            <Field label="Email">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="username"
                required
                placeholder="Email"
              />
            </Field>
            <Field label="Password">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                required
                placeholder="Password"
              />
            </Field>
            <button className="primary login-submit" disabled={busy} type="submit">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
