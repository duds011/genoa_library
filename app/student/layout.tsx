import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentNav from '@/components/student/StudentNav'
import KanaBackground from '@/components/student/KanaBackground'

export default async function StudentLayout({
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

  if (profile?.role !== 'student') redirect('/teacher/dashboard')

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <style>{`body { background: #f5f4ff; }`}</style>
      <KanaBackground />
      <StudentNav studentName={profile.full_name || user.email || 'Student'} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8" style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </main>
    </div>
  )
}
