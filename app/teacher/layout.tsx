import { getUser, getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeacherNav from '@/components/teacher/TeacherNav'

/**
 * The teacher workspace: a floating sidebar card on the left, the page on a
 * white ground with a soft brand wash behind it (.wrap::before). Same shell
 * as Lesson Studio's teacher app.
 */
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
    <>
      <TeacherNav teacherName={profile.full_name || user.email || 'Teacher'} email={user.email} />
      <main className="wrap page-fade">{children}</main>
    </>
  )
}
