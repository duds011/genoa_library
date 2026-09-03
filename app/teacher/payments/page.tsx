import { createClient, getUser } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import PaymentsManager, { ManagedPayment, StudentOption } from '@/components/teacher/PaymentsManager'
import RevenueChart, { MonthlyRevenue } from '@/components/teacher/RevenueChart'
import { getRate } from '@/lib/fx'

export default async function PaymentsPage() {
  const supabase = await createClient()
  const user = await getUser() // memoized, shared with the layout

  const [{ data: students }, { data: payments }, { data: profile }] = await Promise.all([
    supabase.from('students').select('id, full_name, lessons_remaining, archived_at').eq('teacher_id', user!.id).order('full_name'),
    supabase.from('payments').select('*').eq('teacher_id', user!.id),
    supabase.from('profiles').select('currency').eq('id', user!.id).single(),
  ])

  const currency = profile?.currency ?? 'EUR'
  const studentName = new Map((students ?? []).map(s => [s.id, s.full_name]))

  // Noa records payments in her own currency but wants the month's income in
  // yen too. Null when the rate can't be fetched — the JPY line is then hidden
  // rather than guessed at.
  const jpyRate = await getRate(currency, 'JPY')

  // Payments with no student_id are non-student income: 'trial' or 'other' (default).
  const OTHER_ID = '__other__'
  const TRIAL_ID = '__trial__'
  const managedPayments: ManagedPayment[] = (payments ?? []).map(p => ({
    id: p.id,
    studentId: p.student_id ? p.student_id : (p.category === 'trial' ? TRIAL_ID : OTHER_ID),
    studentName: p.student_id ? (studentName.get(p.student_id) ?? 'Unknown') : (p.category === 'trial' ? 'Trials' : 'Other'),
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    description: p.description,
    lessons_covered: p.lessons_covered,
    payment_date: p.payment_date,
    due_date: p.due_date,
    method: p.method,
    created_at: p.created_at,
  }))

  // Archived students are hidden from the grid but their payments stay in every
  // total — a past month's income shouldn't change because someone stopped.
  const studentOptions: StudentOption[] = (students ?? []).map(s => ({
    id: s.id,
    fullName: s.full_name,
    lessonsRemaining: (s as any).lessons_remaining ?? null,
    archived: !!(s as any).archived_at,
  }))

  // ── Monthly revenue: 12 months ending at the latest month that has a payment
  //    (or the current month, whichever is later — so future-dated payments show).
  const now = new Date()
  let endYear = now.getFullYear()
  let endMonth = now.getMonth() // 0-based
  for (const p of payments ?? []) {
    if (p.status !== 'paid' || !p.payment_date) continue
    const y = Number(p.payment_date.slice(0, 4))
    const m = Number(p.payment_date.slice(5, 7)) - 1
    if (y > endYear || (y === endYear && m > endMonth)) { endYear = y; endMonth = m }
  }
  const buckets: MonthlyRevenue[] = []
  const bucketIndex = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(endYear, endMonth - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    bucketIndex.set(key, buckets.length)
    buckets.push({
      month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      revenue: 0,
    })
  }
  for (const p of payments ?? []) {
    if (p.status !== 'paid' || !p.payment_date) continue
    const key = p.payment_date.slice(0, 7) // YYYY-MM
    const idx = bucketIndex.get(key)
    if (idx !== undefined) buckets[idx].revenue += Number(p.amount)
  }
  const hasRevenue = buckets.some(b => b.revenue > 0)

  return (
    <div className="k-page" style={{ display: 'grid', gap: 18 }}>
      <PageHeader
        eyebrow="Teacher"
        title="Payments"
        meta="Every student payment in one place — add, track, and reconcile."
        figures={[
          { label: 'Students', value: studentOptions.filter(s => !s.archived).length },
          { label: 'Payments', value: managedPayments.length },
          { label: 'Pending', value: managedPayments.filter(p => p.status === 'pending').length },
        ]}
      />

      {hasRevenue && <RevenueChart data={buckets} currency={currency} />}

      <PaymentsManager students={studentOptions} payments={managedPayments} currency={currency} jpyRate={jpyRate} />
    </div>
  )
}
