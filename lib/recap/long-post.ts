/**
 * PORTED FROM LESSON STUDIO — koku-library.app, lib/long-post.ts
 *
 * The recap engine this portal now runs on. It was written for Lesson Studio
 * and copied here rather than shared, because the two apps are separate
 * products on separate databases and neither should be able to take the other
 * down. The cost of that choice is this: these files exist twice, and a fix
 * made in one is not a fix in the other. Change them in step.
 */

/**
 * A multipart POST that is allowed to take as long as it takes.
 *
 * WHY NOT fetch()
 * Node's global fetch is undici, and undici aborts a request whose response
 * headers have not arrived within 300 seconds. That limit is not configurable
 * through fetch's options, does not move when the platform's function timeout
 * is raised, and surfaces as a bare `TypeError: fetch failed` with nothing
 * naming the cause.
 *
 * It cost a real lesson. Transcribing a 52-minute track needs longer than five
 * minutes, so the send failed on Vercel's 300s function ceiling; raising the
 * plan to 800s moved that wall and the very next attempt died at 303 seconds
 * on this one instead.
 *
 * node:https has no such default — a request runs until the server answers or
 * the socket dies — so the only ceiling left is the platform's, which IS
 * configurable. There is no dependency to add: `undici` is not installed, and
 * pulling in a second copy of it to configure the first copy's dispatcher is a
 * well-known way to configure neither.
 */
import https from 'node:https'
import { randomBytes } from 'node:crypto'

export type Part =
  | { name: string; value: string }
  | { name: string; filename: string; contentType: string; body: Buffer }

/** Everything in memory: these bodies are one lesson track, capped at 15MB. */
function encode(parts: Part[], boundary: string): Buffer {
  const chunks: Buffer[] = []
  for (const p of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`))
    if ('body' in p) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\n` +
            `Content-Type: ${p.contentType}\r\n\r\n`,
        ),
      )
      chunks.push(p.body)
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${p.name}"\r\n\r\n${p.value}`))
    }
    chunks.push(Buffer.from('\r\n'))
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return Buffer.concat(chunks)
}

/**
 * POST `parts` as multipart/form-data and return the raw response.
 *
 * `idleTimeoutMs` is a dead-socket guard and nothing finer. Node's request
 * timeout measures socket inactivity, and waiting for a server to think counts
 * as inactive — Whisper sends nothing at all until the whole transcription is
 * ready. So this has to sit ABOVE the longest legitimate wait or it becomes
 * the very ceiling this module exists to remove. A first attempt at 120s
 * killed a transcription that was working perfectly.
 *
 * The default sits just under the platform's own function limit: long enough
 * never to fire on real work, short enough to release a genuinely dead socket
 * before the platform kills the whole invocation with no explanation.
 */
export function postMultipart(
  url: string,
  parts: Part[],
  opts: { headers?: Record<string, string>; idleTimeoutMs?: number } = {},
): Promise<{ status: number; text: string }> {
  const boundary = `----koku${randomBytes(16).toString('hex')}`
  const body = encode(parts, boundary)
  const target = new URL(url)

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        port: target.port || 443,
        headers: {
          ...(opts.headers ?? {}),
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        const out: Buffer[] = []
        res.on('data', (d) => out.push(d))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(out).toString('utf8') }))
        res.on('error', reject)
      },
    )

    // See the note above: this is a dead-socket release valve, not a deadline
    // for the work. It must stay above the slowest real transcription.
    const idle = opts.idleTimeoutMs ?? 700_000
    req.setTimeout(idle, () => {
      req.destroy(new Error(`No response for ${Math.round(idle / 1000)}s — the connection stalled.`))
    })
    req.on('error', reject)
    req.end(body)
  })
}
