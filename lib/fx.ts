// Live exchange rates, used to show Noa a JPY figure alongside the currency she
// actually records payments in.
//
// Server-side only. The result is cached by Next's fetch cache so a page render
// doesn't hit the network every time — rates move far more slowly than she
// reloads the payments tab.

export interface FxRate {
  rate: number
  /** Date the rate is from (YYYY-MM-DD), shown so a stale figure is never silently wrong. */
  asOf: string
}

const SIX_HOURS = 60 * 60 * 6

/**
 * Returns null when no rate can be fetched. Callers must render nothing rather
 * than fall back to a hardcoded number: a wrong money figure that looks
 * authoritative is worse than no figure at all.
 */
export async function getRate(from: string, to: string): Promise<FxRate | null> {
  if (!from || !to) return null
  if (from === to) return { rate: 1, asOf: new Date().toISOString().slice(0, 10) }

  // Primary: exchangerate-api's free endpoint (no key, updated daily).
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`, {
      next: { revalidate: SIX_HOURS },
    })
    if (res.ok) {
      const json = await res.json()
      const rate = json?.rates?.[to]
      if (typeof rate === 'number' && rate > 0) {
        return { rate, asOf: (json?.time_last_update_utc ? new Date(json.time_last_update_utc) : new Date()).toISOString().slice(0, 10) }
      }
    }
  } catch { /* fall through to the backup source */ }

  // Backup: Frankfurter (European Central Bank reference rates).
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      next: { revalidate: SIX_HOURS },
    })
    if (res.ok) {
      const json = await res.json()
      const rate = json?.rates?.[to]
      if (typeof rate === 'number' && rate > 0) {
        return { rate, asOf: json?.date ?? new Date().toISOString().slice(0, 10) }
      }
    }
  } catch { /* no rate available */ }

  return null
}

/** Yen is written without decimals. */
export function formatJpy(amount: number): string {
  return `¥${Math.round(amount).toLocaleString('en-US')}`
}
