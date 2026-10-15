import { useState, type FormEvent } from "react"
import { api, type SessionUser } from "../api"
import { useAuth } from "../auth"
import { Field, PageTitle, PasswordInput } from "../ui"
import { useToast } from "../toast"

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const toast = useToast()
  const [fullName, setFullName] = useState(user?.full_name || "")
  const [email, setEmail] = useState(user?.email || "")
  const [phone, setPhone] = useState(user?.phone || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)

  if (!user) return null

  async function submit(event: FormEvent) {
    event.preventDefault()
    const changingPassword = Boolean(currentPassword || password || confirm)
    if (changingPassword) {
      if (!currentPassword || !password) {
        toast.error("Enter your current password and a new password.")
        return
      }
      if (password !== confirm) {
        toast.error("The two passwords do not match.")
        return
      }
    }
    setBusy(true)
    try {
      await api<SessionUser>("/api/auth/me/", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName, email, phone }),
      })
      if (changingPassword) {
        await api("/api/auth/password/", {
          method: "POST",
          body: JSON.stringify({ current_password: currentPassword, new_password: password }),
        })
        setCurrentPassword("")
        setPassword("")
        setConfirm("")
      }
      await refreshUser()
      toast.success("Profile updated.")
    } catch {
      // API errors are shown as toasts.
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageTitle title="My profile" lede="Update your details and password for this desk." />
      <form className="form-grid card" style={{ padding: 18, maxWidth: 560 }} onSubmit={submit}>
        <Field label="Full name">
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required />
        </Field>
        <Field label="Phone" wide>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <p className="wide muted" style={{ margin: "4px 0 0" }}>To change your password, fill all three fields below.</p>
        <Field label="Current password">
          <PasswordInput
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            placeholder="Current password"
          />
        </Field>
        <Field label="New password">
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={8}
            placeholder="New password"
          />
        </Field>
        <Field label="Confirm new password" wide>
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            minLength={8}
            placeholder="Confirm new password"
          />
        </Field>
        <div className="form-footer wide">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </>
  )
}
