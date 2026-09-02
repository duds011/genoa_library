/**
 * DEV-ONLY preview of a REAL lesson in the new recap shape.
 *
 * The student page is behind a student login, which makes "show me Andri's
 * lesson" impossible without his password. This reads the same rows with the
 * admin client so any real lesson can be opened by id and compared against
 * what is live.
 *
 * It refuses to exist outside development — a route that renders any student's
 * lesson without asking who is looking must not be able to ship.
 */
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import RecapFlow, { type Movement } from '@/components/student/RecapFlow'
import LessonMetrics from '@/components/student/LessonMetrics'
// Her own renderer, so a section reads here exactly as it reads on the
// real page — bold, bullets and pattern lines, not raw markdown.
import SectionContent from '@/components/student/SectionContent'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: { lessonId: string } }) {
  if (process.env.NODE_ENV === 'production') notFound()

  const admin = createAdminClient()
  const { data: lesson } = await admin
    .from('lessons')
    .select(`*, lesson_summaries ( * ), vocabulary_items ( * ), homework_items ( * ),
             lesson_sections ( * ), students ( full_name )`)
    .eq('id', params.lessonId)
    .maybeSingle()

  if (!lesson) notFound()

  const l = lesson as any
  const summary = Array.isArray(l.lesson_summaries) ? l.lesson_summaries[0] : l.lesson_summaries
  const studentName = (Array.isArray(l.students) ? l.students[0] : l.students)?.full_name ?? 'Student'
  const studentFirst = studentName.split(' ')[0]

  const sections = (l.lesson_sections ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  const vocab = (l.vocabulary_items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  const homework = (l.homework_items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)

  const metrics = summary?.metrics ?? null
  const corrections: any[] = Array.isArray(summary?.corrections) ? summary.corrections : []
  const didWell: any[] = Array.isArray(summary?.did_well) ? summary.did_well : []

  const studentTalk = summary?.talk_percentage ?? null

  // The level spread, counted from the words themselves.
  const spread = new Map<string, number>()
  for (const v of vocab) if (v.jlpt_level) spread.set(v.jlpt_level, (spread.get(v.jlpt_level) ?? 0) + 1)
  // Array.from, not spread: this tsconfig targets below es2015, where
  // spreading a Map iterator is a type error. next.config ignores build
  // errors, so it would have shipped silently.
  const levels = Array.from(spread.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  const LEVEL_COLOUR: Record<string, string> = {
    N5: '#4f46e5', N4: '#7c3aed', N3: '#a855f7', N2: '#c084fc', N1: '#d8b4fe',
  }

  const movements: Movement[] = [
    {
      id: 'spoke',
      label: 'How you spoke',
      node: summary ? (
        <>
          <div className="gr-stats">
            {studentTalk != null && (
              <div className="gr-stat" style={{ ['--accent' as any]: '#4f46e5' }}>
                <div className="gr-stat-head">
                  <span className="gr-stat-icon">🗣️</span>
                  <span className="gr-stat-label">Speaking balance</span>
                </div>
                <div className="gr-stat-value">
                  {studentTalk}<span className="gr-stat-unit">%</span>
                  <span className="gr-stat-sep">/</span>
                  {100 - studentTalk}<span className="gr-stat-unit">%</span>
                </div>
                <div className="gr-bal">
                  {[{ l: studentFirst, p: studentTalk, s: true }, { l: 'Noa', p: 100 - studentTalk, s: false }].map((b) => (
                    <div className="gr-bal-row" key={b.l}>
                      <span>{b.l}</span>
                      <div className="gr-bal-track">
                        <div className={`gr-bal-fill${b.s ? ' student' : ''}`} style={{ width: `${b.p}%` }} />
                      </div>
                      <span style={{ textAlign: 'right' }}>{b.p}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.score != null && (
              <div className="gr-stat" style={{ ['--accent' as any]: '#16a34a' }}>
                <div className="gr-stat-head">
                  <span className="gr-stat-icon">⭐</span>
                  <span className="gr-stat-label">Score</span>
                </div>
                <div className="gr-stat-value" style={{ color: '#16a34a' }}>
                  {summary.score}<span className="gr-stat-unit">/10</span>
                </div>
                {summary.confidence_label && <span className="gr-stat-chip">{summary.confidence_label}</span>}
              </div>
            )}
            {summary.grammar_density && (
              <div className="gr-stat" style={{ ['--accent' as any]: '#7c3aed' }}>
                <div className="gr-stat-head">
                  <span className="gr-stat-icon">📚</span>
                  <span className="gr-stat-label">Grammar density</span>
                </div>
                <div className="gr-stat-value" style={{ color: '#7c3aed', fontSize: 22 }}>{summary.grammar_density}</div>
                <p className="gr-stat-note">{vocab.length} vocabulary items practised</p>
              </div>
            )}
          </div>

          <LessonMetrics metrics={metrics} studentFirst={studentFirst} />

          {!metrics && (
            <p className="gr-metric-foot" style={{ marginTop: 14 }}>
              This lesson came from a Google Meet transcript, so the measured numbers
              (pace, thinking time, hesitations) do not exist for it. Lessons recorded
              with the extension will show them here.
            </p>
          )}

          {summary.recap && (
            <div className="card p-5" style={{ marginTop: 10 }}>
              <p className="text-sm text-muted leading-relaxed">{summary.recap}</p>
            </div>
          )}
        </>
      ) : null,
    },
    {
      id: 'won',
      label: 'What you nailed',
      count: didWell.length ? String(didWell.length) : null,
      node: didWell.length ? (
        <div className="card p-5">
          {didWell.map((d: any, i: number) => (
            <div className="gr-quote" key={i}>
              <p className="gr-fixed">&ldquo;{d?.said}&rdquo;</p>
              {d?.note && <p className="gr-why">{d.note}</p>}
            </div>
          ))}
        </div>
      ) : null,
    },
    {
      id: 'fix',
      label: 'What to fix',
      count: corrections.length ? String(corrections.length) : null,
      node: corrections.length ? (
        <div className="card p-5">
          {corrections.map((c: any, i: number) => (
            <div className="gr-quote" key={i}>
              <p className="gr-said">{c?.said}</p>
              <p className="gr-fixed">{c?.correction}</p>
              {c?.explanation && <p className="gr-why">{c.explanation}</p>}
            </div>
          ))}
        </div>
      ) : null,
    },
    {
      id: 'covered',
      label: 'What we covered',
      count: sections.length ? String(sections.length) : null,
      node: sections.length ? (
        <>
          {sections.map((s: any) => (
            <div className="card p-5" key={s.id}>
              <h4 className="font-bold text-ink text-sm mb-2">{s.title}</h4>
              {s.content && <SectionContent content={s.content} />}
            </div>
          ))}
        </>
      ) : null,
    },
    {
      id: 'words',
      label: 'Words from today',
      count: vocab.length ? String(vocab.length) : null,
      node: vocab.length ? (
        <>
          {levels.length > 0 && (
            <div className="card p-5">
              <p className="gr-sublab" style={{ marginBottom: 12 }}>Spread across levels</p>
              <div className="gr-levels">
                {levels.map(([lv, n]) => (
                  <div className="gr-level" key={lv}>
                    <b>{lv}</b>
                    <div className="gr-level-track">
                      <div className="gr-level-fill"
                           style={{ width: `${(n / vocab.length) * 100}%`, background: LEVEL_COLOUR[lv] ?? '#a855f7' }} />
                    </div>
                    <span style={{ textAlign: 'right' }}>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="card p-5">
            <div className="grid gap-3">
              {vocab.map((v: any) => (
                <div key={v.id} className="grid gap-1"
                     style={{ gridTemplateColumns: '150px minmax(0,1fr) auto', alignItems: 'baseline' }}>
                  <span className="font-bold text-ink text-sm">
                    {v.word} {v.reading && <span className="text-muted font-medium text-xs">{v.reading}</span>}
                  </span>
                  <span className="text-sm text-muted">{v.definition}</span>
                  {v.jlpt_level && <span className="gr-tag">{v.jlpt_level}</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null,
    },
    {
      id: 'practice',
      label: 'Practice',
      count: homework.length ? String(homework.length) : null,
      node: homework.length ? (
        <div className="card p-5">
          <ul className="space-y-2">
            {homework.map((h: any) => (
              <li key={h.id} className="text-sm text-ink">• {h.description}</li>
            ))}
          </ul>
        </div>
      ) : null,
    },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12 px-3 pt-6">
      <div className="card p-4" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
        <p className="text-xs font-bold" style={{ color: '#9a3412' }}>
          Local preview · real data · not reachable in production
        </p>
      </div>
      <div className="card p-7" style={{ background: 'linear-gradient(180deg,#ffffff 0%,#f7f4ff 100%)' }}>
        <div className="inline-flex items-center gap-2 mb-4 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-brand-600 text-sm font-bold">
          <span className="w-2 h-2 rounded-full bg-brand-600 inline-block" />
          Lesson {l.lesson_number} · Recap
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink leading-tight mb-1">
          {l.title || `Lesson ${l.lesson_number}`}
        </h1>
        <p className="text-sm text-muted">{l.lesson_date} · {studentName} &amp; Noa</p>
      </div>
      <RecapFlow movements={movements} back={{ href: '/student/dashboard', label: 'Dashboard' }} />
    </div>
  )
}
