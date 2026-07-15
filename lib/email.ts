import { Resend } from 'resend'

// Env values occasionally carry a BOM when pasted into Vercel.
const clean = (s?: string) => (s ?? '').replace(/^﻿/, '').trim()

const FROM = 'Noa <noa@genoa-library.com>'

export const appUrl = () => clean(process.env.NEXT_PUBLIC_APP_URL) || 'https://www.genoa-library.com'

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The GENOA transactional email shell — the same card the lesson-recap and
 * homework-feedback mails already use, in one place so new notifications don't
 * each grow their own copy of the HTML.
 *
 * Callers must escape any user-supplied text they pass in.
 */
export function emailShell(input: {
  heading: string
  intro: string
  boxLabel?: string
  boxTitle?: string
  boxSub?: string
  ctaText: string
  ctaUrl: string
  footerNote: string
}): string {
  const { heading, intro, boxLabel, boxTitle, boxSub, ctaText, ctaUrl, footerNote } = input
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="width:64px;height:64px;border-radius:50%;background:#5b50fa;display:inline-block;"></div>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:16px;padding:40px 36px;box-shadow:0 2px 12px rgba(91,80,250,0.08);">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1a1a2e;">${heading}</h1>
          <p style="margin:0 0 28px;font-size:15px;color:#666;line-height:1.5;">${intro}</p>
          ${boxTitle ? `
          <div style="background:#f8f7ff;border:1px solid #e0dcff;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
            ${boxLabel ? `<p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9b8ff5;">${boxLabel}</p>` : ''}
            <p style="margin:0;font-weight:700;font-size:18px;color:#3730a3;">${boxTitle}</p>
            ${boxSub ? `<p style="margin:6px 0 0;font-size:13px;color:#999;">${boxSub}</p>` : ''}
          </div>` : ''}
          <a href="${ctaUrl}" style="display:block;text-align:center;background:#5b50fa;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:.01em;">
            ${ctaText}
          </a>
        </td></tr>
        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;">
            Sent by <strong style="color:#5b50fa;">GENOA Library</strong><br>${footerNote}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * Sends a branded email. Never throws: a notification failing must not roll back
 * the thing it is announcing (a submitted test, a published lesson). Callers get
 * a result they can log and ignore.
 */
export async function sendEmail(input: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  const key = clean(process.env.RESEND_API_KEY)
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not configured' }
  if (!input.to) return { ok: false, error: 'No recipient' }

  try {
    const resend = new Resend(key)
    const res = await resend.emails.send({ from: FROM, to: input.to, subject: input.subject, html: input.html })
    if ((res as any)?.error) {
      const err = String((res as any).error?.message ?? (res as any).error)
      console.error('[email] send failed:', input.subject, err)
      return { ok: false, error: err }
    }
    return { ok: true }
  } catch (e: any) {
    console.error('[email] threw:', input.subject, e?.message)
    return { ok: false, error: e?.message ?? 'send failed' }
  }
}
