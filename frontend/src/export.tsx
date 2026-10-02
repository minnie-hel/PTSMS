import * as XLSX from "xlsx"

export type ExportFormat = "pdf" | "xlsx" | "csv" | "json"

export function exportTable(
  format: ExportFormat,
  filename: string,
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[],
) {
  const flat = rows.map((row) =>
    Object.fromEntries(columns.map((col) => [col.label, row[col.key] ?? ""])),
  )
  if (format === "json") {
    downloadBlob(`${filename}.json`, "application/json", JSON.stringify(flat, null, 2))
    return
  }
  if (format === "csv") {
    const header = columns.map((col) => col.label).join(",")
    const body = flat
      .map((row) => columns.map((col) => csvCell(String(row[col.label] ?? ""))).join(","))
      .join("\n")
    downloadBlob(`${filename}.csv`, "text/csv;charset=utf-8", `${header}\n${body}`)
    return
  }
  if (format === "xlsx") {
    const sheet = XLSX.utils.json_to_sheet(flat)
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, "Data")
    XLSX.writeFile(book, `${filename}.xlsx`)
    return
  }
  if (format === "pdf") {
    window.print()
  }
}

function csvCell(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadBlob(filename: string, type: string, content: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportInvoiceDocument(format: ExportFormat, doc: Record<string, unknown>, number: string) {
  if (format === "pdf") {
    window.print()
    return
  }
  const rows = [
    { Field: "Invoice", Value: doc.number },
    { Field: "Client", Value: doc.client_name },
    { Field: "Invoice date", Value: doc.invoice_date },
    { Field: "Due date", Value: doc.due_date },
    { Field: "Item", Value: doc.line_title },
    { Field: "Description", Value: doc.line_description },
    { Field: "Total", Value: doc.total_display },
    { Field: "Paid", Value: doc.amount_paid_display },
    { Field: "Balance", Value: doc.balance_display },
  ]
  exportTable(format === "xlsx" ? "xlsx" : format === "csv" ? "csv" : "json", `invoice-${number}`, [
    { key: "Field", label: "Field" },
    { key: "Value", label: "Value" },
  ], rows)
}
