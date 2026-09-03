/**
 * Student-portal branding.
 *
 * Every teacher gets their own look for the view their students see. The
 * values live in `profiles.brand` (JSONB) so the toolkit can add options
 * without a migration; this module owns the shape and the defaults, and is
 * the only place that decides what an unset field falls back to.
 */

/** Page background pattern behind the student portal. All CSS, no assets. */
export type BackgroundStyle = 'plain' | 'dots' | 'grid' | 'blobs' | 'rings' | 'waves' | 'wash'
/** How round everything is — cards, buttons, inputs. */
export type ShapeStyle = 'rounded' | 'soft' | 'sharp' | 'pill'
/** Decorative 3D props on page headers — the lesson recap, tests, booking. */
export type PropStyle = 'orbs' | 'geometric' | 'minimal' | 'none'

/** Blocks a teacher can arrange on the student dashboard. */
export const DASHBOARD_BLOCKS = [
  'stats', 'lessons', 'progress', 'vocab', 'vocabTotals',
  'milestone', 'scores', 'tests', 'speaking', 'files', 'flashcards',
] as const
export type BlockId = (typeof DASHBOARD_BLOCKS)[number]

export const BLOCK_LABELS: Record<BlockId, string> = {
  stats: 'Stat cards',
  lessons: 'Lesson cards',
  progress: 'Progress charts',
  vocab: 'Vocabulary',
  vocabTotals: 'Vocabulary growth',
  milestone: 'Milestone',
  scores: 'Recent scores',
  tests: 'Practice tests',
  speaking: 'Speaking habits',
  files: 'Lesson files',
  flashcards: 'Flashcards',
}

/** The student dashboard is tabbed; each block belongs to one tab. */
export const DASH_TABS = ['Overview', 'Lessons', 'Progress', 'Vocabulary', 'Files', 'Tests'] as const
export type DashTab = (typeof DASH_TABS)[number]

export const DASH_BLOCK_TAB: Record<BlockId, DashTab> = {
  stats: 'Overview', scores: 'Overview', milestone: 'Overview', vocabTotals: 'Overview',
  lessons: 'Lessons',
  progress: 'Progress', speaking: 'Progress', flashcards: 'Progress',
  vocab: 'Vocabulary',
  files: 'Files',
  tests: 'Tests',
}

/**
 * Dashboard blocks a teacher cannot switch off — the same boundary the recap
 * draws. The lesson list is the dashboard; the files and tests tabs are where
 * shared files and published tests live, and a hidden tab does not unpublish
 * them, it strands them.
 */
export const DASH_LOCKED: ReadonlySet<BlockId> = new Set<BlockId>(['lessons', 'files', 'tests'])

/** The three stat cards, individually removable — see RECAP_METRICS. */
export const DASH_STAT_TILES = [
  { id: 'lessons', label: 'Lessons' },
  { id: 'score', label: 'Avg score' },
  { id: 'speaking', label: 'Speaking share' },
] as const
export type DashStatId = (typeof DASH_STAT_TILES)[number]['id']

/** The speaking-habits tiles, same idea. */
export const DASH_SPEAK_TILES = [
  { id: 'pace', label: 'Pace' },
  { id: 'think', label: 'Thinking time' },
  { id: 'share', label: 'Your share' },
] as const
export type DashSpeakId = (typeof DASH_SPEAK_TILES)[number]['id']

/** Every block a teacher can switch off, and the field that switches it. */
export const BLOCK_TOGGLE: Record<BlockId, keyof Brand> = {
  stats: 'showStats',
  lessons: 'showLessons',
  milestone: 'showMilestone',
  scores: 'showScores',
  progress: 'showProgress',
  vocab: 'showVocab',
  vocabTotals: 'showVocabTotals',
  tests: 'showTests',
  speaking: 'showSpeaking',
  files: 'showFiles',
  flashcards: 'showFlashcards',
}

/**
 * Every fixed string on the student portal, and what it says out of the box.
 * The teacher edits these on the canvas; anything they haven't touched falls
 * back to the default here, so adding a slot never leaves a blank on a page.
 */
export const TEXT_SLOTS = {
  greeting: 'Welcome back,',
  tabOverview: 'Overview',
  tabLessons: 'Lessons',
  tabProgress: 'Progress',
  tabVocabulary: 'Vocabulary',
  tabFiles: 'Files',
  tabTests: 'Tests',
  statLessons: 'Lessons',
  statScore: 'Avg score',
  statSpeaking: 'Speaking',
  lessonsTitle: 'Your lessons',
  progressTitle: 'Your progress',
  vocabTitle: 'Vocabulary',
  milestoneTitle: 'Next milestone',
  scoresTitle: 'Recent scores',
  testsTitle: 'Practice tests',
  speakingTitle: 'Speaking habits',
  filesTitle: 'Lesson files',
  vocabTotalsTitle: 'Vocabulary growth',
} as const
export type TextSlot = keyof typeof TEXT_SLOTS
export const TEXT_SLOT_IDS = Object.keys(TEXT_SLOTS) as TextSlot[]

/** Which slots belong to which block — the studio groups them that way. */
export const BLOCK_TEXT_SLOTS: Partial<Record<BlockId, TextSlot[]>> = {
  stats: ['statLessons', 'statScore', 'statSpeaking'],
  lessons: ['lessonsTitle'],
  progress: ['progressTitle'],
  vocab: ['vocabTitle'],
  vocabTotals: ['vocabTotalsTitle'],
  milestone: ['milestoneTitle'],
  scores: ['scoresTitle'],
  tests: ['testsTitle'],
  speaking: ['speakingTitle'],
  files: ['filesTitle'],
}

/** Tabs on the student's lesson recap page. */
export const LESSON_TABS = ['Progress', 'Lesson', 'Practice', 'Vocabulary', 'Files'] as const
export type LessonTab = (typeof LESSON_TABS)[number]

/** Arrangeable sections of the lesson recap page. */
export const LESSON_BLOCKS = [
  'memo', 'balance', 'score', 'grammar', 'metrics', 'corrections',
  'sections', 'homework', 'exercises', 'vocabWords', 'files',
] as const
export type LessonBlockId = (typeof LESSON_BLOCKS)[number]

export const LESSON_BLOCK_LABELS: Record<LessonBlockId, string> = {
  memo: 'Voice memo',
  balance: 'Speaking balance',
  score: 'Score',
  grammar: 'Grammar density',
  metrics: 'Speaking, measured',
  corrections: 'Corrections',
  sections: 'Lesson notes',
  homework: 'Homework',
  exercises: 'Practice exercises',
  vocabWords: 'Word list',
  files: 'Files',
}

/** What each recap section actually puts in front of the student. */
export const LESSON_BLOCK_HINTS: Record<LessonBlockId, string> = {
  memo: 'The spoken note you record for them',
  balance: 'How much of the hour each of you talked',
  score: 'The mark you gave the lesson',
  grammar: 'How dense the grammar was, and how many words came up',
  metrics: 'Pace, thinking time, hesitations',
  corrections: 'What they got wrong, put right — and what they nailed',
  sections: 'Your written notes on the lesson',
  homework: 'What to go and do before next time',
  exercises: 'Flashcards and practice questions',
  vocabWords: 'Every word from this lesson',
  files: 'Files you share, and audio they send back',
}

/**
 * Every recap section a teacher can switch off, and the field that switches it.
 * A section switched off leaves the page entirely — and a tab with nothing left
 * on it leaves the tab bar too, so the recap closes up rather than showing an
 * empty room. See LessonPageTabs.
 */
export const LESSON_BLOCK_TOGGLE: Record<LessonBlockId, keyof Brand> = {
  memo: 'showRecapMemo',
  balance: 'showRecapBalance',
  score: 'showRecapScore',
  grammar: 'showRecapGrammar',
  metrics: 'showRecapMetrics',
  corrections: 'showRecapCorrections',
  sections: 'showRecapNotes',
  homework: 'showRecapHomework',
  exercises: 'showRecapExercises',
  vocabWords: 'showRecapVocab',
  files: 'showRecapFiles',
}

/**
 * Recap sections a teacher cannot switch off.
 *
 * The notes, the homework, the exercises, the words and the files ARE the
 * recap — a recap without them is a scoreboard, and a student paying for
 * lessons should never open one. What is optional is the measurement around
 * them. The memo is here too because it already governs itself: record
 * nothing and the student sees nothing, so a switch for it would only say
 * what the content already says.
 */
export const LESSON_LOCKED: ReadonlySet<LessonBlockId> = new Set<LessonBlockId>([
  'memo', 'sections', 'homework', 'exercises', 'vocabWords', 'files',
])

/**
 * The tiles of "Your speaking, measured", individually removable — a teacher
 * who likes the pace number but not the hesitation count keeps one and drops
 * the other, rather than all or none.
 */
export const RECAP_METRICS = [
  { id: 'wpm', label: 'Words / min' },
  { id: 'think', label: 'Thinking time' },
  { id: 'longest', label: 'Longest answer' },
  { id: 'turn', label: 'Words / answer' },
  { id: 'fillers', label: 'Hesitation words' },
  { id: 'pauses', label: 'Long pauses' },
] as const
export type RecapMetricId = (typeof RECAP_METRICS)[number]['id']

/** A recap block belongs to one tab; arranging happens inside that tab. */
export const LESSON_BLOCK_TAB: Record<LessonBlockId, LessonTab> = {
  // The memo sits with the lesson itself, not the measurements.
  memo: 'Lesson',
  balance: 'Progress', score: 'Progress', grammar: 'Progress', metrics: 'Progress', corrections: 'Progress',
  sections: 'Lesson',
  homework: 'Practice', exercises: 'Practice',
  vocabWords: 'Vocabulary',
  files: 'Files',
}

/**
 * Blocks flow left to right and wrap, each `w` of 12 columns wide — see
 * .k-flow. The arrangement is ours, not the teacher's: they used to drag and
 * resize every block, which bought a handful of layouts nobody asked for and a
 * long tail of ways to end up with a broken page. They style it instead.
 */
export type Placement<T extends string = BlockId> = { id: T; w: number }

/** The recap page's fixed arrangement. The dashboard's is DASHBOARD_LAYOUT,
 *  next to the components it places. */
/**
 * The recap reads as one scroll, in movements. Tabs are gone: a student who
 * had to find the corrections behind the second tab mostly never did.
 *
 * Each movement is named by the progress strip as you reach it, and carries
 * its own tint. The order is the order a lesson matters in — how it went,
 * what was good, what to fix, what was covered, then the things to go and do.
 */
export const LESSON_MOVEMENTS = [
  { id: 'spoke', label: 'How you spoke' },
  { id: 'won', label: 'What you nailed' },
  { id: 'fix', label: 'What to fix' },
  { id: 'covered', label: 'What we covered' },
  { id: 'words', label: 'Words from today' },
  { id: 'practice', label: 'Practice' },
  { id: 'files', label: 'Files & audio' },
] as const
export type MovementId = (typeof LESSON_MOVEMENTS)[number]['id']

/**
 * Where each old tab now lands. The branding studio still thinks in tabs — it
 * jumps the preview to the tab a section belongs to — so this keeps every one
 * of those jumps pointing at something without touching the studio.
 */
export const TAB_MOVEMENT: Record<LessonTab, MovementId> = {
  Progress: 'spoke',
  Lesson: 'fix',
  Practice: 'practice',
  Vocabulary: 'words',
  Files: 'files',
}

export const LESSON_LAYOUT: Placement<LessonBlockId>[] = [
  // No 'memo' entry: the voice memo lives in the page header now, next to the
  // date — it is the teacher speaking, not a section of the write-up. The id
  // survives in LessonBlockId so stored brands still round-trip.
  { id: 'balance', w: 4 }, { id: 'score', w: 4 }, { id: 'grammar', w: 4 },
  { id: 'metrics', w: 12 }, { id: 'corrections', w: 12 },
  { id: 'sections', w: 12 },
  // Homework reads first and on its own line: it is the short list of things
  // to actually go and do, and beside a stack of exercises it got skimmed past.
  { id: 'homework', w: 12 }, { id: 'exercises', w: 12 },
  { id: 'vocabWords', w: 12 },
  { id: 'files', w: 12 },
]

/**
 * The milestone ladder. Each rung is a name the student reaches at `lessons`
 * lessons — the teacher owns both, so a course can count in whatever units it
 * teaches in.
 */
export type Level = { name: string; lessons: number }
export const MAX_LEVELS = 8
export const MAX_LEVEL_LESSONS = 999

// GENOA's own ladder — the rungs and the badges Noa's students already know.
const DEFAULT_LEVELS: Level[] = [
  { name: 'Getting Started', lessons: 1 },
  { name: 'Beginner', lessons: 5 },
  { name: 'Elementary', lessons: 10 },
  { name: 'Intermediate', lessons: 25 },
  { name: 'Advanced', lessons: 50 },
]

/**
 * Where a student stands on the ladder. `pct` is progress through the current
 * rung, not the whole ladder, so the bar fills once per level.
 */
export function levelProgress(levels: Level[], lessonCount: number) {
  const rungs = levels.length ? levels : DEFAULT_LEVELS
  const reached = rungs.filter((l) => l.lessons <= lessonCount)
  const next = rungs.find((l) => l.lessons > lessonCount)
  const from = reached.length ? reached[reached.length - 1].lessons : 0
  const target = next?.lessons ?? rungs[rungs.length - 1].lessons
  const span = Math.max(1, target - from)
  return {
    rungs,
    /** The last rung reached, if any. */
    current: reached[reached.length - 1],
    /** The rung being worked towards — undefined once the ladder is finished. */
    next,
    target,
    remaining: Math.max(0, target - lessonCount),
    pct: next ? Math.max(0, Math.min(100, Math.round(((lessonCount - from) / span) * 100))) : 100,
    /** What to call the thing ahead of them (or the top rung, once done). */
    label: (next ?? rungs[rungs.length - 1]).name,
  }
}

/** Heading + body pairing for the student portal. */
export type FontId = 'modern' | 'techy' | 'editorial' | 'friendly' | 'plain'

export const FONTS: { value: FontId; label: string; hint: string; head: string; body: string }[] = [
  { value: 'modern', label: 'Modern', hint: 'Outfit · Jakarta', head: '"Outfit"', body: '"Plus Jakarta Sans"' },
  { value: 'techy', label: 'Techy', hint: 'Space Grotesk · Inter', head: '"Space Grotesk"', body: '"Inter"' },
  { value: 'editorial', label: 'Editorial', hint: 'Fraunces · Inter', head: '"Fraunces"', body: '"Inter"' },
  { value: 'friendly', label: 'Friendly', hint: 'Nunito', head: '"Nunito"', body: '"Nunito"' },
  { value: 'plain', label: 'Plain', hint: 'Inter', head: '"Inter"', body: '"Inter"' },
]

const FONT_STACK = 'system-ui, sans-serif'

export type Brand = {
  /** Primary colour — buttons, active states, progress fills. */
  accent: string
  /** Short mark shown in the rail (emoji or 1–2 letters). */
  logoText: string
  /** What the student portal is called. */
  portalName: string
  background: BackgroundStyle
  shape: ShapeStyle
  props: PropStyle
  font: FontId
  /** Milestone ladder, easiest first. */
  levels: Level[]
  /** Every fixed string on the portal, defaults filled in. */
  labels: Record<TextSlot, string>
  showStats: boolean
  showLessons: boolean
  showScores: boolean
  showMilestone: boolean
  showProgress: boolean
  showVocab: boolean
  showVocabTotals: boolean
  showTests: boolean
  showSpeaking: boolean
  showFiles: boolean
  showFlashcards: boolean
  /** Speaking-measured tiles the teacher has taken off the recap. */
  hiddenMetrics: RecapMetricId[]
  /** Stat cards taken off the dashboard's Overview. */
  hiddenStats: DashStatId[]
  /** Speaking-habits tiles taken off the dashboard's Progress tab. */
  hiddenSpeaking: DashSpeakId[]
  /** Recap sections — the same idea, one page down. See LESSON_BLOCK_TOGGLE.
   *  The ones in LESSON_LOCKED are forced true by resolveBrand and kept only
   *  so a stored brand from before the lock still round-trips. */
  showRecapMemo: boolean
  showRecapBalance: boolean
  showRecapScore: boolean
  showRecapGrammar: boolean
  showRecapMetrics: boolean
  showRecapCorrections: boolean
  showRecapNotes: boolean
  showRecapHomework: boolean
  showRecapExercises: boolean
  showRecapVocab: boolean
  showRecapFiles: boolean
}

export const DEFAULT_BRAND: Brand = {
  accent: '#4f46e5',
  logoText: 'G',
  portalName: 'GENOA Library',
  background: 'plain',
  shape: 'rounded',
  props: 'orbs',
  font: 'modern',
  levels: DEFAULT_LEVELS,
  labels: { ...TEXT_SLOTS },
  showStats: true,
  showLessons: true,
  showScores: true,
  showMilestone: true,
  showProgress: true,
  showVocab: true,
  showVocabTotals: true,
  showTests: true,
  showSpeaking: true,
  showFiles: true,
  showFlashcards: true,
  hiddenMetrics: [],
  hiddenStats: [],
  hiddenSpeaking: [],
  showRecapMemo: true,
  showRecapBalance: true,
  showRecapScore: true,
  showRecapGrammar: true,
  showRecapMetrics: true,
  showRecapCorrections: true,
  showRecapNotes: true,
  showRecapHomework: true,
  showRecapExercises: true,
  showRecapVocab: true,
  showRecapFiles: true,
}

/**
 * Complete looks. A preset is the whole vibe — colour, type, texture, corners
 * and how the blocks are arranged — so picking one replaces the arrangement
 * too, not just the palette.
 */
export type Preset = {
  id: string
  name: string
  hint: string
  brand: Pick<Brand, 'accent' | 'background' | 'shape' | 'props' | 'font'>
}

export const PRESETS: Preset[] = [
  {
    id: 'studio',
    name: 'Studio',
    hint: 'The house look — signal blue on white',
    brand: {
      accent: '#0a61c9', background: 'plain', shape: 'rounded', props: 'orbs', font: 'modern',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    hint: 'Deep indigo, tight corners, data first',
    brand: {
      accent: '#4338ca', background: 'grid', shape: 'soft', props: 'geometric', font: 'techy',
    },
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    hint: 'Warm clay, soft wash, welcoming',
    brand: {
      accent: '#b45309', background: 'wash', shape: 'rounded', props: 'orbs', font: 'friendly',
    },
  },
  {
    id: 'editorial',
    name: 'Editorial',
    hint: 'Serif headlines, plum accent, roomy',
    brand: {
      accent: '#7e22ce', background: 'plain', shape: 'sharp', props: 'minimal', font: 'editorial',
    },
  },
  {
    id: 'playful',
    name: 'Playful',
    hint: 'Pink, pill corners, everything in view',
    brand: {
      accent: '#be123c', background: 'dots', shape: 'pill', props: 'orbs', font: 'friendly',
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    hint: 'Slate, no ornament, one column',
    brand: {
      accent: '#334155', background: 'plain', shape: 'soft', props: 'none', font: 'plain',
    },
  },
]

/** Accent presets offered in the toolkit — friendly, high-contrast on white. */
export const ACCENT_PRESETS = [
  { name: 'Signal', value: '#0a61c9' },
  { name: 'Harbour', value: '#749dc8' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Ocean', value: '#0369a1' },
  { name: 'Forest', value: '#234f3c' },
  { name: 'Plum', value: '#7e22ce' },
  { name: 'Clay', value: '#b45309' },
  { name: 'Rose', value: '#be123c' },
  { name: 'Slate', value: '#334155' },
  { name: 'Teal', value: '#0f766e' },
] as const

export const BACKGROUNDS = ['plain', 'dots', 'grid', 'blobs', 'rings', 'waves', 'wash'] as const
export const SHAPES = ['rounded', 'soft', 'sharp', 'pill'] as const
export const PROPS = ['orbs', 'geometric', 'minimal', 'none'] as const

/** Corner radii per shape, mapped onto the tokens the whole UI already uses. */
const SHAPE_RADII: Record<ShapeStyle, { md: string; lg: string; xl: string }> = {
  rounded: { md: '16px', lg: '22px', xl: '28px' },
  soft:    { md: '12px', lg: '16px', xl: '20px' },
  sharp:   { md: '4px',  lg: '6px',  xl: '8px'  },
  pill:    { md: '20px', lg: '28px', xl: '36px' },
}

const HEX = /^#[0-9a-fA-F]{6}$/

/** Merge a stored (possibly partial or malformed) brand onto the defaults. */
export function resolveBrand(raw: unknown): Brand {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Partial<Brand> & { heights?: unknown }
  const str = (v: unknown, fallback: string, max = 240) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

  return {
    accent: typeof b.accent === 'string' && HEX.test(b.accent) ? b.accent : DEFAULT_BRAND.accent,
    logoText: str(b.logoText, DEFAULT_BRAND.logoText, 4),
    portalName: str(b.portalName, DEFAULT_BRAND.portalName, 40),
    background: (BACKGROUNDS as readonly string[]).includes(b.background as string) ? (b.background as BackgroundStyle) : DEFAULT_BRAND.background,
    shape: (SHAPES as readonly string[]).includes(b.shape as string) ? (b.shape as ShapeStyle) : DEFAULT_BRAND.shape,
    props: (PROPS as readonly string[]).includes(b.props as string) ? (b.props as PropStyle) : DEFAULT_BRAND.props,
    font: FONTS.some((f) => f.value === b.font) ? (b.font as FontId) : DEFAULT_BRAND.font,
    levels: resolveLevels(b.levels),
    labels: resolveLabels(b.labels),
    showStats: bool(b.showStats, DEFAULT_BRAND.showStats),
    // Locked dashboard blocks, same treatment as the recap's: forced true so a
    // brand stored before the lock cannot strand published tests or shared
    // files behind a hidden tab.
    showLessons: true,
    showScores: bool(b.showScores, DEFAULT_BRAND.showScores),
    showMilestone: bool(b.showMilestone, DEFAULT_BRAND.showMilestone),
    showProgress: bool(b.showProgress, DEFAULT_BRAND.showProgress),
    showVocab: bool(b.showVocab, DEFAULT_BRAND.showVocab),
    showVocabTotals: bool(b.showVocabTotals, DEFAULT_BRAND.showVocabTotals),
    showTests: true,
    showSpeaking: bool(b.showSpeaking, DEFAULT_BRAND.showSpeaking),
    showFiles: true,
  showFlashcards: true,
    hiddenMetrics: Array.isArray(b.hiddenMetrics)
      ? (b.hiddenMetrics as unknown[]).filter((x): x is RecapMetricId => RECAP_METRICS.some((mm) => mm.id === x))
      : [],
    hiddenStats: Array.isArray(b.hiddenStats)
      ? (b.hiddenStats as unknown[]).filter((x): x is DashStatId => DASH_STAT_TILES.some((t) => t.id === x))
      : [],
    hiddenSpeaking: Array.isArray(b.hiddenSpeaking)
      ? (b.hiddenSpeaking as unknown[]).filter((x): x is DashSpeakId => DASH_SPEAK_TILES.some((t) => t.id === x))
      : [],
    // Locked sections come back true no matter what was stored — a brand saved
    // before the lock may carry a false, and it must not strip a student's
    // recap of its notes or homework.
    showRecapMemo: true,
    showRecapBalance: bool(b.showRecapBalance, DEFAULT_BRAND.showRecapBalance),
    showRecapScore: bool(b.showRecapScore, DEFAULT_BRAND.showRecapScore),
    showRecapGrammar: bool(b.showRecapGrammar, DEFAULT_BRAND.showRecapGrammar),
    showRecapMetrics: bool(b.showRecapMetrics, DEFAULT_BRAND.showRecapMetrics),
    showRecapCorrections: bool(b.showRecapCorrections, DEFAULT_BRAND.showRecapCorrections),
    showRecapNotes: true,
    showRecapHomework: true,
    showRecapExercises: true,
    showRecapVocab: true,
    showRecapFiles: true,
  }
}

/** Stored overrides merged onto the default wording, unknown slots dropped. */
export function resolveLabels(raw: unknown): Record<TextSlot, string> {
  const out = { ...TEXT_SLOTS } as Record<TextSlot, string>
  if (raw && typeof raw === 'object') {
    for (const slot of TEXT_SLOT_IDS) {
      const v = (raw as any)[slot]
      if (typeof v === 'string' && v.trim()) out[slot] = v.trim().slice(0, 40)
    }
  }
  return out
}

/**
 * Normalise a stored ladder: keep named rungs with a sane lesson count, order
 * them easiest-first, drop rungs that repeat a count, and fall back to the
 * defaults if nothing usable survives.
 */
export function resolveLevels(raw: unknown): Level[] {
  if (!Array.isArray(raw)) return DEFAULT_LEVELS
  const seen = new Set<number>()
  const out: Level[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const name = typeof (r as any).name === 'string' ? (r as any).name.trim().slice(0, 24) : ''
    const lessons = Math.round(Number((r as any).lessons))
    if (!name || !Number.isFinite(lessons) || lessons < 1 || lessons > MAX_LEVEL_LESSONS) continue
    if (seen.has(lessons)) continue
    seen.add(lessons)
    out.push({ name, lessons })
  }
  if (out.length === 0) return DEFAULT_LEVELS
  return out.sort((a, b) => a.lessons - b.lessons).slice(0, MAX_LEVELS)
}

/** Darken a hex colour for hover/pressed states. */
export function shade(hex: string, amount = -0.18): string {
  if (!HEX.test(hex)) return hex
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = Math.round(c + (amount < 0 ? c * amount : (255 - c) * amount))
    return Math.max(0, Math.min(255, v))
  })
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('')
}

/**
 * CSS custom properties for a brand. Spread onto any wrapper element to
 * re-theme everything inside it — used by both the real student portal and
 * the live preview in the branding toolkit.
 */
export function brandVars(brand: Brand): React.CSSProperties {
  const r = SHAPE_RADII[brand.shape] ?? SHAPE_RADII.rounded
  const f = FONTS.find((x) => x.value === brand.font) ?? FONTS[0]
  return {
    ['--forest' as any]: brand.accent,
    ['--forest-deep' as any]: shade(brand.accent, -0.22),
    ['--brand' as any]: brand.accent,
    ['--brand-soft' as any]: shade(brand.accent, 0.88),
    ['--r-md' as any]: r.md,
    ['--r-lg' as any]: r.lg,
    ['--r-xl' as any]: r.xl,
    ['--font-head' as any]: `${f.head}, ${FONT_STACK}`,
    ['--font-body' as any]: `${f.body}, ${FONT_STACK}`,
    // Consumed by the .k-bg-* background rules.
    ['--bg-ink' as any]: shade(brand.accent, 0.72),
    ['--bg-tint' as any]: shade(brand.accent, 0.93),
  }
}

/** Class that paints the page background for a brand. */
export function backgroundClass(brand: Brand): string {
  return `k-bg-${brand.background}`
}

