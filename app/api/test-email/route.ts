import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const clean = (s?: string) => (s ?? '').replace(/^﻿/, '').trim()
const resend = new Resend(clean(process.env.RESEND_API_KEY))

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await resend.emails.send({
    from: 'Noa <noa@genoa-library.com>',
    to: user.email!,
    subject: '✅ Resend test — GENOA Library',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;">
        <h2 style="color:#4f46e5;">Resend is working! 🎉</h2>
        <p>This is a test email sent from GENOA Library.</p>
        <p style="color:#666;font-size:14px;">Sent to: ${user.email}</p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true, id: result.data?.id ?? null, error: result.error ?? null })
}
