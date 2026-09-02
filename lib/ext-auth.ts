/**
 * Auth for the Lesson Studio recorder extension.
 *
 * The extension records a lesson as two audio tracks and hands them here. It
 * is not a browser session — there are no cookies — so it carries a bearer
 * token instead. Each teacher has their own, which is what makes the recorder
 * safe to hand to more than one person: the token says whose lesson this is
 * rather than the server having to guess.
 *
 * Two shapes are accepted:
 *  - a Supabase access token (a JWT, three dots), which is what the extension
 *    has for the moment right after signing in;
 *  - the opaque recorder token from teacher_ext_tokens, which is what it
 *    stores and uses from then on. That one has no expiry and nothing to
 *    rotate, so a lesson can never fail to upload because a refresh raced.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export type ExtCaller = { teacherId: string }

function bearer(req: Request): string {
  const header = req.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

export async function authenticateExtension(req: Request): Promise<ExtCaller | null> {
  const token = bearer(req)
  if (!token || token.length < 20) return null

  const admin = createAdminClient()

  // A real sign-in. Three dots' worth of JWT is the tell — a stored recorder
  // token is opaque and has none.
  if (token.split('.').length === 3) {
    const { data: authed } = await admin.auth.getUser(token)
    if (!authed?.user) return null
    const { data: profile } = await admin
      .from('profiles').select('role').eq('id', authed.user.id).maybeSingle()
    return profile?.role === 'teacher' ? { teacherId: authed.user.id } : null
  }

  const { data: row } = await admin
    .from('teacher_ext_tokens')
    .select('teacher_id')
    .eq('token', token)
    .maybeSingle()
  if (!row?.teacher_id) return null

  // Best-effort, so she can see whether the extension is actually talking to
  // us. Never fails the request it is stamping.
  admin
    .from('teacher_ext_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('teacher_id', row.teacher_id)
    .then(() => {}, () => {})

  return { teacherId: row.teacher_id }
}
