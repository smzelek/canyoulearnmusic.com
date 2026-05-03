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

const REQUIRED_LETTER_STATES: Record<string, 'natural' | 'accidental'> = {
  F: 'accidental',
  C: 'accidental',
  G: 'accidental',
  D: 'natural',
  A: 'natural',
  E: 'natural',
  B: 'natural',
}

const REQUIRED_CHORD_NAMES = ['A', 'C#m', 'F#m', 'D']

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
  const [showWrongs, setShowWrongs] = useState(false)
  const timerRef = useRef<number | null>(null)
  const scratchpadTimerRef = useRef<number | null>(null)

  const scratchpadHighlights = buildScratchpadHighlights(letterStates, accidental)
  const chordKey = mode === 'minor' ? relativeMinorRoot(keyName) : keyName
  const chords = scaleChords(chordKey, mode)

  const wrongLetters = showWrongs
    ? new Set(LETTERS.filter((l) => letterStates.get(l) !== REQUIRED_LETTER_STATES[l]))
    : new Set<string>()
  const wrongAccidental = showWrongs && accidental !== 'sharp'
  const wrongKeyName = showWrongs && keyName !== 'A'
  const wrongMode = showWrongs && mode !== 'major'
  const wrongChordSlots = showWrongs
    ? new Set(
      chosenChords
        .map((c, i) =>
          c === null || chords[c]?.name !== REQUIRED_CHORD_NAMES[i] ? i : -1,
        )
        .filter((i) => i >= 0),
    )
    : new Set<number>()

  const highlightChord = (notes: string[]) => {
    setActiveNotes(new Set(notes))
    setPressId((id) => id + 1)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setActiveNotes(new Set())
    }, HIGHLIGHT_MS)
  }

  const handleChordPlay = (notes: string[]) => {
    playChord(notes)
    highlightChord(notes)
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

  const renderAccidentalToggle = (wrongActive: boolean) => (
    <div className="accidental-toggle" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={accidental === 'flat'}
        className={`accidental-btn flat${accidental === 'flat' ? ' active' : ''}${wrongActive && accidental === 'flat' ? ' is-wrong' : ''}`}
        onClick={() => setAccidental('flat')}
      >
        Flat
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={accidental === 'sharp'}
        className={`accidental-btn sharp${accidental === 'sharp' ? ' active' : ''}${wrongActive && accidental === 'sharp' ? ' is-wrong' : ''}`}
        onClick={() => setAccidental('sharp')}
      >
        Sharp
      </button>
    </div>
  )

  const renderScratchpad = (wrong: Set<string>) => (
    <Scratchpad
      accidental={accidental}
      letterStates={letterStates}
      onLetterStatesChange={(next) => setLetterStates(next as Map<Letter, 'natural' | 'accidental'>)}
      onLetterPlay={handleScratchpadLetterPlay}
      wrongLetters={wrong}
    />
  )

  const slides: { content: React.ReactNode; canAdvance?: boolean }[] = [
    {
      content: (
        <div className="slide-stack">
          <h1>Who here would call themselves a musician?</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Wrong!</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>You are all musicians.</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Clearly some of you disagree.</h1>
          <h1 style={{ marginTop: "80px" }}>Who here is confident they are NOT a musician?</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Why do you think you're not a musician?</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Let me ask you a few questions.</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Do you know how to play piano?</h1>
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
          <h1>Do you know what the Four Mystery Chords are in this song?</h1>
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
          <h1>
            Today you are gonna figure out how to play that song - from scratch.
          </h1>
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
          <h1>"But Steve", you say,</h1>
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
          <h1>
            If you can find the Four Mystery Chords to play that song -
          </h1>
          <h1>
             from scratch -
          </h1>
          <h1>
            would you be convinced that you might be a musician?
          </h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>
            Lets get started.
          </h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>
            Using just a piano, you can find the <strong>Key Signature</strong> of the song.
          </h1>
          <Piano
            playableOctaves={[4]}
            extraPlayableNotes={['B3', 'C5']}
            activeNotes={scratchpadActiveNotes}
            pressId={scratchpadPressId}
            accidental={accidental}
            softHighlights={scratchpadHighlights}
          />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>"But Steve", you say, "I don't know what a Key Signature is!"</h1>
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
          <h2>Music 101: Consonance and Dissonance</h2>
          <Piano
            playableOctaves={[4]}
            extraPlayableNotes={['B3', 'C5']}
            activeNotes={scratchpadActiveNotes}
            pressId={scratchpadPressId}
            accidental={accidental}
            softHighlights={scratchpadHighlights}
          />
          <AudioPlayer variant="instrumental" />
          <div className="freebie-stack">
            {renderAccidentalToggle(wrongAccidental)}
            <p className="help-text">
              Freebie #1: we'll use Sharps for this song, not Flats.
            </p>
          </div>
          {renderScratchpad(wrongLetters)}
          <p className="help-text">
            Hint: The {accidental === 'sharp' ? 'Sharps' : 'Flats'} are in order. The first time you see a note that isn't {accidental === 'sharp' ? 'Sharp' : 'Flat'}, nothing to the right of it will be {accidental === 'sharp' ? 'Sharp' : 'Flat'} either.
          </p>
        </div>
      ),
      canAdvance:
        accidental === 'sharp' &&
        LETTERS.every((l) => letterStates.get(l) === REQUIRED_LETTER_STATES[l]),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Did you know you could do that?</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Now you have everything you need to figure out what Key the song is in.</h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h2>Music 102: Keys</h2>
          {renderScratchpad(new Set())}
          <p className="help-text">
            Match the sharps you found to the Key.
          </p>
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
            wrongKey={wrongKeyName}
            wrongMode={wrongMode}
          />
        </div>
      ),
      canAdvance: keyName === 'A' && mode === 'major',
    },
    {
      content: (
        <div className="slide-stack">
          <h1>
            That's right, the song is in the Key of {formatNote(chordKey, accidental)}{' '}
            {mode === 'major' ? 'Major' : 'minor'}!
          </h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>
            Did you think you could figure out what Key a song
            is in?
          </h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>
            Chords in the Key of {formatNote(chordKey, accidental)}{' '}
            {mode === 'major' ? 'Major' : 'minor'}:
          </h1>
          <ChordGrid
            chords={chords}
            accidental={accidental}
            onChordPlay={handleChordPlay}
          />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>
            Do you think you could learn to put your fingers into these piano positions?
          </h1>
          <Piano activeNotes={activeNotes} pressId={pressId} accidental={accidental} />
          <ChordGrid
            chords={chords}
            accidental={accidental}
            onChordPlay={handleChordPlay}
          />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>
            Okay, so theoretically, that means you could play this song.
          </h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>
            The song had Four Mystery Chords.
          </h1>
          <h1 style={{ marginTop: "50px" }}>
            A Major gives you just 7 possible chords to choose from.
          </h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h2>
            Music 103: Chords
          </h2>
          <p className="help-text">
            Don't get fooled by Harmonies!
          </p>
          <Piano activeNotes={activeNotes} pressId={pressId} accidental={accidental} />
          <AudioPlayer
            variant="chord-scratchpad"
            accidental={accidental}
            chordOptions={chords}
            chosenChords={chosenChords}
            onChosenChordsChange={setChosenChords}
            wrongChordSlots={wrongChordSlots}
            onNotesActive={highlightChord}
          />
        </div>
      ),
      canAdvance: chosenChords.every(
        (c, i) => c !== null && chords[c]?.name === REQUIRED_CHORD_NAMES[i],
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>
            You found all Four Mystery Chords.
          </h1>
          <h1 style={{ marginTop: "50px" }}>
            Using just your ears and a piano!
          </h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>
            Did you think you could do that when we started?
          </h1>
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Try playing along with the song.</h1>
          <p className="help-text">
            Click the chords to play them on the piano.
          </p>
          <Piano activeNotes={activeNotes} pressId={pressId} accidental={accidental} />
          <AudioPlayer
            variant="instrumental"
            accidental={accidental}
            chordOptions={chords}
            chosenChords={chosenChords}
            onNotesActive={highlightChord}
          />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>Showtime!</h1>
          <Piano activeNotes={activeNotes} pressId={pressId} accidental={accidental} />
          <AudioPlayer
            variant="with-vocals"
            accidental={accidental}
            chordOptions={chords}
            chosenChords={chosenChords}
            onNotesActive={highlightChord}
          />
        </div>
      ),
    },
    {
      content: (
        <div className="slide-stack">
          <h1>I rest my case. You are all musicians. Thank you.</h1>
        </div>
      ),
    },
  ]

  const totalSlides = slides.length
  const canAdvance = slides[currentSlide].canAdvance ?? true
  const presRef = useRef<HTMLElement>(null)

  const wrongsTimerRef = useRef<number | null>(null)

  const denyAdvance = () => {
    setShowWrongs(true)
    if (wrongsTimerRef.current) window.clearTimeout(wrongsTimerRef.current)
    wrongsTimerRef.current = window.setTimeout(() => setShowWrongs(false), 2000)
    const el = presRef.current
    if (!el) return
    el.classList.remove('deny')
    void el.offsetWidth
    el.classList.add('deny')
    window.setTimeout(() => el.classList.remove('deny'), 450)
  }

  const goToSlide = (next: number) => {
    if (wrongsTimerRef.current) {
      window.clearTimeout(wrongsTimerRef.current)
      wrongsTimerRef.current = null
    }
    setShowWrongs(false)
    setCurrentSlide(next)
  }

  const tryAdvance = () => {
    if (currentSlide === totalSlides - 1) return
    if (!canAdvance) {
      denyAdvance()
      return
    }
    goToSlide(Math.min(currentSlide + 1, totalSlides - 1))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        tryAdvance()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goToSlide(Math.max(currentSlide - 1, 0))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSlides, canAdvance, currentSlide])

  return (
    <main className="presentation" ref={presRef}>
      <div className="slide" key={currentSlide}>
        {slides[currentSlide].content}
      </div>
      <nav className="slide-nav">
        <button
          type="button"
          className="slide-nav-btn"
          onClick={() => goToSlide(Math.max(currentSlide - 1, 0))}
          disabled={currentSlide === 0}
          aria-label="Previous slide"
        >
          ‹
        </button>
        <span className="slide-counter">{currentSlide + 1} / {totalSlides}</span>
        <button
          type="button"
          className="slide-nav-btn"
          onClick={tryAdvance}
          disabled={currentSlide === totalSlides - 1}
          aria-disabled={!canAdvance}
          aria-label="Next slide"
        >
          ›
        </button>
      </nav>
    </main>
  )
}

export default App
