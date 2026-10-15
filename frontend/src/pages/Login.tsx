import { useState, type FormEvent, type ReactNode } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { api } from "../api"
import { useAuth } from "../auth"
import { DEFAULT_BRAND_NAME, LoginBrandLogo, useCompany } from "../company"
import { Field, PasswordInput } from "../ui"
import { useToast } from "../toast"

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  minLength,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  placeholder?: string
  required?: boolean
  minLength?: number
}) {
  return (
    <Field label={label}>
      <PasswordInput
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
      />
    </Field>
  )
}

function AuthCard({ children, welcome }: { children: ReactNode; welcome?: string }) {
  const { loading: brandingLoading } = useCompany()
  return (
    <div className="login">
      <div className="login-panel">
        <div className="login-card">
          <header className="login-brand">
            <div className="login-logo-slot" aria-busy={brandingLoading}>
              <LoginBrandLogo />
            </div>
            {welcome ? <h1>{welcome}</h1> : <h1 className="sr-only">Sign in</h1>}
          </header>
          {children}
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { signIn, user } = useAuth()
  const { company } = useCompany()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/" replace />
  const welcome = company.welcome_title || `Welcome to ${company.name || DEFAULT_BRAND_NAME}`

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await signIn(email, password, remember)
    } catch {
      // API errors are shown as toasts.
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard welcome={welcome}>
      <form className="login-form" onSubmit={submit}>
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
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
          placeholder="Password"
        />
        <div className="login-extras">
          <label className="login-remember">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Remember me
          </label>
          <Link className="login-forgot" to="/forgot-password">Forgot password?</Link>
        </div>
        <button className="primary login-submit" disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthCard>
  )
}

export function ForgotPasswordPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      toast.error("The two passwords do not match.")
      return
    }
    setBusy(true)
    try {
      await api("/api/auth/forgot-password/", {
        method: "POST",
        body: JSON.stringify({ email, new_password: password }),
      })
      toast.success("Password updated. Sign in with your new password.")
      navigate("/login", { replace: true })
    } catch {
      // API errors are shown as toasts.
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard>
      <form className="login-form" onSubmit={submit}>
        <p className="login-help">Enter your email, then choose a new password.</p>
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
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="New password"
        />
        <PasswordField
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Confirm password"
        />
        <button className="primary login-submit" disabled={busy} type="submit">
          {busy ? "Saving…" : "Save password"}
        </button>
        <Link className="login-back" to="/login">Back to sign in</Link>
      </form>
    </AuthCard>
  )
}

export function ResetPasswordPage() {
  const { user } = useAuth()
  const { uid, token } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      toast.error("The two passwords do not match.")
      return
    }
    setBusy(true)
    try {
      await api("/api/auth/reset-password/", {
        method: "POST",
        body: JSON.stringify({ uid, token, new_password: password }),
      })
      toast.success("Password updated. Sign in with your new password.")
      navigate("/login", { replace: true })
    } catch {
      // API errors are shown as toasts.
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard>
      <form className="login-form" onSubmit={submit}>
        <p className="login-help">Choose a new password for your account.</p>
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="New password"
        />
        <PasswordField
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Confirm password"
        />
        <button className="primary login-submit" disabled={busy} type="submit">
          {busy ? "Saving…" : "Save password"}
        </button>
        <Link className="login-back" to="/login">Back to sign in</Link>
      </form>
    </AuthCard>
  )
}
