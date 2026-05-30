import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeacherNav from '@/components/teacher/TeacherNav'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'teacher') redirect('/student/dashboard')

  return (
    <div className="min-h-screen bg-surface">
      <TeacherNav teacherName={profile.full_name || user.email || 'Teacher'} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  )
}
