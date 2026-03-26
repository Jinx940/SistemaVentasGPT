export function formatCurrencyPen(value: number) {
  return `S/. ${Number(value || 0).toFixed(2)}`
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

export function toInputDate(value?: string | null) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

export function addMonthsToInputDate(value?: string | null, months = 1) {
  const text = toInputDate(value)
  const [yearText, monthText, dayText] = text.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (!year || !month || !day) return ''

  const targetFirst = new Date(year, month - 1 + Number(months || 0), 1, 12, 0, 0, 0)
  const lastDay = new Date(
    targetFirst.getFullYear(),
    targetFirst.getMonth() + 1,
    0,
    12,
    0,
    0,
    0,
  ).getDate()
  const safeDay = Math.min(day, lastDay)

  return [
    targetFirst.getFullYear(),
    String(targetFirst.getMonth() + 1).padStart(2, '0'),
    String(safeDay).padStart(2, '0'),
  ].join('-')
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

export function formatMonthYearLabel(value?: string | null) {
  if (!value) return '-'

  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return '-'

  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

export function normalizePhoneForLookup(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '')

  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('51')) {
    return digits.slice(2)
  }

  return digits
}

export function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
