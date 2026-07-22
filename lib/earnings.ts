/**
 * Turning Noa's notes into an hourly rate.
 *
 * She writes one short memo per lesson — "left off at chapter 5, next time
 * travel vocab" — so the notes grid is already an accurate record of how many
 * lessons she taught. Counting the dots gives lessons; lessons give hours; the
 * month's payments give revenue; revenue over hours is what she actually earns
 * for her time.
 */

/** Every lesson is a 50-minute slot. */
export const LESSON_MINUTES = 50

export interface MonthEarnings {
  /** Notes written in the month — one per lesson taught. */
  lessons: number
  /** Lessons × 50 minutes, in hours. */
  hours: number
  /** Payments marked paid with a payment_date in this month. */
  revenue: number
  /**
   * Revenue ÷ hours. Null when she taught no lessons that month — dividing by
   * zero would render an ∞ that looks like a real number.
   */
  perHour: number | null
}

export interface EarningsNote {
  note_date: string      // YYYY-MM-DD
}

export interface EarningsPayment {
  status: 'paid' | 'pending' | string
  payment_date: string | null
  amount: number
}

/**
 * @param monthPrefix "YYYY-MM"
 */
export function monthEarnings(
  monthPrefix: string,
  notes: EarningsNote[],
  payments: EarningsPayment[]
): MonthEarnings {
  const lessons = notes.filter(n => n.note_date?.startsWith(monthPrefix)).length
  const hours = (lessons * LESSON_MINUTES) / 60

  const revenue = payments
    .filter(p => p.status === 'paid' && p.payment_date?.startsWith(monthPrefix))
    .reduce((sum, p) => sum + p.amount, 0)

  return {
    lessons,
    hours,
    revenue,
    perHour: hours > 0 ? revenue / hours : null,
  }
}

/** "31.7 h" — one decimal is enough, and 31.666666 reads as false precision. */
export function formatHours(hours: number): string {
  return `${hours.toFixed(1)} h`
}
