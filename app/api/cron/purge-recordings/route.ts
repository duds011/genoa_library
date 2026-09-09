import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { RECORDING_BUCKET, RETENTION_DAYS } from '@/lib/recap/ext-storage'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const clean = (s?: string) => (s ?? '').replace(/^﻿/, '').trim()

/** One listing page. The storage API caps a list at 100 by default. */
const PAGE = 1000

/**
 * PORTED FROM LESSON STUDIO — koku-library.app, app/api/cron/purge-recordings.
 *
 * This portal promised the same thing in two places — app/privacy/page.tsx and
 * the recorder's first-run disclosure — and shipped without the job that keeps
 * the promise. Audio therefore accumulated from the day the recorder went live.
 *
 * Daily purge of lesson audio older than the retention window.
 *
 * DORMANT since 2026-09-09: RETENTION_DAYS is 0, so this returns without
 * deleting anything and the cron entry has been removed. The privacy policy and
 * the extension disclosure were changed to match — they now say audio is kept.
 * If retention is ever turned back on, change those two back at the same time.
 *
 * Recordings are laid out as `{recordingId}/{track}.webm`, so the bucket root
 * lists as folders and the timestamps live one level down — hence the two-level
 * walk rather than a single flat listing.
 *
 * Everything in the folder goes, which now includes `transcript.json` — the
 * saved words a rebuild reuses instead of paying to hear the lesson again. That
 * file lives inside the recording's own folder precisely so it expires with the
 * audio, and this sweep needs no knowledge of it. The recap, the talk-time
 * figures and the lesson row are the teacher's record of the lesson and are
 * untouched.
 */
export async function GET(req: NextRequest) {
  const secret = clean(process.env.CRON_SECRET)
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Retention off: keep everything. The route stays so turning RETENTION_DAYS
  // back on is a one-line change, but while it is 0 nothing here may delete.
  if (!RETENTION_DAYS || RETENTION_DAYS <= 0) {
    return NextResponse.json({ ok: true, retentionDays: 0, deleted: 0, note: 'Retention is off — lesson audio is kept.' })
  }

  const admin = createAdminClient()
  const store = admin.storage.from(RECORDING_BUCKET)
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000

  const doomed: string[] = []
  const errors: string[] = []
  let folders = 0

  try {
    // Walk the recording folders, a page at a time.
    for (let offset = 0; ; offset += PAGE) {
      const { data: roots, error } = await store.list('', { limit: PAGE, offset })
      if (error) throw new Error(`Listing the bucket failed: ${error.message}`)
      if (!roots?.length) break

      for (const root of roots) {
        // A folder entry has no id of its own; a stray file at the root would.
        if (root.id) continue
        folders++

        const { data: files, error: inner } = await store.list(root.name, { limit: PAGE })
        if (inner) {
          errors.push(`${root.name}: ${inner.message}`)
          continue
        }
        for (const f of files ?? []) {
          // created_at is what the upload stamped. Missing it means we cannot
          // prove the file is old, so it stays — deleting on a guess is worse
          // than keeping something a day longer.
          const created = f.created_at ? Date.parse(f.created_at) : NaN
          if (Number.isFinite(created) && created < cutoff) doomed.push(`${root.name}/${f.name}`)
        }
      }

      if (roots.length < PAGE) break
    }

    // One call per batch; the API takes a list. Batched so a very large sweep
    // cannot build a single request big enough to be rejected.
    let deleted = 0
    for (let i = 0; i < doomed.length; i += 100) {
      const batch = doomed.slice(i, i + 100)
      const { error } = await store.remove(batch)
      if (error) errors.push(`Removing ${batch.length} files failed: ${error.message}`)
      else deleted += batch.length
    }

    return NextResponse.json({
      ok: errors.length === 0,
      retentionDays: RETENTION_DAYS,
      scannedRecordings: folders,
      deleted,
      errors,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Purge failed.' }, { status: 500 })
  }
}
