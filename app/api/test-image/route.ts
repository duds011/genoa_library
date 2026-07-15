import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Image generation is slow, so this is its own request rather than part of
// buildTest — one picture per call, kicked off from the review page once the
// draft already exists. Nothing here blocks Noa from reading her test.
export const maxDuration = 300

const clean = (s?: string) => (s ?? '').replace(/^﻿/, '').trim()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { questionId } = await req.json()
  if (!questionId) return NextResponse.json({ error: 'Missing questionId' }, { status: 400 })

  const admin = createAdminClient()

  // RLS is bypassed below, so ownership is checked explicitly: the question must
  // belong to a test this teacher owns.
  const { data: question } = await admin
    .from('test_questions')
    .select('id, test_id, image_prompt, image_status, tests!inner ( teacher_id )')
    .eq('id', questionId)
    .single()

  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  if ((question.tests as any)?.teacher_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  if (!question.image_prompt) {
    return NextResponse.json({ error: 'This question has no image to draw' }, { status: 400 })
  }

  const apiKey = clean(process.env.OPENAI_API_KEY)
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 })

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: clean(process.env.OPENAI_IMAGE_MODEL) || 'gpt-image-1',
        prompt: question.image_prompt,
        n: 1,
        size: '1024x1024',
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[test-image] OpenAI error', res.status, text.slice(0, 300))
      await admin.from('test_questions').update({ image_status: 'failed' }).eq('id', questionId)
      return NextResponse.json({ error: `Image generation failed (${res.status})` }, { status: 502 })
    }

    const json = await res.json()
    const first = json?.data?.[0]

    // gpt-image-1 returns base64; older models return a URL that expires within
    // the hour. Either way the bytes get copied into our own bucket below —
    // never store the provider's URL, it will 404 later.
    let bytes: Buffer | null = null
    if (first?.b64_json) {
      bytes = Buffer.from(first.b64_json, 'base64')
    } else if (first?.url) {
      const img = await fetch(first.url)
      if (img.ok) bytes = Buffer.from(await img.arrayBuffer())
    }

    if (!bytes) {
      await admin.from('test_questions').update({ image_status: 'failed' }).eq('id', questionId)
      return NextResponse.json({ error: 'No image came back' }, { status: 502 })
    }

    const path = `${question.test_id}/${questionId}-${Date.now()}.png`
    const { error: upErr } = await admin.storage
      .from('test-images')
      .upload(path, bytes, { contentType: 'image/png', upsert: true })

    if (upErr) {
      console.error('[test-image] upload failed', upErr.message)
      await admin.from('test_questions').update({ image_status: 'failed' }).eq('id', questionId)
      return NextResponse.json({ error: 'Could not store the image' }, { status: 500 })
    }

    const { data: { publicUrl } } = admin.storage.from('test-images').getPublicUrl(path)

    await admin
      .from('test_questions')
      .update({ image_url: publicUrl, image_status: 'ready' })
      .eq('id', questionId)

    return NextResponse.json({ ok: true, imageUrl: publicUrl })
  } catch (e: any) {
    console.error('[test-image] threw', e?.message)
    await admin.from('test_questions').update({ image_status: 'failed' }).eq('id', questionId)
    return NextResponse.json({ error: e?.message ?? 'Image generation failed' }, { status: 500 })
  }
}
