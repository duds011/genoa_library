import { redirect } from 'next/navigation'

// The dashboard already shows all lessons — redirect there
export default function LessonsPage() {
  redirect('/student/dashboard')
}
