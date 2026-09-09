'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Detach a file from a lesson, and delete the stored object only if no other
 * lesson is still using it.
 *
 * The check is the point. Identical attachments used to be stored once per
 * lesson — the same 32MB workbook uploaded to four lessons was four copies,
 * 433MB of the bucket in all — so deduplicating them means several
 * `lesson_attachments` rows now share one object. The old code removed the file
 * and then the row unconditionally, which after deduplication would have pulled
 * the workbook out from under every other lesson pointing at it.
 *
 * Row first, then count what is left: if this was the last reference the file
 * goes, otherwise it stays and only the link is broken.
 */
export async function deleteAttachment(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: row } = await admin
    .from('lesson_attachments')
    .select('id, lesson_id, file_url')
    .eq('id', id)
    .single()
  if (!row) return { success: false, error: 'Attachment not found' }

  const { data: lesson } = await admin
    .from('lessons')
    .select('teacher_id')
    .eq('id', row.lesson_id)
    .single()
  if (!lesson || lesson.teacher_id !== user.id) return { success: false, error: 'Not authorized' }

  const { error: delErr } = await admin.from('lesson_attachments').delete().eq('id', id)
  if (delErr) return { success: false, error: delErr.message }

  // Anyone else still pointing at this file?
  const { count } = await admin
    .from('lesson_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('file_url', row.file_url)

  if (!count) {
    const path = String(row.file_url).split('/lesson-attachments/')[1]
    if (path) await admin.storage.from('lesson-attachments').remove([decodeURIComponent(path)])
  }

  return { success: true }
}
