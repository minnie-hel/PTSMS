import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { IconArrowRight } from "./icons"

export type Tone = "orange" | "navy" | "green" | "purple" | "teal" | "rose" | "amber"

/** A white card with a tinted round icon, a small label, a big value and an arrow. */
export function ModuleCard({
  icon,
  label,
  value,
  tone = "navy",
  to,
  onClick,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  tone?: Tone
  to?: string
  onClick?: () => void
}) {
  const body = (
    <>
      <span className="mc-icon">{icon}</span>
      <span className="mc-label">{label}</span>
      <span className="mc-value">{value}</span>
      <span className="mc-arrow"><IconArrowRight /></span>
    </>
  )
  if (to) return <Link to={to} className={`module-card tone-${tone}`}>{body}</Link>
  return <button type="button" onClick={onClick} className={`module-card tone-${tone}`}>{body}</button>
}
