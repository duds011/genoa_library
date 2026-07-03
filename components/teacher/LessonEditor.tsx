'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, CheckCircle, Eye, EyeOff, Save, ChevronDown, ChevronUp, GripVertical, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import SectionContent from '@/components/student/SectionContent'
import AudioFeedback from '@/components/teacher/AudioFeedback'
import TeacherFeedbackRecorder from '@/components/teacher/TeacherFeedbackRecorder'
import { deleteLesson } from '@/app/actions/lessons'
import { setHomeworkFeedbackAudio } from '@/app/actions/audioFeedback'

interface LessonSection {
  id: string
  title: string
  content: string
  sort_order: number
}

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

interface VocabItem {
  id: string
  word: string
  reading: string
  definition: string
  example_sentence: string
  jlpt_level?: string | null
  sort_order: number
}

interface HomeworkItem {
  id: string
  description: string
  completed: boolean
  sort_order: number
}

interface Attachment {
  id: string
  file_name: string
  file_url: string
  sort_order: number
}

interface StudentOption {
  id: string
  full_name: string
  email: string
}

interface Props {
  lessonId: string
  lessonTitle?: string
  lessonNumber?: number
  status: 'draft' | 'published'
  studentId: string
  allStudents?: StudentOption[]
  summary: any
  audioScript?: string
  voiceFileUrl?: string
  vocab: VocabItem[]
  homework: HomeworkItem[]
  sections: LessonSection[]
  attachments: Attachment[]
  hwSubmissions?: any[]
  audioSubmissions?: any[]
  studentEmail?: string
  rawTranscript?: string
}

export default function LessonEditor({
  lessonId,
  lessonTitle,
  lessonNumber,
  status,
  studentId,
  allStudents = [],
  summary,
  audioScript: initialAudioScript = '',
  voiceFileUrl: initialVoiceFileUrl = '',
  vocab: initialVocab,
  homework: initialHomework,
  sections: initialSections,
  attachments: initialAttachments,
  hwSubmissions: initialHwSubmissions = [],
  audioSubmissions = [],
  studentEmail = '',
  rawTranscript,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, startDeleteTransition] = useTransition()

  // Lesson fields
  const [title, setTitle] = useState(lessonTitle ?? '')
  const [lessonNum, setLessonNum] = useState<number>(lessonNumber ?? 1)
  const [assignedStudentId, setAssignedStudentId] = useState(studentId)

  // Summary fields
  const [recap, setRecap] = useState(summary?.recap ?? '')
  const [score, setScore] = useState<number>(summary?.score ?? 7.5)
  const [talkPct, setTalkPct] = useState<number>(summary?.talk_percentage ?? 40)
  const [grammarDensity, setGrammarDensity] = useState(summary?.grammar_density ?? '')
  const [confidenceLabel, setConfidenceLabel] = useState(summary?.confidence_label ?? '')
  const [teacherNote, setTeacherNote] = useState(summary?.teacher_note ?? '')
  const [teacherNotes, setTeacherNotes] = useState(summary?.teacher_notes ?? '')

  // Sections
  const [sections, setSections] = useState<LessonSection[]>(initialSections)
  const [previewSections, setPreviewSections] = useState<Set<string>>(new Set())

  // Vocab
  const [vocabItems, setVocabItems] = useState<VocabItem[]>(initialVocab)
  const [newVocab, setNewVocab] = useState({ word: '', reading: '', definition: '', example_sentence: '', jlpt_level: '' })

  // Homework
  const [hwItems, setHwItems] = useState<HomeworkItem[]>(initialHomework)
  const [newHw, setNewHw] = useState('')

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [fileError, setFileError] = useState('')

  // Voice recording
  const [voiceFileUrl, setVoiceFileUrl] = useState(initialVoiceFileUrl)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [showAudioScript, setShowAudioScript] = useState(false)
  const [audioScript, setAudioScript] = useState(initialAudioScript)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function startRecording() {
    setAudioError('')
    chunksRef.current = []
    setRecordingSeconds(0)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await uploadAudio(new File([blob], `lesson-${lessonId}.webm`, { type: 'audio/webm' }))
      }
      recorder.start(1000) // flush data every second — prevents 15s cap on some browsers
      setIsRecording(true)
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch {
      setAudioError('Microphone access denied. Please allow it in your browser and try again.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  // Homework submissions (teacher view)
  const [hwSubmissions, setHwSubmissions] = useState<any[]>(initialHwSubmissions)
  const [hwFeedback, setHwFeedback] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(initialHwSubmissions.some((s: any) => s.feedback_sent_at))
  const [feedbackError, setFeedbackError] = useState('')

  async function sendFeedback() {
    if (!hwFeedback.trim() || !assignedStudentId) return
    setSendingFeedback(true)
    setFeedbackError('')
    try {
      const res = await fetch('/api/send-homework-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, studentId: assignedStudentId, feedback: hwFeedback }),
      })
      if (!res.ok) { setFeedbackError('Failed to send — try again.'); return }
      setFeedbackSent(true)
      setHwFeedback('')
    } finally {
      setSendingFeedback(false)
    }
  }

  // ─── Audio upload ─────────────────────────────────────────────────────────

  async function uploadAudio(file: File) {
    setUploadingAudio(true)
    setAudioError('')
    try {
      const ext = file.name.split('.').pop() ?? 'mp3'
      const path = `${lessonId}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('lesson-audio')
        .upload(path, file, { upsert: true })
      if (upErr) { setAudioError(upErr.message); return }
      const { data: { publicUrl } } = supabase.storage.from('lesson-audio').getPublicUrl(path)
      const urlWithBust = `${publicUrl}?t=${Date.now()}` // bust browser cache on re-upload
      await supabase.from('lessons').update({ voice_file_url: publicUrl }).eq('id', lessonId)
      setVoiceFileUrl(urlWithBust)
    } finally {
      setUploadingAudio(false)
    }
  }

  async function removeAudio() {
    await supabase.from('lessons').update({ voice_file_url: null }).eq('id', lessonId)
    setVoiceFileUrl('')
  }

  // ─── Attachments ──────────────────────────────────────────────────────────

  async function uploadAttachment(file: File) {
    setUploadingFile(true)
    setFileError('')
    try {
      const ext = file.name.split('.').pop() ?? 'pdf'
      const path = `${lessonId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('lesson-attachments')
        .upload(path, file)
      if (upErr) { setFileError(upErr.message); return }
      const { data: { publicUrl } } = supabase.storage.from('lesson-attachments').getPublicUrl(path)
      const { data } = await supabase
        .from('lesson_attachments')
        .insert({ lesson_id: lessonId, file_name: file.name, file_url: publicUrl, sort_order: attachments.length })
        .select()
        .single()
      if (data) setAttachments(prev => [...prev, data])
    } finally {
      setUploadingFile(false)
    }
  }

  async function deleteAttachment(id: string, fileUrl: string) {
    const path = fileUrl.split('/lesson-attachments/')[1]
    if (path) await supabase.storage.from('lesson-attachments').remove([path])
    await supabase.from('lesson_attachments').delete().eq('id', id)
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  // ─── Sections ─────────────────────────────────────────────────────────────

  async function updateSection(id: string, field: 'title' | 'content', value: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  async function saveSection(id: string) {
    const s = sections.find(s => s.id === id)
    if (!s) return
    await supabase.from('lesson_sections').update({ title: s.title, content: s.content }).eq('id', id)
  }

  async function deleteSection(id: string) {
    await supabase.from('lesson_sections').delete().eq('id', id)
    setSections(prev => prev.filter(s => s.id !== id))
  }

  async function addSection() {
    const maxOrder = sections.reduce((max, s) => Math.max(max, s.sort_order ?? 0), -1)
    const { data } = await supabase
      .from('lesson_sections')
      .insert({ lesson_id: lessonId, title: 'New Section', content: '', sort_order: maxOrder + 1 })
      .select()
      .single()
    if (data) setSections(prev => [...prev, data as LessonSection])
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    try {
      // Update lesson title, number, and student assignment
      await supabase
        .from('lessons')
        .update({ title, lesson_number: lessonNum, student_id: assignedStudentId || null, updated_at: new Date().toISOString() })
        .eq('id', lessonId)

      // Upsert summary
      await supabase.from('lesson_summaries').upsert({
        lesson_id: lessonId,
        recap,
        score,
        talk_percentage: talkPct,
        grammar_density: grammarDensity || null,
        confidence_label: confidenceLabel || null,
        teacher_note: teacherNote || null,
        teacher_notes: teacherNotes,
        audio_script: audioScript || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lesson_id' })

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  // ─── Publish ──────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (!assignedStudentId) return // guard: must have student before publishing
    setPublishing(true)
    try {
      await handleSave()
      await supabase
        .from('lessons')
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .eq('id', lessonId)

      // Send notification email before navigating away (fire-and-forget aborts on navigation)
      try {
        const r = await fetch('/api/notify-student', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId, studentId: assignedStudentId }),
        })
        if (!r.ok) console.error('notify-student failed:', await r.text())
      } catch (err) {
        console.error('notify-student error:', err)
      }

      router.push(`/teacher/students/${assignedStudentId}`)
      router.refresh()
    } finally {
      setPublishing(false)
    }
  }

  // ─── Vocab CRUD ───────────────────────────────────────────────────────────

  async function addVocab() {
    if (!newVocab.word || !newVocab.definition) return
    const item = {
      lesson_id: lessonId,
      word: newVocab.word,
      reading: newVocab.reading,
      definition: newVocab.definition,
      example_sentence: newVocab.example_sentence,
      jlpt_level: newVocab.jlpt_level || null,
      sort_order: vocabItems.length,
    }
    const { data } = await supabase.from('vocabulary_items').insert(item).select().single()
    if (data) setVocabItems(prev => [...prev, data])
    setNewVocab({ word: '', reading: '', definition: '', example_sentence: '', jlpt_level: '' })
  }

  async function deleteVocab(id: string) {
    await supabase.from('vocabulary_items').delete().eq('id', id)
    setVocabItems(prev => prev.filter(v => v.id !== id))
  }

  async function updateVocab(id: string, field: string, value: string) {
    setVocabItems(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  async function saveVocab(id: string) {
    const item = vocabItems.find(v => v.id === id)
    if (!item) return
    await supabase.from('vocabulary_items').update({
      word: item.word,
      reading: item.reading,
      definition: item.definition,
      example_sentence: item.example_sentence,
      jlpt_level: item.jlpt_level || null,
    }).eq('id', id)
  }

  // ─── Homework CRUD ────────────────────────────────────────────────────────

  async function addHomework() {
    if (!newHw.trim()) return
    const item = { lesson_id: lessonId, description: newHw.trim(), completed: false, sort_order: hwItems.length }
    const { data } = await supabase.from('homework_items').insert(item).select().single()
    if (data) setHwItems(prev => [...prev, data])
    setNewHw('')
  }

  async function deleteHomework(id: string) {
    await supabase.from('homework_items').delete().eq('id', id)
    setHwItems(prev => prev.filter(h => h.id !== id))
  }

  async function toggleHomework(id: string) {
    const item = hwItems.find(h => h.id === id)
    if (!item) return
    const newVal = !item.completed
    await supabase.from('homework_items').update({ completed: newVal }).eq('id', id)
    setHwItems(prev => prev.map(h => h.id === id ? { ...h, completed: newVal } : h))
  }

  return (
    <div className="space-y-6">

      {/* Lesson title + number + student assignment */}
      <div className="card p-6 space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="form-label">Lesson Title <span className="text-gray-400 font-normal normal-case">(shown to student as the page heading)</span></label>
            <input
              className="input w-full"
              placeholder="e.g. Self-Introductions, Greetings & Basic Particles"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div className="w-28 shrink-0">
            <label className="form-label">Lesson #</label>
            <input
              type="number"
              min={1}
              className="input w-full text-center font-bold text-brand-600"
              value={lessonNum}
              onChange={e => setLessonNum(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>

        {allStudents.length > 0 && (
          <div>
            <label className="form-label">
              Assigned Student
              {(assignedStudentId || '') !== (studentId || '') && (
                <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  ⚠ unsaved change
                </span>
              )}
            </label>
            <select
              className="input w-full"
              value={assignedStudentId}
              onChange={e => setAssignedStudentId(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {allStudents.map(s => (
                <option key={s.id} value={s.id}>
                  {s.full_name}{` — ${s.email}`}
                </option>
              ))}
            </select>
            {!assignedStudentId && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠ Assign a student before publishing — unassigned lessons can be saved as drafts but not published.
              </p>
            )}
            {assignedStudentId && (assignedStudentId || '') !== (studentId || '') && (
              <p className="text-xs text-amber-600 mt-1">
                This lesson will move to the selected student when you save.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Score + Talk % */}
      <div className="card p-6 grid sm:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="form-label">Session Score</label>
            <span className="text-2xl font-bold text-brand-600">{score.toFixed(1)}<span className="text-sm text-muted font-normal">/10</span></span>
          </div>
          <input
            type="range" min={0} max={10} step={0.1}
            value={score}
            onChange={e => setScore(parseFloat(e.target.value))}
            className="w-full accent-brand-600"
          />
          <div className="flex justify-between text-xs text-muted mt-1">
            <span>0</span><span>5</span><span>10</span>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="form-label">Student Talk Time</label>
            <span className="text-2xl font-bold text-purple-600">{talkPct}<span className="text-sm text-muted font-normal">%</span></span>
          </div>
          <input
            type="range" min={0} max={100} step={1}
            value={talkPct}
            onChange={e => setTalkPct(parseInt(e.target.value))}
            className="w-full accent-purple-600"
          />
          <div className="flex justify-between text-xs text-muted mt-1">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
      </div>

      {/* Grammar Density + Confidence Label */}
      <div className="card p-6 grid sm:grid-cols-2 gap-6">
        <div>
          <label className="form-label">Grammar Density</label>
          <select
            className="input w-full"
            value={grammarDensity}
            onChange={e => setGrammarDensity(e.target.value)}
          >
            <option value="">— Select —</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="Medium-High">Medium-High</option>
            <option value="High">High</option>
          </select>
        </div>
        <div>
          <label className="form-label">Confidence Label</label>
          <select
            className="input w-full"
            value={confidenceLabel}
            onChange={e => setConfidenceLabel(e.target.value)}
          >
            <option value="">— Select —</option>
            <option value="Developing">Developing</option>
            <option value="Building">Building</option>
            <option value="Strong Foundation">Strong Foundation</option>
            <option value="Confident">Confident</option>
            <option value="Fluent">Fluent</option>
          </select>
        </div>
      </div>

      {/* Teacher's Note (student-visible) */}
      <div className="card p-6">
        <label className="form-label">Teacher's Note <span className="text-gray-400 font-normal normal-case">(personal message shown to student at the bottom)</span></label>
        <textarea
          className="textarea min-h-[80px]"
          placeholder="Great work today! You came prepared…"
          value={teacherNote}
          onChange={e => setTeacherNote(e.target.value)}
        />
      </div>

      {/* ── Lesson Sections ────────────────────────────────────────────────── */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-title">📚 Lesson Sections</h3>
          <button onClick={addSection} className="btn-secondary text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Section
          </button>
        </div>

        {sections.length > 0 ? (
          <div className="space-y-3">
            {sections.sort((a, b) => a.sort_order - b.sort_order).map(s => {
              const isPreviewing = previewSections.has(s.id)
              return (
                <div key={s.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <input
                      className="flex-1 text-sm font-semibold text-ink bg-transparent border-none outline-none"
                      value={s.title}
                      onChange={e => updateSection(s.id, 'title', e.target.value)}
                      onBlur={() => saveSection(s.id)}
                    />
                    <button
                      onClick={() => setPreviewSections(prev => {
                        const next = new Set(prev)
                        isPreviewing ? next.delete(s.id) : next.add(s.id)
                        return next
                      })}
                      className={cn('transition-colors shrink-0', isPreviewing ? 'text-brand-500 hover:text-brand-700' : 'text-gray-300 hover:text-brand-500')}
                      title={isPreviewing ? 'Switch to edit' : 'Preview'}
                    >
                      {isPreviewing ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => deleteSection(s.id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {isPreviewing ? (
                    <div className="px-4 py-3 min-h-[80px]">
                      <SectionContent content={s.content} />
                    </div>
                  ) : (
                    <textarea
                      className="w-full px-4 py-3 text-xs text-ink/80 resize-y min-h-[80px] focus:outline-none focus:bg-indigo-50/30 transition-colors font-mono"
                      value={s.content}
                      onChange={e => updateSection(s.id, 'content', e.target.value)}
                      onBlur={() => saveSection(s.id)}
                      placeholder="Section content…"
                    />
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-6">
            No sections yet — click &quot;Add Section&quot; to create one, or import a transcript to auto-generate them.
          </p>
        )}
      </div>

      {/* Homework */}
      <div className="card p-6">
        <h3 className="section-title mb-4">📝 Homework</h3>
        <div className="space-y-2 mb-4">
          {hwItems.length === 0 && (
            <p className="text-sm text-muted text-center py-4">No homework items yet</p>
          )}
          {hwItems.map(hw => (
            <div key={hw.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
              <button onClick={() => toggleHomework(hw.id)}
                className={cn('shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  hw.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400')}>
                {hw.completed && <CheckCircle className="w-3.5 h-3.5 text-white" />}
              </button>
              <span className={cn('flex-1 text-sm', hw.completed && 'line-through text-muted')}>
                {hw.description}
              </span>
              <button onClick={() => deleteHomework(hw.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Add homework item…"
            value={newHw}
            onChange={e => setNewHw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addHomework()}
          />
          <button onClick={addHomework} className="btn-secondary px-4">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Vocabulary */}
      <div className="card p-6">
        <h3 className="section-title mb-4">📖 Vocabulary</h3>

        {vocabItems.length > 0 && (
          <div className="rounded-xl border border-gray-100 overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted">Word</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted">Reading</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted">Definition</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted hidden lg:table-cell">Example</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted hidden xl:table-cell">Level</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {vocabItems.map(v => (
                  <tr key={v.id} className="border-b border-gray-50">
                    <td className="px-4 py-2">
                      <input className="input py-1 px-2 text-xs" value={v.word}
                        onChange={e => updateVocab(v.id, 'word', e.target.value)}
                        onBlur={() => saveVocab(v.id)} />
                    </td>
                    <td className="px-4 py-2">
                      <input className="input py-1 px-2 text-xs" value={v.reading ?? ''}
                        placeholder="reading"
                        onChange={e => updateVocab(v.id, 'reading', e.target.value)}
                        onBlur={() => saveVocab(v.id)} />
                    </td>
                    <td className="px-4 py-2">
                      <input className="input py-1 px-2 text-xs" value={v.definition}
                        onChange={e => updateVocab(v.id, 'definition', e.target.value)}
                        onBlur={() => saveVocab(v.id)} />
                    </td>
                    <td className="px-4 py-2 hidden lg:table-cell">
                      <input className="input py-1 px-2 text-xs" value={v.example_sentence ?? ''}
                        placeholder="optional"
                        onChange={e => updateVocab(v.id, 'example_sentence', e.target.value)}
                        onBlur={() => saveVocab(v.id)} />
                    </td>
                    <td className="px-4 py-2 hidden xl:table-cell">
                      <select className="input py-1 px-2 text-xs" value={v.jlpt_level ?? ''}
                        onChange={e => updateVocab(v.id, 'jlpt_level', e.target.value)}
                        onBlur={() => saveVocab(v.id)}>
                        <option value="">—</option>
                        {JLPT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <button onClick={() => deleteVocab(v.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add new vocab row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
          <input className="input text-sm" placeholder="Word *" value={newVocab.word}
            onChange={e => setNewVocab(v => ({ ...v, word: e.target.value }))} />
          <input className="input text-sm" placeholder="Reading" value={newVocab.reading}
            onChange={e => setNewVocab(v => ({ ...v, reading: e.target.value }))} />
          <input className="input text-sm" placeholder="Definition *" value={newVocab.definition}
            onChange={e => setNewVocab(v => ({ ...v, definition: e.target.value }))} />
          <input className="input text-sm" placeholder="Example" value={newVocab.example_sentence}
            onChange={e => setNewVocab(v => ({ ...v, example_sentence: e.target.value }))} />
          <select className="input text-sm" value={newVocab.jlpt_level}
            onChange={e => setNewVocab(v => ({ ...v, jlpt_level: e.target.value }))}>
            <option value="">Level</option>
            {JLPT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <button onClick={addVocab} className="btn-secondary text-sm">
          <Plus className="w-3.5 h-3.5" /> Add Word
        </button>
      </div>

      {/* 📎 File Attachments */}
      <div className="card p-6 space-y-4">
        <h3 className="section-title">📎 Attachments <span className="text-gray-400 font-normal normal-case text-sm">(PDFs, worksheets…)</span></h3>

        {attachments.length > 0 && (
          <ul className="space-y-2">
            {attachments.map(a => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                <a href={a.file_url} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-medium text-brand-700 hover:underline truncate">
                  📄 {a.file_name}
                </a>
                <button
                  type="button"
                  onClick={() => deleteAttachment(a.id, a.file_url)}
                  className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div>
          <label className="form-label">Upload File</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100"
            disabled={uploadingFile}
            onChange={e => { if (e.target.files?.[0]) uploadAttachment(e.target.files[0]) }}
          />
          {uploadingFile && <p className="text-xs text-brand-600 mt-1.5 font-medium">⏳ Uploading…</p>}
          {fileError && <p className="text-xs text-red-500 mt-1.5">{fileError}</p>}
        </div>
      </div>

      {/* 🎙️ Audio Review */}
      <div className="card p-6 space-y-5">
        <h3 className="section-title">🎙️ Audio Review <span className="text-gray-400 font-normal normal-case text-sm">(optional)</span></h3>

        {/* Script — always visible, collapsible */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="form-label mb-0">Reading Script</label>
            <button
              type="button"
              onClick={() => setShowAudioScript(s => !s)}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAudioScript ? 'rotate-180' : ''}`} />
              {showAudioScript ? 'Hide script' : 'Show / edit script'}
            </button>
          </div>
          {showAudioScript && (
            <textarea
              value={audioScript}
              onChange={e => setAudioScript(e.target.value)}
              rows={14}
              placeholder="No script yet — auto-generated on import, or write one here."
              className="textarea w-full text-sm leading-relaxed"
            />
          )}
          {!showAudioScript && (
            <p className="text-xs text-muted">
              {audioScript ? 'Script ready — expand to review or edit before recording.' : 'No script yet — auto-generated on import, or add one manually.'}
            </p>
          )}
        </div>

        {/* Record button */}
        <div className="space-y-3">
          <label className="form-label mb-0">{voiceFileUrl ? 'Re-record' : 'Record your voice'}</label>

          {!isRecording && !uploadingAudio && (
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
              style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white" />
              Start Recording
            </button>
          )}

          {isRecording && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-semibold text-red-600">
                  {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gray-900 text-white hover:bg-gray-700 transition-colors"
              >
                Stop & Save
              </button>
            </div>
          )}

          {uploadingAudio && (
            <p className="text-xs text-brand-600 font-medium">⏳ Saving recording…</p>
          )}
          {audioError && <p className="text-xs text-red-500">{audioError}</p>}
        </div>

        {/* Current recording */}
        {voiceFileUrl && !uploadingAudio && (
          <div>
            <label className="form-label mb-2">Current Recording</label>
            <audio controls className="w-full mb-2" src={voiceFileUrl} />
            <div className="flex items-center gap-4">
              <span className="text-xs text-green-600 font-medium">✓ Saved</span>
              <button type="button" onClick={removeAudio} className="text-xs text-red-400 hover:text-red-600 transition-colors">
                Remove
              </button>
            </div>
          </div>
        )}

        {/* File upload fallback */}
        <div>
          <label className="form-label text-muted mb-1">Or upload a file</label>
          <input
            type="file"
            accept="audio/*"
            className="input text-sm file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100"
            disabled={uploadingAudio || isRecording}
            onChange={e => { if (e.target.files?.[0]) uploadAudio(e.target.files[0]) }}
          />
          <p className="text-xs text-muted mt-1">MP3, M4A, WAV — max 50 MB.</p>
        </div>
      </div>

      {/* 📤 Homework Submissions */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-title">📤 Homework Submissions</h3>
          {hwSubmissions.length > 0 && (
            <span className="badge-brand">{hwSubmissions.length} file{hwSubmissions.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {hwSubmissions.length === 0 ? (
          <p className="text-sm text-muted">No files submitted yet. The student can upload their homework from their lesson recap page.</p>
        ) : (
          <div className="space-y-2">
            {hwSubmissions.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-base">📎</span>
                <a
                  href={s.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-brand-700 hover:underline flex-1 truncate"
                >
                  {s.file_name}
                </a>
                <span className="text-xs text-muted shrink-0">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {hwSubmissions.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <label className="form-label mb-0">
              {feedbackSent ? 'Feedback already sent — update and resend?' : 'Send feedback to student'}
            </label>
            {feedbackSent && (
              <p className="text-xs text-green-600 font-medium">✓ Feedback sent. Write a new message below to send again.</p>
            )}
            <textarea
              className="textarea min-h-[80px]"
              placeholder="Write your feedback on their submitted work…"
              value={hwFeedback}
              onChange={e => setHwFeedback(e.target.value)}
            />
            <div>
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Or send a voice note</p>
              <TeacherFeedbackRecorder
                pathPrefix={`feedback/hw-${lessonId}`}
                existingUrl={(initialHwSubmissions[0] as any)?.feedback_audio_url ?? null}
                onUploaded={(audioUrl) => { setHomeworkFeedbackAudio(lessonId, audioUrl) }}
              />
            </div>
            {feedbackError && <p className="text-xs text-red-500">{feedbackError}</p>}
            <button
              type="button"
              onClick={sendFeedback}
              disabled={sendingFeedback || !hwFeedback.trim() || !assignedStudentId}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingFeedback ? 'Sending…' : '✉️ Send Feedback'}
            </button>
            {!assignedStudentId && (
              <p className="text-xs text-amber-600">Assign a student to this lesson before sending feedback.</p>
            )}
          </div>
        )}
      </div>

      {/* 🎙️ Student Practice Recordings */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-title">🎙️ Student Practice Recordings</h3>
          {audioSubmissions.length > 0 && (
            <span className="badge-brand">{audioSubmissions.length} recording{audioSubmissions.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {audioSubmissions.length === 0 ? (
          <p className="text-sm text-muted">No recordings yet. The student can submit voice recordings from their lesson recap page.</p>
        ) : (
          <div className="space-y-2">
            {audioSubmissions.map((s: any) => (
              <div key={s.id} className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                <div className="flex items-center gap-3">
                  <span className="text-base">🎙️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted mb-1 flex items-center gap-2">
                      {new Date(s.created_at).toLocaleDateString()}
                      {s.exercise_id && (
                        <span className="text-[10px] font-bold text-brand-600 bg-white border border-indigo-100 rounded-full px-2 py-0.5">🎯 exercise</span>
                      )}
                    </p>
                    <audio controls src={s.audio_url} className="w-full h-8" style={{ minWidth: 0 }} />
                  </div>
                </div>
                <AudioFeedback submissionId={s.id} initialFeedback={s.teacher_feedback} initialFeedbackAudioUrl={s.feedback_audio_url} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Teacher Notes (private) */}
      <div className="card p-6">
        <label className="form-label">Teacher Notes <span className="text-gray-400 font-normal normal-case">(private — not shown to student)</span></label>
        <textarea
          className="textarea min-h-[80px]"
          placeholder="Private notes about this lesson…"
          value={teacherNotes}
          onChange={e => setTeacherNotes(e.target.value)}
        />
      </div>

      {/* Raw transcript (collapsible) */}
      {rawTranscript && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full px-6 py-4 flex items-center justify-between text-sm font-medium text-muted hover:bg-gray-50 transition-colors"
          >
            <span>📄 Raw Transcript</span>
            {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showTranscript && (
            <div className="px-6 pb-6">
              <pre className="text-xs text-muted bg-gray-50 rounded-xl p-4 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                {rawTranscript}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 pb-8 flex-wrap">
        <button onClick={handleSave} disabled={saving} className="btn-secondary">
          <Save className="w-4 h-4" />
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Draft'}
        </button>
        {status === 'draft' && (
          <button
            onClick={handlePublish}
            disabled={publishing || !assignedStudentId}
            title={!assignedStudentId ? 'Assign a student first' : undefined}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Eye className="w-4 h-4" />
            {publishing ? 'Publishing…' : 'Publish to Student'}
          </button>
        )}
        {status === 'published' && (
          <span className="badge-green px-3 py-2">✓ Published</span>
        )}

        {/* Delete lesson */}
        <div className="ml-auto">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete lesson
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="text-xs text-red-700 font-medium">Delete this lesson permanently?</span>
              <button
                onClick={() => startDeleteTransition(async () => {
                  const res = await deleteLesson(lessonId)
                  if (res.success) {
                    router.push(studentId ? `/teacher/students/${studentId}` : '/teacher/dashboard')
                  } else {
                    setDeleteError(res.error ?? 'Delete failed')
                    setConfirmDelete(false)
                  }
                })}
                disabled={isDeleting}
                className="text-xs px-2 py-0.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setConfirmDelete(false)} disabled={isDeleting} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
              {deleteError && <span className="text-xs text-red-500">{deleteError}</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
