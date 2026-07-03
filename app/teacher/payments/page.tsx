import { createClient } from '@/lib/supabase/server'
import { Wallet } from 'lucide-react'
import PaymentsManager, { ManagedPayment, StudentOption } from '@/components/teacher/PaymentsManager'
import RevenueChart, { MonthlyRevenue } from '@/components/teacher/RevenueChart'

export default async function PaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: students }, { data: payments }, { data: profile }] = await Promise.all([
    supabase.from('students').select('id, full_name').eq('teacher_id', user!.id).order('full_name'),
    supabase.from('payments').select('*').eq('teacher_id', user!.id),
    supabase.from('profiles').select('currency').eq('id', user!.id).single(),
  ])

  const currency = profile?.currency ?? 'EUR'
  const studentName = new Map((students ?? []).map(s => [s.id, s.full_name]))

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

  const studentOptions: StudentOption[] = (students ?? []).map(s => ({ id: s.id, fullName: s.full_name }))

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
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-5 h-5 text-brand-600" />
          <h1 className="text-2xl font-bold text-ink">Payments</h1>
        </div>
        <p className="text-sm text-muted">All student payments in one place — add, track, and reconcile</p>
      </div>

      {hasRevenue && <RevenueChart data={buckets} currency={currency} />}

      <PaymentsManager students={studentOptions} payments={managedPayments} currency={currency} />
    </div>
  )
}
