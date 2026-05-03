import { useRef, useState } from 'react'
import { Piano } from './PianoKeyboard'
import { ChordChart } from './ChordChart'
import { KeySignatureTable } from './KeySignatureTable'
import { Scratchpad } from './Scratchpad'
import { AudioPlayer } from './AudioPlayer'
import { playChord, playNote } from './piano'
import {
  LETTERS,
  LETTER_SEMITONES,
  SHARP_PITCH_CLASSES,
  type Letter,
} from './notes'
import {
  scaleChords,
  relativeMinorRoot,
  type Mode,
  type NoteName,
} from './chords'
import './App.css'

const HIGHLIGHT_MS = 850
const SCRATCHPAD_HIGHLIGHT_OCTAVES = [4]

function letterToNote(
  letter: string,
  state: 'natural' | 'accidental',
  accidental: 'flat' | 'sharp',
  baseOctave: number,
): string {
  const base = LETTER_SEMITONES[letter]
  let semitone = base
  let octaveOffset = 0
  if (state === 'accidental') {
    const delta = accidental === 'sharp' ? 1 : -1
    semitone = base + delta
    if (semitone >= 12) { semitone -= 12; octaveOffset = 1 }
    else if (semitone < 0) { semitone += 12; octaveOffset = -1 }
  }
  return `${SHARP_PITCH_CLASSES[semitone]}${baseOctave + octaveOffset}`
}

function buildScratchpadHighlights(
  letterStates: Map<string, 'natural' | 'accidental'>,
  accidental: 'flat' | 'sharp',
): Set<string> {
  const result = new Set<string>()
  for (const letter of LETTERS) {
    const state = letterStates.get(letter)
    if (!state) continue
    for (const oct of SCRATCHPAD_HIGHLIGHT_OCTAVES) {
      result.add(letterToNote(letter, state, accidental, oct))
    }
  }
  return result
}

function App() {
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set())
  const [pressId, setPressId] = useState(0)
  const [scratchpadActiveNotes, setScratchpadActiveNotes] = useState<Set<string>>(new Set())
  const [scratchpadPressId, setScratchpadPressId] = useState(0)
  const [accidental, setAccidental] = useState<'flat' | 'sharp'>('sharp')
  const [letterStates, setLetterStates] = useState<Map<Letter, 'natural' | 'accidental'>>(new Map())
  const [keyName, setKeyName] = useState<NoteName>('C')
  const [mode, setMode] = useState<Mode>('major')
  const timerRef = useRef<number | null>(null)
  const scratchpadTimerRef = useRef<number | null>(null)

  const scratchpadHighlights = buildScratchpadHighlights(letterStates, accidental)
  const chordKey = mode === 'minor' ? relativeMinorRoot(keyName) : keyName
  const chords = scaleChords(chordKey, mode)

  const handleChordPlay = (notes: string[]) => {
    playChord(notes)
    setActiveNotes(new Set(notes))
    setPressId((id) => id + 1)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setActiveNotes(new Set())
    }, HIGHLIGHT_MS)
  }

  const handleScratchpadLetterPlay = (letter: string, state: 'natural' | 'accidental') => {
    const note = letterToNote(letter, state, accidental, SCRATCHPAD_HIGHLIGHT_OCTAVES[0])
    playNote(note)
    setScratchpadActiveNotes(new Set([note]))
    setScratchpadPressId((id) => id + 1)
    if (scratchpadTimerRef.current) window.clearTimeout(scratchpadTimerRef.current)
    scratchpadTimerRef.current = window.setTimeout(() => {
      setScratchpadActiveNotes(new Set())
    }, HIGHLIGHT_MS)
  }

  return (
    <section id="piano-demo">
      <h1>Find the Four Mystery Chords</h1>
      <AudioPlayer variant="instrumental" />
      <AudioPlayer variant="with-vocals" />
      <AudioPlayer
        variant="chord-scratchpad"
        accidental={accidental}
        chordOptions={chords}
      />
      <h2>With Only a Simple Piano</h2>
      <Piano
        playableOctaves={[4]}
        extraPlayableNotes={['B3', 'C5']}
        activeNotes={scratchpadActiveNotes}
        pressId={scratchpadPressId}
        accidental={accidental}
        softHighlights={scratchpadHighlights}
      />
      <div className="accidental-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={accidental === 'flat'}
          className={`accidental-btn flat${accidental === 'flat' ? ' active' : ''}`}
          onClick={() => setAccidental('flat')}
        >
          Flat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={accidental === 'sharp'}
          className={`accidental-btn sharp${accidental === 'sharp' ? ' active' : ''}`}
          onClick={() => setAccidental('sharp')}
        >
          Sharp
        </button>
      </div>
      <Scratchpad
        accidental={accidental}
        letterStates={letterStates}
        onLetterStatesChange={(next) => setLetterStates(next as Map<Letter, 'natural' | 'accidental'>)}
        onLetterPlay={handleScratchpadLetterPlay}
      />
      <KeySignatureTable selected={accidental} />
      <ChordChart
        onChordPlay={handleChordPlay}
        accidental={accidental}
        keyName={keyName}
        mode={mode}
        chords={chords}
        onKeyChange={setKeyName}
        onModeChange={setMode}
      />
      <Piano
        activeNotes={activeNotes}
        pressId={pressId}
        accidental={accidental}
      />
    </section>
  )
}

export default App
