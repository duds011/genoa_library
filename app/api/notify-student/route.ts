import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { studentEmailAllows } from '@/lib/notificationPrefs'
import { formatDateShort } from '@/lib/utils'

const clean = (s?: string) => (s ?? '').replace(/^﻿/, '').trim()
const resend = new Resend(clean(process.env.RESEND_API_KEY))

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lessonId, studentId } = await req.json()
  if (!lessonId || !studentId) {
    return NextResponse.json({ error: 'Missing lessonId or studentId' }, { status: 400 })
  }

  const admin = createAdminClient()

  const [{ data: student }, { data: lesson }] = await Promise.all([
    admin.from('students').select('full_name, email').eq('id', studentId).single(),
    admin.from('lessons').select('lesson_date').eq('id', lessonId).single(),
  ])

  if (!student?.email) {
    return NextResponse.json({ error: 'Student email not found' }, { status: 404 })
  }

  if (!(await studentEmailAllows(admin, studentId, 'recap'))) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const lessonDate = lesson?.lesson_date ? formatDateShort(lesson.lesson_date) : ''
  const lessonUrl  = `${clean(process.env.NEXT_PUBLIC_APP_URL)}/student/lessons/${lessonId}`
  const firstName  = student.full_name.split(' ')[0]

  console.log('[notify-student] sending to', student.email, 'for lesson', lessonId)

  const result = await resend.emails.send({
    from: 'Noa <noa@genoa-library.com>',
    to: student.email,
    subject: `Your lesson recap is ready! 📚`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

        <!-- Logo circle -->
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="width:64px;height:64px;border-radius:50%;background:#5b50fa;display:inline-block;"></div>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border-radius:16px;padding:40px 36px;box-shadow:0 2px 12px rgba(91,80,250,0.08);">

          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1a1a2e;">
            Hi ${firstName}! 👋
          </h1>
          <p style="margin:0 0 28px;font-size:15px;color:#666;line-height:1.5;">
            Your teacher just published a new lesson recap for you.
          </p>

          <!-- Recap box -->
          <div style="background:#f8f7ff;border:1px solid #e0dcff;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9b8ff5;">
              New Recap
            </p>
            <p style="margin:0;font-weight:700;font-size:18px;color:#3730a3;">
              Your lesson recap is ready 🎉
            </p>
            ${lessonDate ? `<p style="margin:6px 0 0;font-size:13px;color:#999;">${lessonDate}</p>` : ''}
          </div>

          <!-- CTA button -->
          <a href="${lessonUrl}"
             style="display:block;text-align:center;background:#5b50fa;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:.01em;">
            View Recap →
          </a>

        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;">
            Sent by Noa via <strong style="color:#5b50fa;">GENOA Library</strong><br>
            You received this because your teacher published a lesson recap for you.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  })

  console.log('[notify-student] result:', result)
  return NextResponse.json({ ok: true })
}
