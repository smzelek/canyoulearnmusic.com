export const NOTE_NAMES = [
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
] as const

export type NoteName = (typeof NOTE_NAMES)[number]

export type Mode = 'major' | 'minor'
export type ChordQuality = 'maj' | 'min' | 'dim'

export type ScaleDegree = {
  interval: number
  quality: ChordQuality
  roman: string
  label: string
}

export const MAJOR_SCALE_DEGREES: readonly ScaleDegree[] = [
  { interval: 0, quality: 'maj', roman: 'I', label: 'Major' },
  { interval: 2, quality: 'min', roman: 'ii', label: 'minor' },
  { interval: 4, quality: 'min', roman: 'iii', label: 'minor' },
  { interval: 5, quality: 'maj', roman: 'IV', label: 'Major' },
  { interval: 7, quality: 'maj', roman: 'V', label: 'Major' },
  { interval: 9, quality: 'min', roman: 'vi', label: 'minor' },
  { interval: 11, quality: 'dim', roman: 'vii°', label: 'diminished' },
]

export const MINOR_SCALE_DEGREES: readonly ScaleDegree[] = [
  { interval: 0, quality: 'min', roman: 'i', label: 'minor' },
  { interval: 2, quality: 'dim', roman: 'ii°', label: 'diminished' },
  { interval: 3, quality: 'maj', roman: 'III', label: 'Major' },
  { interval: 5, quality: 'min', roman: 'iv', label: 'minor' },
  { interval: 7, quality: 'min', roman: 'v', label: 'minor' },
  { interval: 8, quality: 'maj', roman: 'VI', label: 'Major' },
  { interval: 10, quality: 'maj', roman: 'VII', label: 'Major' },
]

export const TRIAD_INTERVALS: Record<ChordQuality, readonly [number, number, number]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
}

export const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dim: '°',
}

const HIGH_KEYS: ReadonlySet<NoteName> = new Set([
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
])

function midiOf(name: NoteName, octave: number) {
  return (octave + 1) * 12 + NOTE_NAMES.indexOf(name)
}

function midiToNote(m: number) {
  const octave = Math.floor(m / 12) - 1
  return `${NOTE_NAMES[m % 12]}${octave}`
}

export type ScaleChord = {
  name: string
  notes: string[]
  interval: number
  quality: ChordQuality
  roman: string
  label: string
}

export function chordForDegree(keyName: NoteName, degree: ScaleDegree): ScaleChord {
  const rootOctave = HIGH_KEYS.has(keyName) ? 3 : 4
  const keyMidi = midiOf(keyName, rootOctave)
  const chordRootMidi = keyMidi + degree.interval
  const triad = TRIAD_INTERVALS[degree.quality]
  const notes = triad.map((iv) => midiToNote(chordRootMidi + iv))
  const rootName = NOTE_NAMES[chordRootMidi % 12]
  const name = rootName + QUALITY_SUFFIX[degree.quality]
  return { name, notes, ...degree }
}

export function scaleChords(keyName: NoteName, mode: Mode): ScaleChord[] {
  const degrees = mode === 'major' ? MAJOR_SCALE_DEGREES : MINOR_SCALE_DEGREES
  return degrees.map((d) => chordForDegree(keyName, d))
}

export function relativeMinorRoot(keyName: NoteName): NoteName {
  return NOTE_NAMES[(NOTE_NAMES.indexOf(keyName) + 9) % 12]
}
