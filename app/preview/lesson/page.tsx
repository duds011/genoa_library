/**
 * DESIGN PREVIEW — what a lesson looks like once it comes from the recorder.
 *
 * Not wired to the database on purpose: this is here to be looked at and
 * argued with before the real student page is rebuilt on it. Delete once the
 * shape is agreed.
 */
import RecapFlow, { type Movement } from '@/components/student/RecapFlow'
import LessonMetrics from '@/components/student/LessonMetrics'

export const dynamic = 'force-dynamic'

const LEVELS: [string, number, string][] = [
  ['N5', 18, '#0a61c9'],
  ['N4', 13, '#a24ee0'],
  ['N3', 9, '#a855f7'],
  ['N2', 4, '#c084fc'],
]

const FIX = [
  { said: '私は昨日映画を見たです', fixed: '私は昨日映画を見ました', why: 'The past tense of 見る is 見ました — です does not attach to a past-tense verb.', tags: ['Verb form'] },
  { said: 'コーヒーが好きます', fixed: 'コーヒーが好きです', why: '好き is a na-adjective, so it takes です rather than ます.', tags: ['Adjective', 'Politeness'] },
  { said: '駅に行きました、友達と', fixed: '友達と駅に行きました', why: 'Japanese puts the companion before the destination — と comes earlier in the sentence.', tags: ['Word order'] },
]

const WON = [
  { said: '駅は近いけど、静かです', why: 'けど joining two clauses, correctly and unprompted — this was new last week.' },
  { said: '週末に友達と会いました', why: 'Particle と for "with" and the past polite form, both right first time.' },
]

function Stat({ accent, icon, label, children, chip, note }: any) {
  return (
    <div className="gr-stat" style={{ ['--accent' as any]: accent }}>
      <div className="gr-stat-head">
        <span className="gr-stat-icon">{icon}</span>
        <span className="gr-stat-label">{label}</span>
      </div>
      {children}
      {chip && <span className="gr-stat-chip">{chip}</span>}
      {note && <p className="gr-stat-note">{note}</p>}
    </div>
  )
}

export default function Page() {
  const studentTalk = 44
  const totalVocab = LEVELS.reduce((n, [, c]) => n + c, 0)

  const movements: Movement[] = [
    {
      id: 'spoke',
      label: 'How you spoke',
      node: (
        <>
          <div className="gr-stats">
            <Stat accent="#0a61c9" icon="🗣️" label="Speaking balance">
              <div className="gr-stat-value">
                {studentTalk}<span className="gr-stat-unit">%</span>
                <span className="gr-stat-sep">/</span>
                {100 - studentTalk}<span className="gr-stat-unit">%</span>
              </div>
              <div className="gr-bal">
                {[{ l: 'Duarte', p: studentTalk, s: true }, { l: 'Noa', p: 100 - studentTalk, s: false }].map((b) => (
                  <div className="gr-bal-row" key={b.l}>
                    <span>{b.l}</span>
                    <div className="gr-bal-track">
                      <div className={`gr-bal-fill${b.s ? ' student' : ''}`} style={{ width: `${b.p}%` }} />
                    </div>
                    <span style={{ textAlign: 'right' }}>{b.p}%</span>
                  </div>
                ))}
              </div>
            </Stat>

            <Stat accent="#16a34a" icon="⭐" label="Score" chip="Developing">
              <div className="gr-stat-value" style={{ color: '#16a34a' }}>
                7.4<span className="gr-stat-unit">/10</span>
              </div>
            </Stat>

            <Stat accent="#a24ee0" icon="📚" label="Grammar density"
                  note={`${totalVocab} vocabulary items practised`}>
              <div className="gr-stat-value" style={{ color: '#a24ee0', fontSize: 22 }}>Medium-High</div>
            </Stat>
          </div>

          <LessonMetrics
            studentFirst="Duarte"
            metrics={{
              studentWpm: 61, avgResponseSec: 2.2, longestTurnSec: 19,
              avgTurnWords: 8, fillerCount: 5, longPauseCount: 3,
              studentVocab: 34, lessonVocab: 88,
            }}
          />
        </>
      ),
    },
    {
      id: 'won',
      label: 'What you nailed',
      count: String(WON.length),
      node: (
        <div className="card p-5">
          {WON.map((w, i) => (
            <div className="gr-quote" key={i}>
              <p className="gr-fixed">&ldquo;{w.said}&rdquo;</p>
              <p className="gr-why">{w.why}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'fix',
      label: 'What to fix',
      count: String(FIX.length),
      node: (
        <div className="card p-5">
          {FIX.map((c, i) => (
            <div className="gr-quote" key={i}>
              <p className="gr-said">{c.said}</p>
              <p className="gr-fixed">{c.fixed}</p>
              <p className="gr-why">{c.why}</p>
              <div className="gr-tags">
                {c.tags.map((t) => <span className="gr-tag" key={t}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'words',
      label: 'Words from today',
      count: String(totalVocab),
      node: (
        <>
          <div className="card p-5">
            <p className="gr-sublab" style={{ marginBottom: 12 }}>Spread across levels</p>
            <div className="gr-levels">
              {LEVELS.map(([lv, n, colour]) => (
                <div className="gr-level" key={lv}>
                  <b>{lv}</b>
                  <div className="gr-level-track">
                    <div className="gr-level-fill" style={{ width: `${(n / totalVocab) * 100}%`, background: colour }} />
                  </div>
                  <span style={{ textAlign: 'right' }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <div className="grid gap-3">
              {[['けど', 'kedo', 'but, although', 'N5'], ['静か', 'shizuka', 'quiet', 'N5'], ['先週', 'senshuu', 'last week', 'N4']].map(([w, r, d, lv]) => (
                <div key={w} className="grid gap-1" style={{ gridTemplateColumns: '132px 1fr auto', alignItems: 'baseline' }}>
                  <span className="font-bold text-ink text-sm">
                    {w} <span className="text-muted font-medium text-xs">{r}</span>
                  </span>
                  <span className="text-sm text-muted">{d}</span>
                  <span className="gr-tag">{lv}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ),
    },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12 px-3 pt-6">
      <div className="card p-7" style={{ background: 'linear-gradient(180deg,#ffffff 0%,#f7f4ff 100%)' }}>
        <div className="inline-flex items-center gap-2 mb-4 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-brand-600 text-sm font-bold">
          <span className="w-2 h-2 rounded-full bg-brand-600 inline-block" />
          Lesson 12 · Recap
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink leading-tight mb-1">週末の予定と「けど」の使い方</h1>
        <p className="text-sm text-muted">2 September · Duarte &amp; Noa</p>
      </div>
      <RecapFlow movements={movements} back={{ href: '/student/dashboard', label: 'Dashboard' }} />
    </div>
  )
}
