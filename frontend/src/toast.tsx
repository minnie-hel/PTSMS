import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { sanitizeUserMessage } from "./errors"

type ToastItem = { id: number; message: string; tone: "success" | "error" }

const ToastContext = createContext<{ success: (message: string) => void; error: (message: string) => void } | null>(null)

export function crudSuccessMessage(create: boolean) {
  return create ? "Created successfully" : "Updated successfully"
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((message: string, tone: ToastItem["tone"]) => {
    const text = sanitizeUserMessage(message, tone === "error" ? "Something went wrong. Please try again." : message)
    if (!text) return
    const id = Date.now() + Math.random()
    setItems((current) => {
      if (current.some((item) => item.message === text && item.tone === tone)) return current
      return [...current, { id, message: text, tone }]
    })
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 4200)
  }, [])

  const success = useCallback((message: string) => push(message, "success"), [push])
  const error = useCallback((message: string) => push(message, "error"), [push])

  useEffect(() => {
    function onError(event: Event) {
      const message = (event as CustomEvent<string>).detail
      if (typeof message === "string" && message) error(message)
    }
    window.addEventListener("ptsms:error", onError)
    return () => window.removeEventListener("ptsms:error", onError)
  }, [error])

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <div className="toast-stack no-print" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.tone}`}>{item.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error("useToast must be used within ToastProvider")
  return value
}
