'use client'

import { useEffect, useRef } from 'react'

const CHARS = [
  'あ','い','う','え','お','か','き','く','け','こ',
  'さ','し','す','せ','そ','た','ち','つ','て','と',
  'な','に','ぬ','ね','の','は','ひ','ふ','へ','ほ',
  'ま','み','む','め','も','や','ゆ','よ','ら','り',
  'る','れ','ろ','わ','を','ん',
  '日','本','語','学','校','先','生','友','楽',
]

export default function KanaBackground() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    function spawn(): HTMLSpanElement {
      const span = document.createElement('span')
      span.textContent = CHARS[Math.floor(Math.random() * CHARS.length)]
      const dur = 12 + Math.random() * 18
      Object.assign(span.style, {
        position: 'absolute',
        willChange: 'transform, opacity',
        lineHeight: '1',
        left: Math.floor(Math.random() * 100) + 'vw',
        fontSize: (14 + Math.random() * 38) + 'px',
        color: 'currentColor',
        animation: `kana-float ${dur.toFixed(2)}s linear ${(Math.random() * -dur).toFixed(2)}s infinite`,
        opacity: '0',
        filter: Math.random() < 0.4 ? 'blur(0px)' : `blur(${Math.floor(Math.random() * 2 + 1)}px)`,
      })
      span.dataset.o = (0.12 + Math.random() * 0.22).toFixed(2)
      span.dataset.x = (Math.random() * 40 - 20).toFixed(1) + 'px'
      span.dataset.drift = (Math.random() * 80 - 40).toFixed(1) + 'px'

      // Use CSS custom properties via setAttribute
      span.setAttribute('style',
        span.getAttribute('style') +
        `;--o:${span.dataset.o};--x:${span.dataset.x};--drift:${span.dataset.drift}`
      )
      span.className = 'kana-char'

      span.addEventListener('animationend', () => {
        span.remove()
        if (!document.hidden && root) root.appendChild(spawn())
      }, { once: true })

      return span
    }

    for (let i = 0; i < 36; i++) root.appendChild(spawn())

    return () => { root.innerHTML = '' }
  }, [])

  return (
    <>
      <style>{`
        .kana-char {
          position: absolute;
          will-change: transform, opacity;
          line-height: 1;
          transform: translateY(100vh) translateX(var(--x, 0));
          animation-fill-mode: both;
        }
        @keyframes kana-float {
          0%   { transform: translateY(100vh)  translateX(var(--x, 0)); opacity: 0; }
          10%  { opacity: var(--o, 0.2); }
          90%  { opacity: var(--o, 0.2); }
          100% { transform: translateY(-10vh) translateX(calc(var(--x, 0) + var(--drift, 0px))); opacity: 0; }
        }
      `}</style>
      <div
        ref={rootRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          color: '#5b50fa',
        }}
      />
    </>
  )
}
