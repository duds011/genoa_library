'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A player for clips made by MediaRecorder.
 *
 * Two things a bare `<audio controls>` gets wrong with them:
 *
 * 1. Chrome's WebM recordings carry no Duration in the header, so the browser
 *    reports `Infinity`, the scrubber sits dead at 0:00 and the clip looks
 *    broken even while it plays. Seeking past the end forces the browser to
 *    walk the file and work the real length out; then we seek back.
 * 2. A clip that fails to decode — the MP4-labelled-as-WebM files this portal
 *    stored until the format fix — fails silently: no sound, no message,
 *    nothing in the UI. Say so in a sentence instead.
 *
 * The priming is deliberately not left to the `loadedmetadata` event alone:
 * metadata is often already in by the time the effect attaches, and then the
 * event never comes.
 */
export default function RecordedAudio({
  src,
  className,
  style,
}: {
  src: string
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setBroken(Boolean(el.error))

    let primed = false
    function prime() {
      if (!el || primed) return
      if (el.readyState < 1) return                       // no metadata yet
      if (el.duration !== Infinity && !Number.isNaN(el.duration)) { primed = true; return }
      if (!el.paused) return                              // never yank a clip that's playing
      primed = true
      const back = () => {
        el.removeEventListener('timeupdate', back)
        el.currentTime = 0
      }
      el.addEventListener('timeupdate', back)
      el.currentTime = 1e101
    }
    function onError() { setBroken(true) }

    prime()
    el.addEventListener('loadedmetadata', prime)
    el.addEventListener('durationchange', prime)
    el.addEventListener('error', onError)
    return () => {
      el.removeEventListener('loadedmetadata', prime)
      el.removeEventListener('durationchange', prime)
      el.removeEventListener('error', onError)
    }
  }, [src])

  return (
    <div>
      <audio ref={ref} controls preload="metadata" src={src} className={className} style={style} />
      {broken && (
        <p className="text-xs text-amber-600 mt-1">
          This clip won&apos;t play in this browser. Try opening it in Chrome, or record it again.
        </p>
      )}
    </div>
  )
}
