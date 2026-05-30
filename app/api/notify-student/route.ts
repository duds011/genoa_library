import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDateShort } from '@/lib/utils'

const resend = new Resend(process.env.RESEND_API_KEY)

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

  const lessonDate = lesson?.lesson_date ? formatDateShort(lesson.lesson_date) : ''
  const lessonUrl  = `${process.env.NEXT_PUBLIC_APP_URL}/student/lessons/${lessonId}`
  const firstName  = student.full_name.split(' ')[0]

  console.log('[notify-student] sending to', student.email, 'for lesson', lessonId)
  const result = await resend.emails.send({
    from: 'Lesson Recap <onboarding@resend.dev>',
    to: student.email,
    subject: `Your lesson recap is ready! 📚`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a2e">
        <h2 style="margin:0 0 8px">Hi ${firstName}! 👋</h2>
        <p style="margin:0 0 24px;color:#555">Your teacher just published a new lesson recap for you.</p>

        <div style="background:#f8f7ff;border:1px solid #e0e0f0;border-radius:12px;padding:20px;margin-bottom:24px">
          <p style="margin:0;font-weight:700;font-size:18px;color:#3730a3">Your lesson recap is ready 🎉</p>
          ${lessonDate ? `<p style="margin:6px 0 0;font-size:13px;color:#888">${lessonDate}</p>` : ''}
        </div>

        <a href="${lessonUrl}"
           style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px">
          View Recap →
        </a>

        <p style="margin:32px 0 0;font-size:12px;color:#aaa">
          You're receiving this because your teacher published a new lesson recap for you.
        </p>
      </div>
    `,
  })

  console.log('[notify-student] result:', result)
  return NextResponse.json({ ok: true })
}
