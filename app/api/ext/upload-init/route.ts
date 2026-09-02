import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateExtension } from '@/lib/ext-auth'
import { RECORDING_BUCKET, trackPath } from '@/lib/recap/ext-storage'
import { overLessonLimit, TOO_LONG_MESSAGE } from '@/lib/recap/lesson-limits'

export const dynamic = 'force-dynamic'

/**
 * Signed URLs so the extension uploads audio straight to storage.
 *
 * A lesson recording is tens of megabytes and a serverless function body caps
 * out far below that, so the audio must never be posted through the app.
 */
export async function POST(req: Request) {
  const caller = await authenticateExtension(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { studentId, tracks, seconds } = await req.json().catch(() => ({}))
  if (!Array.isArray(tracks) || !tracks.length) {
    return NextResponse.json({ error: 'Missing tracks' }, { status: 400 })
  }

  // Refuse an over-long lesson before it is uploaded at all. Stopping it here
  // costs a failed send; letting it through costs two tracks of storage and
  // then two tracks of per-minute transcription.
  if (overLessonLimit(seconds)) {
    return NextResponse.json({ error: TOO_LONG_MESSAGE }, { status: 413 })
  }

  const admin = createAdminClient()
  // A named student must be this teacher's, so a stale build cannot upload
  // into someone else's roster.
  if (studentId) {
    const { data: student } = await admin
      .from('students').select('id').eq('id', studentId).eq('teacher_id', caller.teacherId).maybeSingle()
    if (!student) return NextResponse.json({ error: 'Student not found for this teacher' }, { status: 404 })
  }

  const recordingId = crypto.randomUUID()
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^﻿/, '').trim().replace(/\/$/, '')
  const uploads: Record<string, { url: string; path: string }> = {}

  for (const track of tracks) {
    if (!/^(tab|mic)$/.test(String(track))) {
      return NextResponse.json({ error: `Bad track "${track}"` }, { status: 400 })
    }
    const path = trackPath(recordingId, track)
    const { data, error } = await admin.storage.from(RECORDING_BUCKET).createSignedUploadUrl(path)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Newer clients hand back an absolute URL, older ones a storage-relative
    // path. Prefixing blindly produced ".../storage/v1https://..." and every
    // upload failed, so only prefix when it needs it.
    const signed = String(data.signedUrl)
    uploads[track] = { path, url: signed.startsWith('http') ? signed : `${base}/storage/v1${signed}` }
  }

  return NextResponse.json({ recordingId, bucket: RECORDING_BUCKET, uploads })
}
