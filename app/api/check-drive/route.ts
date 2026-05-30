import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  // Auth guard — only a logged-in teacher can trigger this
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }

  const webhookUrl = process.env.N8N_DRIVE_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json(
      { message: 'Drive scanner not configured (N8N_DRIVE_WEBHOOK_URL missing)' },
      { status: 500 }
    )
  }

  try {
    const n8nRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggeredBy: user.id }),
      // n8n webhook default timeout is 300s — Next.js fetch default is no timeout
      signal: AbortSignal.timeout(290_000),
    })

    const text = await n8nRes.text()
    console.log('[check-drive] n8n status:', n8nRes.status, '| body:', text.slice(0, 300))
    let data: unknown
    try {
      data = text ? JSON.parse(text) : { message: 'n8n returned an empty response' }
    } catch {
      // n8n returned HTML (usually a workflow error on one item) — lessons may still have been imported
      data = { partialError: true, message: 'One or more files could not be processed (e.g. student not found), but others may have been imported.' }
    }
    return NextResponse.json(data, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fetch failed'
    return NextResponse.json({ message }, { status: 502 })
  }
}
