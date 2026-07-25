import { getUser, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeacherNav from '@/components/teacher/TeacherNav'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Both are request-memoized, so this shares one round-trip with the page.
  const [user, profile] = await Promise.all([getUser(), getProfile()])

  if (!user) redirect('/login')
  if (profile?.role !== 'teacher') redirect('/student/dashboard')

  return (
    <div className="min-h-screen bg-surface">
      <TeacherNav teacherName={profile.full_name || user.email || 'Teacher'} />
      {/* pb-24 on mobile clears the fixed bottom nav bar. */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  )
}
