import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function scoreDelta(current: number, previous?: number): string {
  if (previous === undefined) return '+0.0 since lesson 1'
  const delta = current - previous
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)} since lesson 1`
}

export function getLevelLabel(lessonCount: number): string {
  if (lessonCount < 5) return 'Getting Started'
  if (lessonCount < 10) return 'Beginner'
  if (lessonCount < 25) return 'Elementary'
  if (lessonCount < 50) return 'Intermediate'
  return 'Advanced'
}

export function getLevelEmoji(lessonCount: number): string {
  if (lessonCount < 5) return '🌱'
  if (lessonCount < 10) return '🌸'
  if (lessonCount < 25) return '🌿'
  if (lessonCount < 50) return '⭐'
  return '🏆'
}
