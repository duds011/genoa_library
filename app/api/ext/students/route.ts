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
      // `*` rather than a column list on purpose: `spoken_language` arrives in
      // migration 007, and a named column that does not exist yet fails the
      // whole request rather than coming back empty.
      .select('*')
      .eq('teacher_id', caller.teacherId)
      .is('archived_at', null)
      .order('full_name'),
    admin.from('profiles').select('full_name').eq('id', caller.teacherId).maybeSingle(),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  /**
   * Only the four fields the recorder actually uses.
   *
   * `spoken_language` is the one that replaced a dropdown: the recorder used
   * to ask, every lesson, what the hour would be spoken in. It is a property of
   * the student, not of the lesson, so it is answered once on their record and
   * read from here — see /api/ext/complete, which trusts this over anything the
   * extension sends.
   */
  const students = (data ?? []).map((s: any) => ({
    id: s.id,
    full_name: s.full_name,
    language: s.language,
    spoken_language: s.spoken_language ?? 'English',
  }))

  return NextResponse.json({
    students,
    teacher: { name: (profile as any)?.full_name ?? null },
  })
}
