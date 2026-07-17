import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { studentEmailAllows } from '@/lib/notificationPrefs'

const clean = (s?: string) => (s ?? '').replace(/^﻿/, '').trim()
const resend = new Resend(clean(process.env.RESEND_API_KEY))

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lessonId, studentId, feedback } = await req.json()
  if (!lessonId || !studentId || !feedback?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  await admin
    .from('homework_submissions')
    .update({ teacher_feedback: feedback.trim(), feedback_sent_at: new Date().toISOString() })
    .eq('lesson_id', lessonId)

  const [{ data: student }, { data: lesson }] = await Promise.all([
    admin.from('students').select('full_name, email').eq('id', studentId).single(),
    admin.from('lessons').select('lesson_number').eq('id', lessonId).single(),
  ])

  if (!student?.email) return NextResponse.json({ error: 'Student email not found' }, { status: 404 })

  // Feedback is already saved above; if they've opted out of the email we just
  // don't send it. They still see it in the portal.
  if (!(await studentEmailAllows(admin, studentId, 'homework_feedback'))) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const firstName = student.full_name.split(' ')[0]
  const lessonNum  = lesson?.lesson_number ?? ''
  const lessonUrl  = `${clean(process.env.NEXT_PUBLIC_APP_URL)}/student/lessons/${lessonId}`
  const feedbackHtml = feedback.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')

  await resend.emails.send({
    from: 'Noa <noa@genoa-library.com>',
    to: student.email,
    subject: `Homework feedback — Lesson ${lessonNum} 📝`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

        <tr><td align="center" style="padding-bottom:24px;">
          <div style="width:64px;height:64px;border-radius:50%;background:#5b50fa;display:inline-block;"></div>
        </td></tr>

        <tr><td style="background:#ffffff;border-radius:16px;padding:40px 36px;box-shadow:0 2px 12px rgba(91,80,250,0.08);">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1a1a2e;">Hi ${firstName}! 📝</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#666;line-height:1.5;">
            Your teacher reviewed your Lesson ${lessonNum} homework and left you feedback.
          </p>

          <div style="background:#f8f7ff;border:1px solid #e0dcff;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9b8ff5;">Teacher Feedback</p>
            <p style="margin:0;font-size:15px;color:#1a1a2e;line-height:1.6;">${feedbackHtml}</p>
          </div>

          <a href="${lessonUrl}" style="display:block;text-align:center;background:#5b50fa;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px;">
            View Lesson Recap →
          </a>
        </td></tr>

        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;">
            Sent by Noa via <strong style="color:#5b50fa;">GENOA Library</strong>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })

  return NextResponse.json({ ok: true })
}
