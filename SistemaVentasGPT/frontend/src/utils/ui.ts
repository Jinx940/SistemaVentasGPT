export function formatCurrencyPen(value: number) {
  return `S/. ${Number(value || 0).toFixed(2)}`
}

export function toInputDate(value?: string | null) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

export function getDaysOverdue(value?: string | null) {
  if (!value) return 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cierre = new Date(String(value))
  cierre.setHours(0, 0, 0, 0)

  const diff = today.getTime() - cierre.getTime()
  return diff > 0 ? Math.floor(diff / 86400000) : 0
}

export function formatDateDisplay(value?: string | null) {
  if (!value) return '-'
  const text = String(value).slice(0, 10)
  const parts = text.split('-')
  if (parts.length !== 3) return text
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
