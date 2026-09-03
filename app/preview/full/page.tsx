/**
 * THE MOCK — a complete Lesson Studio recap, in this portal's skin.
 *
 * Every block Lesson Studio produces, with invented data, so the shape can be
 * judged before any of it is wired up: the three stat cards, the six measured
 * numbers, corrections with their grammar categories, what went well, the
 * lesson sections, the words with readings and examples, the four kinds of
 * practice exercise, the teacher's voice memo, the files.
 *
 * Nothing here is real and nothing here is connected. Delete once the design
 * is settled.
 */
import RecapFlow, { type Movement } from '@/components/student/RecapFlow'
import LessonMetrics from '@/components/student/LessonMetrics'

export const dynamic = 'force-dynamic'

const LEVELS: [string, number, string][] = [
  ['N5', 16, '#4f46e5'], ['N4', 11, '#7c3aed'], ['N3', 7, '#a855f7'], ['N2', 3, '#c084fc'],
]
const TOTAL = LEVELS.reduce((n, [, c]) => n + c, 0)

const FIX = [
  { said: '昨日、映画を見たです。', fixed: '昨日、映画を見ました。', cats: ['Verb form', 'Politeness'],
    why: 'The past polite of 見る is 見ました. です does not attach to a plain past verb — it is a separate copula.' },
  { said: 'コーヒーが好きます。', fixed: 'コーヒーが好きです。', cats: ['Adjective'],
    why: '好き is a na-adjective, not a verb, so it takes です rather than ます.' },
  { said: '駅に行きました、友達と。', fixed: '友達と駅に行きました。', cats: ['Word order'],
    why: 'The companion comes before the destination in Japanese; と sits early, not trailing at the end.' },
  { said: 'たくさん人がいました。', fixed: 'たくさんの人がいました。', cats: ['Particle'],
    why: 'たくさん needs の before a noun when it modifies it directly.' },
]

const WON = [
  { said: '駅は近いけど、静かです。', note: 'けど joining two clauses, unprompted — this only came up last week.' },
  { said: '週末に友達と会いました。', note: 'Particle と for "with" and the past polite form, both right first time.' },
  { said: 'ちょっと難しかったですが、楽しかったです。', note: 'Past-tense adjectives on both halves, and が as a soft contrast.' },
]

const WORDS = [
  ['たび', 'tabi', 'a journey, a trip', 'N5', '春に日本へたびをしました。'],
  ['おぼえる', 'oboeru', 'to remember, to memorise', 'N4', 'この漢字をおぼえています。'],
  ['かこまれる', 'kakomareru', 'to be surrounded by', 'N3', '山にかこまれた町です。'],
  ['けど', 'kedo', 'but, although', 'N5', '高いけど、おいしいです。'],
  ['静か', 'shizuka', 'quiet, calm', 'N5', '夜の駅は静かです。'],
  ['ふうけい', 'fuukei', 'scenery, landscape', 'N3', 'ふうけいがきれいでした。'],
]

const SECTIONS = [
  { n: 1, title: 'たび: Travel & Trips',
    lead: 'We opened by talking about trips you have taken, and the difference between たび and りょこう.',
    bullets: [['たび', 'tabi', 'a journey, a trip'], ['いきます', 'ikimasu', 'to go']],
    eg: ['たびをしているとき、スペインにいきました。', 'Tabi o shite iru toki, Supein ni ikimashita.', 'While I was travelling, I went to Spain.'],
    pattern: '[verb ている] + とき', note: 'とき means "when" or "while".' },
  { n: 2, title: 'おぼえる: To Remember',
    lead: 'Used for remembering and for memorising. The ている form means you still remember it now.',
    bullets: [['おぼえる', 'oboeru', 'to remember'], ['わすれる', 'wasureru', 'to forget']],
    eg: ['いまでもよくおぼえています。', 'Ima demo yoku oboeteimasu.', 'I still remember it clearly.'],
    pattern: '[verb ている]', note: 'Use ている for a state that continues.' },
  { n: 3, title: 'かこまれる: Being Surrounded',
    lead: 'The passive of かこむ. Common when describing places.',
    bullets: [['かこまれる', 'kakomareru', 'to be surrounded'], ['ふうけい', 'fuukei', 'scenery']],
    eg: ['山にかこまれています。', 'Yama ni kakomareteimasu.', 'It is surrounded by mountains.'],
    pattern: '[noun] に かこまれている', note: 'に marks what does the surrounding.' },
]

const HOMEWORK = [
  'Write five sentences about a trip you took, using たび and one けど.',
  'Record a voice memo describing your town with かこまれている.',
  'Review the six words from today out loud, twice.',
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
  const talk = 47
  const wave = [5, 9, 14, 20, 26, 18, 11, 22, 16, 9, 13, 24, 19, 12, 7, 15, 21, 11, 6, 10, 17, 23, 13, 8, 12, 18, 9, 5]

  const movements: Movement[] = [
    /* ── 1 ─────────────────────────────────────────────────────────────── */
    {
      id: 'spoke',
      label: 'How you spoke',
      node: (
        <>
          <div className="gr-stats">
            <Stat accent="#4f46e5" icon="🗣️" label="Speaking balance">
              <div className="gr-stat-value">
                {talk}<span className="gr-stat-unit">%</span>
                <span className="gr-stat-sep">/</span>{100 - talk}<span className="gr-stat-unit">%</span>
              </div>
              <div className="gr-bal">
                {[{ l: 'Duarte', p: talk, s: true }, { l: 'Noa', p: 100 - talk, s: false }].map((b) => (
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
            <Stat accent="#16a34a" icon="⭐" label="Score" chip="Confident">
              <div className="gr-stat-value" style={{ color: '#16a34a' }}>8.3<span className="gr-stat-unit">/10</span></div>
            </Stat>
            <Stat accent="#7c3aed" icon="📚" label="Grammar density" note={`${TOTAL} vocabulary items practised`}>
              <div className="gr-stat-value" style={{ color: '#7c3aed', fontSize: 22 }}>Medium-High</div>
            </Stat>
          </div>

          <LessonMetrics
            studentFirst="Duarte"
            metrics={{
              studentWpm: 78, avgResponseSec: 1.9, longestTurnSec: 26,
              avgTurnWords: 11, fillerCount: 4, longPauseCount: 2,
              studentVocab: 41, lessonVocab: 96,
            }}
          />

          <div className="gr-memo" style={{ marginTop: 10 }}>
            <span className="gr-memo-play" aria-hidden>▶</span>
            <span>
              <span className="gr-memo-t">A message from Noa</span><br />
              <span className="gr-memo-s">0:38 · recorded after the lesson</span>
            </span>
            <span className="gr-memo-wave" aria-hidden>
              {wave.map((h, i) => (
                <i key={i} className={i < 11 ? 'on' : undefined} style={{ height: `${h}px` }} />
              ))}
            </span>
          </div>
        </>
      ),
    },

    /* ── 2 ─────────────────────────────────────────────────────────────── */
    {
      id: 'won',
      label: 'What you nailed',
      count: String(WON.length),
      node: (
        <div className="card p-5">
          {WON.map((w, i) => (
            <div className="gr-quote" key={i}>
              <p className="gr-fixed">&ldquo;{w.said}&rdquo;</p>
              <p className="gr-why">{w.note}</p>
            </div>
          ))}
        </div>
      ),
    },

    /* ── 3 ─────────────────────────────────────────────────────────────── */
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
              <div className="gr-tags">{c.cats.map((t) => <span className="gr-tag" key={t}>{t}</span>)}</div>
            </div>
          ))}
        </div>
      ),
    },

    /* ── 4 ─────────────────────────────────────────────────────────────── */
    {
      id: 'covered',
      label: 'What we covered',
      count: String(SECTIONS.length),
      node: (
        <>
          {SECTIONS.map((s) => (
            <div className="card p-5" key={s.n}>
              <h4 className="font-bold text-ink text-sm mb-2">{s.n}. {s.title}</h4>
              <p className="text-[12.5px] text-muted leading-relaxed mb-3">{s.lead}</p>
              <div className="mb-3">
                {s.bullets.map(([w, r, d]) => (
                  <div className="gr-term" key={w}
                       style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 9, fontSize: 12.5, padding: '5px 0' }}>
                    <b style={{ fontWeight: 700, color: '#1e1b4b' }}>{w} <span style={{ color: '#9ca3af', fontWeight: 500, fontSize: 11 }}>{r}</span></b>
                    <span style={{ color: '#6b7280' }}>{d}</span>
                  </div>
                ))}
              </div>
              <div className="gr-word-eg" style={{ marginBottom: 10 }}>
                <div style={{ fontStyle: 'normal', fontWeight: 700, color: '#1e1b4b' }}>{s.eg[0]}</div>
                <div>{s.eg[1]}</div>
                <div>{s.eg[2]}</div>
              </div>
              <p className="text-[12px] mb-1"><b className="text-ink">Pattern:</b> <span className="text-muted">{s.pattern}</span></p>
              <p className="text-[11.5px] text-muted">Natural note: {s.note}</p>
            </div>
          ))}
        </>
      ),
    },

    /* ── 5 ─────────────────────────────────────────────────────────────── */
    {
      id: 'words',
      label: 'Words from today',
      count: String(TOTAL),
      node: (
        <>
          <div className="card p-5">
            <p className="gr-sublab" style={{ marginBottom: 12 }}>Spread across levels</p>
            <div className="gr-levels">
              {LEVELS.map(([lv, n, colour]) => (
                <div className="gr-level" key={lv}>
                  <b>{lv}</b>
                  <div className="gr-level-track">
                    <div className="gr-level-fill" style={{ width: `${(n / TOTAL) * 100}%`, background: colour }} />
                  </div>
                  <span style={{ textAlign: 'right' }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            {WORDS.map(([w, r, d, lv, eg]) => (
              <div className="gr-word" key={w}>
                <span className="gr-word-w">{w}<span className="gr-word-r">{r}</span></span>
                <span className="gr-word-d">{d}</span>
                <span className="gr-tag">{lv}</span>
                <span className="gr-word-eg">{eg}</span>
              </div>
            ))}
          </div>
        </>
      ),
    },

    /* ── 6 ─────────────────────────────────────────────────────────────── */
    {
      id: 'practice',
      label: 'Practice',
      count: `${HOMEWORK.length} + 4`,
      node: (
        <>
          <div className="card p-5">
            <p className="gr-sublab" style={{ marginBottom: 4 }}>Homework</p>
            {HOMEWORK.map((h) => (
              <div className="gr-hw" key={h}><i aria-hidden />{h}</div>
            ))}
          </div>

          <div className="gr-ex">
            <p className="gr-ex-kind">Read aloud · contrasting with けど</p>
            <p className="gr-ex-q">駅は近いけど、静かです。</p>
            <p className="gr-ex-en">The station is close, but it is quiet.</p>
            <p className="gr-ex-q" style={{ marginTop: 10 }}>高いけど、おいしいです。</p>
            <p className="gr-ex-en">It is expensive, but delicious.</p>
          </div>

          <div className="gr-ex">
            <p className="gr-ex-kind">Answer out loud</p>
            <p className="gr-ex-q">先週の週末、何をしましたか。</p>
            <p className="gr-ex-en">What did you do last weekend?</p>
            <p className="gr-hint">Reach for たび and one けど. Try to use the past polite form throughout.</p>
          </div>

          <div className="gr-ex">
            <p className="gr-ex-kind">Multiple choice</p>
            <p className="gr-ex-q">Which sentence contrasts two ideas?</p>
            <div className="gr-opts">
              <div className="gr-opt"><i>A</i>駅は近いです。</div>
              <div className="gr-opt right"><i>✓</i>近いけど、静かです。</div>
              <div className="gr-opt"><i>C</i>静かですか。</div>
            </div>
          </div>

          <div className="gr-ex">
            <p className="gr-ex-kind">Fill in the blank</p>
            <p className="gr-ex-q">高い<span className="gr-blank" />、おいしいです。</p>
            <p className="gr-ex-en">It is expensive, but delicious.</p>
            <div className="gr-opts">
              <div className="gr-opt right"><i>✓</i>けど</div>
              <div className="gr-opt"><i>B</i>から</div>
              <div className="gr-opt"><i>C</i>ので</div>
            </div>
          </div>
        </>
      ),
    },

    /* ── 7 ─────────────────────────────────────────────────────────────── */
    {
      id: 'files',
      label: 'Files & audio',
      count: '3',
      node: (
        <>
          <div className="gr-file">📄 Lesson 12 — vocabulary sheet.pdf <small>240 KB</small></div>
          <div className="gr-file">🖼️ Kanji practice grid.png <small>1.1 MB</small></div>
          <div className="gr-file">🎧 Your recording — speaking answer 1 <small>0:22</small></div>
        </>
      ),
    },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12 px-3 pt-6">
      <div className="card p-7" style={{ background: 'linear-gradient(180deg,#ffffff 0%,#f7f4ff 100%)' }}>
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div style={{ minWidth: 0 }}>
            <div className="inline-flex items-center gap-2 mb-4 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-brand-600 text-sm font-bold">
              <span className="w-2 h-2 rounded-full bg-brand-600 inline-block" />
              Lesson 12 · Recap
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-ink leading-tight mb-1">たびの思い出と「けど」の使い方</h1>
            <p className="text-sm text-muted">2 September · Duarte &amp; Noa · 48 minutes</p>
          </div>
          <div style={{
            width: 78, height: 78, borderRadius: 22, flex: '0 0 auto', display: 'grid',
            placeItems: 'center', color: '#fff', textAlign: 'center',
            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          }}>
            <div>
              <div style={{ fontSize: 25, fontWeight: 800, lineHeight: 1 }}>8.3</div>
              <div style={{ fontSize: 8, opacity: .85, letterSpacing: '.1em', marginTop: 2 }}>OUT OF 10</div>
            </div>
          </div>
        </div>
      </div>
      <RecapFlow movements={movements} back={{ href: '/student/dashboard', label: 'Dashboard' }} />
    </div>
  )
}
