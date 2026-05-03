import type { CSSProperties } from 'react'
import { playNote } from './piano'
import { formatNote, type Accidental } from './notes'
import './PianoKeyboard.css'

const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const BLACK_AFTER: Record<string, string | null> = {
  C: 'C#',
  D: 'D#',
  E: null,
  F: 'F#',
  G: 'G#',
  A: 'A#',
  B: null,
}

type WhiteKey = { note: string; index: number; octave: number }
type BlackKey = { note: string; afterIndex: number; octave: number }

function buildKeys() {
  const whites: WhiteKey[] = []
  const blacks: BlackKey[] = []
  let index = 0
  for (let oct = 3; oct <= 5; oct++) {
    for (const n of WHITE_NOTES) {
      whites.push({ note: `${n}${oct}`, index, octave: oct })
      const black = BLACK_AFTER[n]
      if (black) {
        blacks.push({ note: `${black}${oct}`, afterIndex: index, octave: oct })
      }
      index++
    }
  }
  return { whites, blacks }
}

const { whites, blacks } = buildKeys()

type PianoProps = {
  playableOctaves?: number[]
  extraPlayableNotes?: string[]
  activeNotes?: Set<string>
  pressId?: number
  accidental?: Accidental
  softHighlights?: Set<string>
}

export function Piano({
  playableOctaves,
  extraPlayableNotes,
  activeNotes,
  pressId = 0,
  accidental = 'sharp',
  softHighlights,
}: PianoProps) {
  const interactive = playableOctaves !== undefined
  const isPlayable = (note: string, oct: number) =>
    interactive && (playableOctaves!.includes(oct) || (extraPlayableNotes?.includes(note) ?? false))

  const renderKey = (
    note: string,
    octave: number,
    color: 'white' | 'black',
    style?: CSSProperties,
  ) => {
    const playable = isPlayable(note, octave)
    const muted = interactive && !playable
    const active = activeNotes?.has(note) ?? false
    const soft = softHighlights?.has(note) ?? false
    const cls = [
      'key',
      color,
      muted ? 'muted' : '',
      active ? 'active' : '',
      soft ? 'soft' : '',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <button
        key={`${note}-${active ? pressId : 'idle'}`}
        type="button"
        className={cls}
        disabled={!playable}
        onClick={() => playNote(note)}
        style={style}
      >
        <span className="label">{formatNote(note, accidental)}</span>
      </button>
    )
  }

  return (
    <div
      className={`piano piano-mode-${accidental}`}
      style={{ '--white-count': whites.length } as CSSProperties}
    >
      <div className="piano-keys">
        {whites.map((k) => renderKey(k.note, k.octave, 'white'))}
        {blacks.map((k) =>
          renderKey(k.note, k.octave, 'black', {
            left: `calc(${k.afterIndex + 1} * var(--white-w) - var(--black-w) / 2)`,
          }),
        )}
      </div>
    </div>
  )
}
