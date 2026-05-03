import { useEffect, useRef, useState } from 'react'
import { Piano } from './PianoKeyboard'
import { ChordGrid } from './ChordGrid'
import { KeyPicker } from './KeyPicker'
import { formatNote } from './notes'
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
  const [chosenChords, setChosenChords] = useState<(number | null)[]>([null, null, null, null])
  const [currentSlide, setCurrentSlide] = useState(0)
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

  const accidentalToggle = (
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
  )

  const scratchpad = (
    <Scratchpad
      accidental={accidental}
      letterStates={letterStates}
      onLetterStatesChange={(next) => setLetterStates(next as Map<Letter, 'natural' | 'accidental'>)}
      onLetterPlay={handleScratchpadLetterPlay}
    />
  )

  const slides: { title?: string; content: React.ReactNode }[] = [
    {
      content: (
        <div className="slide-title">
          <h1>Who here would call themselves a musician?</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-title">
          <h1>Wrong!</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-title">
          <h1>You are all musicians.</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Do you know how to play the piano?</h1>
          <Piano playableOctaves={[3, 4, 5]} accidental={accidental} />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Doesn't matter!</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Do you know how to play this song?</h1>
          <AudioPlayer variant="instrumental" />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Doesn't matter!</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Today you are going to figure out -</h1>
          <h2><i>from scratch</i></h2>
          <h1>- how to play this song.</h1>
          <AudioPlayer variant="instrumental" />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>"But Steve", you ask, "How am I gonna do that?"</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>By playing the piano.</h1>
          <Piano playableOctaves={[3, 4, 5]} accidental={accidental} />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>"But Steve", you say, </h1>
          <h1>"I already told you I don't know</h1>
          <h1>how to play the piano!"</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Doesn't matter!</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Welcome to Music 101</h1>
          <AudioPlayer variant="instrumental" />
          <p className="help-text">
            With only a simple piano, we can find the <strong>Key Signature</strong> of the song.
          </p>
          <Piano
            playableOctaves={[4]}
            extraPlayableNotes={['B3', 'C5']}
            activeNotes={scratchpadActiveNotes}
            pressId={scratchpadPressId}
            accidental={accidental}
            softHighlights={scratchpadHighlights}
          />
          <div className="freebie-stack">
            <p className="help-text">
              Freebie #1: we'll use {accidental === 'sharp' ? 'Sharps' : 'Flats'} for this song, not {accidental === 'sharp' ? 'Flats' : 'Sharps'}.
            </p>
            {accidentalToggle}
          </div>
          {scratchpad}
          <p className="help-text">
            Hint: The {accidental === 'sharp' ? 'Sharps' : 'Flats'} are in order. The first time you see a note that isn't {accidental === 'sharp' ? 'Sharp' : 'Flat'}, nothing to the right of it will be {accidental === 'sharp' ? 'Sharp' : 'Flat'} either.
          </p>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>So what key is the song in?</h1>
          {scratchpad}
          <KeySignatureTable selected={accidental} />
          <p className="help-text">
            Freebie #2: This song is Major, not Minor.
          </p>
          <KeyPicker
            keyName={keyName}
            mode={mode}
            accidental={accidental}
            onKeyChange={setKeyName}
            onModeChange={setMode}
          />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>
            The song is in the key of {formatNote(chordKey, accidental)}{' '}
            {mode === 'major' ? 'Major' : 'minor'}!
          </h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>
            Chords in {formatNote(chordKey, accidental)}{' '}
            {mode === 'major' ? 'Major' : 'minor'}:
          </h1>
          <ChordGrid
            chords={chords}
            accidental={accidental}
            onChordPlay={handleChordPlay}
          />
          <p className="help-text">
            Try clicking the chords to see them on the piano.
          </p>
          <Piano activeNotes={activeNotes} pressId={pressId} accidental={accidental} />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Welcome to Music 102</h1>
          <p className="help-text">
            Now that we know the Key and the chords we can choose from,
          </p>
          <p className="help-text">
            lets figure out what those Four Mystery Chords are.
          </p>
          <AudioPlayer
            variant="chord-scratchpad"
            accidental={accidental}
            chordOptions={chords}
            chosenChords={chosenChords}
            onChosenChordsChange={setChosenChords}
          />
          <Piano activeNotes={activeNotes} pressId={pressId} accidental={accidental} />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>You figured out the Four Mystery Chords!</h1>
          <AudioPlayer
            variant="vocals-no-lyrics"
            accidental={accidental}
            chordOptions={chords}
            chosenChords={chosenChords}
          />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Time for your big performance!</h1>
          <p className="help-text">
            Click the chords you found to play along with the song!
          </p>
          <AudioPlayer
            variant="with-vocals"
            accidental={accidental}
            chordOptions={chords}
            chosenChords={chosenChords}
          />
        </div>
      ),
    },
  ]

  const totalSlides = slides.length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentSlide((s) => Math.max(s - 1, 0))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [totalSlides])

  return (
    <main className="presentation">
      <div className="slide" key={currentSlide}>
        {slides[currentSlide].content}
      </div>
      <nav className="slide-nav">
        <button
          type="button"
          className="slide-nav-btn"
          onClick={() => setCurrentSlide((s) => Math.max(s - 1, 0))}
          disabled={currentSlide === 0}
          aria-label="Previous slide"
        >
          ‹
        </button>
        <span className="slide-counter">{currentSlide + 1} / {totalSlides}</span>
        <button
          type="button"
          className="slide-nav-btn"
          onClick={() => setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1))}
          disabled={currentSlide === totalSlides - 1}
          aria-label="Next slide"
        >
          ›
        </button>
      </nav>
    </main>
  )
}

export default App
