export type Accidental = 'sharp' | 'flat'

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type Letter = (typeof LETTERS)[number]

export const LETTER_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

export const SHARP_PITCH_CLASSES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

const SHARP_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
]

const FLAT_NAMES = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
]

export function formatNote(note: string, accidental: Accidental): string {
  const m = note.match(/^([A-G])([#b]?)(-?\d+)?$/)
  if (!m) return note
  const [, letter, acc, oct] = m
  let semitone = LETTER_SEMITONES[letter]
  if (acc === '#') semitone = (semitone + 1) % 12
  else if (acc === 'b') semitone = (semitone + 11) % 12
  const names = accidental === 'sharp' ? SHARP_NAMES : FLAT_NAMES
  return names[semitone] + (oct ?? '')
}
