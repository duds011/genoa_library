// Currency helpers for the payments feature.
// Currency is a teacher-level preference stored on profiles.currency.

export const CURRENCIES = ['EUR', 'HUF', 'USD', 'GBP'] as const
export type CurrencyCode = (typeof CURRENCIES)[number]

const SYMBOLS: Record<string, string> = {
  EUR: '€',
  HUF: 'Ft',
  USD: '$',
  GBP: '£',
}

// Forint is conventionally written without decimals.
const NO_DECIMALS = new Set(['HUF'])

export function currencySymbol(code?: string | null): string {
  return SYMBOLS[code ?? 'EUR'] ?? (code ?? '€')
}

export function formatMoney(amount: number, code?: string | null): string {
  const cur = code ?? 'EUR'
  const symbol = currencySymbol(cur)
  const decimals = NO_DECIMALS.has(cur) ? 0 : 2
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  // Forint is written after the number ("12 000 Ft"); others before ("€120.00").
  return cur === 'HUF' ? `${formatted} ${symbol}` : `${symbol}${formatted}`
}
