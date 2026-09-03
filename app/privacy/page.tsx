import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy — GENOA Library',
  description: 'What GENOA Library records, why, and how long it is kept.',
}

/**
 * The page the recorder links to.
 *
 * The extension asks for a student's voice, so the promise about what happens
 * to it has to live somewhere a student can read without an account. The
 * thirty days here is the same number the purge enforces and the extension's
 * first-run disclosure states — change one and all three change together.
 */
export default function PrivacyPage() {
  return (
    <div className="k-shell solo k-bg-wash">
      <main className="k-main page-fade" style={{ maxWidth: 760 }}>
        <div className="k-top" style={{ marginBottom: 18 }}>
          <div>
            <p className="k-hello">GENOA Library</p>
            <h1 className="k-name" style={{ fontSize: 'clamp(26px,3.4vw,36px)' }}>Privacy</h1>
          </div>
        </div>

        <div className="k-card" style={{ display: 'grid', gap: 18 }}>
          <section>
            <h2 className="section-heading" style={{ margin: '0 0 6px' }}>Who this is for</h2>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--muted)' }}>
              GENOA Library is a private portal for one teacher and her students. There is no public
              sign-up. You are here because your teacher made you an account.
            </p>
          </section>

          <section>
            <h2 className="section-heading" style={{ margin: '0 0 6px' }}>What is recorded</h2>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--muted)' }}>
              When your teacher records a lesson, the recorder captures two audio tracks: her
              microphone and the audio of the call, which is you. Both are uploaded so the lesson can
              be transcribed and written up. Recording is something your teacher starts by hand,
              lesson by lesson. Nothing records itself.
            </p>
          </section>

          <section>
            <h2 className="section-heading" style={{ margin: '0 0 6px' }}>How long audio is kept</h2>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--muted)' }}>
              Lesson audio is deleted after 30 days by a job that runs daily. It is kept that long
              only so a recap can be rebuilt if something goes wrong the first time. The written
              recap, your vocabulary and your scores stay, because they are the point of the portal.
            </p>
          </section>

          <section>
            <h2 className="section-heading" style={{ margin: '0 0 6px' }}>Who can see it</h2>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--muted)' }}>
              Your teacher, and you. Students cannot see each other. Recaps are drafts until your
              teacher reviews and publishes them, so nothing reaches you unread by her. Audio is
              transcribed and summarised by OpenAI, which processes it to return the text and does
              not use it to train models. Nothing is sold, and there is no advertising.
            </p>
          </section>

          <section>
            <h2 className="section-heading" style={{ margin: '0 0 6px' }}>Asking for it to be removed</h2>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--muted)' }}>
              Ask your teacher. She can delete a lesson, its recording and its recap, or your whole
              account, and deletion is immediate rather than a flag.
            </p>
          </section>
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center', marginTop: 18 }}>
          If anything here is unclear, ask your teacher before you record.
        </p>
      </main>
    </div>
  )
}
