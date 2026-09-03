import { createClient, getUser, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentTopBar from '@/components/student/StudentTopBar'
import { readEmailPrefs } from '@/lib/notificationPrefs'

/**
 * The student portal: Lesson Studio's `.k-shell.solo` — one centred column
 * with a slim top bar, no sidebar, on the same white ground as the teacher
 * side.
 */
export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // getUser/getProfile are request-memoized (shared with the page render).
  const [user, profile] = await Promise.all([getUser(), getProfile()])

  if (!user) redirect('/login')
  if (profile?.role !== 'student') redirect('/teacher/dashboard')

  // The student's own row carries their email preferences (RLS: students_self).
  const supabase = await createClient()
  const { data: studentRow } = await supabase
    .from('students')
    .select('email_enabled, email_prefs')
    .eq('profile_id', user.id)
    .maybeSingle()
  const emailPrefs = readEmailPrefs(studentRow)

  return (
    <div className="k-shell solo k-bg-wash">
      <main className="k-main page-fade">
        <StudentTopBar studentName={profile.full_name || user.email || 'Student'} emailPrefs={emailPrefs} />
        {children}
      </main>
    </div>
  )
}
