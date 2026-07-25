import { createClient, getUser, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentNav from '@/components/student/StudentNav'
import KanaBackground from '@/components/student/KanaBackground'
import { readEmailPrefs } from '@/lib/notificationPrefs'

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
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <style>{`body { background: #f3f4f6; }`}</style>
      <KanaBackground />
      <StudentNav studentName={profile.full_name || user.email || 'Student'} emailPrefs={emailPrefs} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8" style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </main>
    </div>
  )
}
