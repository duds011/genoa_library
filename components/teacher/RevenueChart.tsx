'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatMoney } from '@/lib/currency'

export interface MonthlyRevenue {
  month: string   // "Jan 26"
  revenue: number
}

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  fontSize: '12px',
  fontFamily: 'Poppins, sans-serif',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  padding: '10px 14px',
}

export default function RevenueChart({ data, currency }: { data: MonthlyRevenue[]; currency: string }) {
  const total = data.reduce((s, d) => s + d.revenue, 0)
  const months = data.filter(d => d.revenue > 0).length
  const avg = months ? total / months : 0
  // Highlight the most recent month
  const lastIdx = data.length - 1

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="font-bold text-ink">Monthly Revenue</h3>
          <p className="text-xs text-muted">Received payments per month over the last 12 months</p>
        </div>
        {avg > 0 && (
          <div className="text-right">
            <p className="text-[11px] text-muted uppercase tracking-wide font-semibold">Avg / active month</p>
            <p className="font-bold text-ink">{formatMoney(avg, currency)}</p>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => formatMoney(v, currency)}
            width={70}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: '#f9fafb' }}
            formatter={(v: unknown) => [formatMoney(Number(v), currency), 'Revenue']}
          />
          <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === lastIdx ? '#0a61c9' : '#86b4f1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
