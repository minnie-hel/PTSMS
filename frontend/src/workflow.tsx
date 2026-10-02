import { Link } from "react-router-dom"

export type ProcessStep = {
  id: string
  label: string
  to?: string
  done: boolean
  current?: boolean
}

/** Shows where this record sits in the Lead → … → Reports chain. */
export function ProcessFlow({ title, steps }: { title?: string; steps: ProcessStep[] }) {
  return (
    <div className="card process-flow no-print">
      {title ? <h2 className="process-flow-title">{title}</h2> : null}
      <ol className="process-flow-steps">
        {steps.map((step) => (
          <li key={step.id} className={`${step.done ? "done" : ""} ${step.current ? "current" : ""}`}>
            {step.to ? <Link to={step.to}>{step.label}</Link> : <span>{step.label}</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}

export const PROCESS_LABELS = {
  lead: "Lead",
  client: "Client",
  booking: "Booking",
  quotation: "Quotation",
  itinerary: "Itinerary",
  invoice: "Invoice",
  payment: "Client payment",
  operations: "Operations",
  expenses: "Expenses",
  profit: "Profitability",
} as const
