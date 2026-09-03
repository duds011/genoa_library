'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface ChartData {
  lesson: string
  score: number | null
  talk: number | null
}

export default function StudentProgressChart({ data }: { data: ChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="lesson" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <YAxis
          yAxisId="score"
          domain={[0, 10]}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickFormatter={v => `${v}`}
        />
        <YAxis
          yAxisId="talk"
          orientation="right"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
            fontFamily: 'Poppins, sans-serif',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', fontFamily: 'Poppins, sans-serif' }}
        />
        <Line
          yAxisId="score"
          type="monotone"
          dataKey="score"
          stroke="#4f46e5"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#4f46e5' }}
          activeDot={{ r: 6 }}
          name="Score (/10)"
          connectNulls
        />
        <Line
          yAxisId="talk"
          type="monotone"
          dataKey="talk"
          stroke="#7c3aed"
          strokeWidth={2}
          dot={{ r: 3, fill: '#7c3aed' }}
          strokeDasharray="4 2"
          name="Talk (%)"
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
