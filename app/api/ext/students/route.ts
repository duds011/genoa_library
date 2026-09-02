import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateExtension } from '@/lib/ext-auth'

export const dynamic = 'force-dynamic'

/**
 * Who the extension is signed in as, and who it can record.
 *
 * Archived students are left out: the picker is a list of people you might
 * teach this hour, not a history of everyone you ever taught.
 */
export async function GET(req: Request) {
  const caller = await authenticateExtension(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data, error }, { data: profile }] = await Promise.all([
    admin
      .from('students')
      .select('id, full_name, language')
      .eq('teacher_id', caller.teacherId)
      .is('archived_at', null)
      .order('full_name'),
    admin.from('profiles').select('full_name').eq('id', caller.teacherId).maybeSingle(),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    students: data ?? [],
    teacher: {
      name: (profile as any)?.full_name ?? null,
      // This portal is one teacher teaching one language, so there is no
      // per-teacher setting to read: Japanese is what is taught, and the
      // language a lesson is SPOKEN in is chosen per student in the recorder.
      language: 'Japanese',
      speaking: null,
    },
  })
}
