import { type Accidental } from './notes'

const SHARP_LETTERS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const
const FLAT_LETTERS = ['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const
import './Scratchpad.css'

type ScratchpadProps = {
  accidental: Accidental
  letterStates: Map<string, 'natural' | 'accidental'>
  onLetterStatesChange: (next: Map<string, 'natural' | 'accidental'>) => void
  onLetterPlay: (letter: string, state: 'natural' | 'accidental') => void
  wrongLetters?: Set<string>
  allowChanging: boolean;
}

export function Scratchpad({
  accidental,
  letterStates,
  onLetterStatesChange,
  onLetterPlay,
  wrongLetters,
  allowChanging
}: ScratchpadProps) {
  const setLetter = (letter: string, state: 'natural' | 'accidental' | null) => {
    if (!allowChanging) {
      return;
    }
    const next = new Map(letterStates)
    if (state === null) next.delete(letter)
    else next.set(letter, state)
    onLetterStatesChange(next)
    if (state !== null) onLetterPlay(letter, state)
  }

  const letters = accidental === 'sharp' ? SHARP_LETTERS : FLAT_LETTERS
  const accLabel = accidental === 'sharp' ? 'Sharp' : 'Flat'
  const notAccLabel = accidental === 'sharp' ? 'Not Sharp' : 'Not Flat'

  return (
    <div className={`scratchpad scratchpad-${accidental}`}>
      <div className="scratchpad-row">
        {letters.map((letter) => {
          const state = letterStates.get(letter) ?? null
          const wrong = wrongLetters?.has(letter) ?? false
          return (
            <div className={`scratch-cell${wrong ? ' is-wrong' : ''}`} key={letter}>
              {allowChanging ? (<button
                type="button"
                className={`scratch-clear${state !== null ? ' visible' : ''}`}
                onClick={() => setLetter(letter, null)}
                aria-label={`Clear ${letter}`}
              >
                ×
              </button>) : null}
              <div className="scratch-letter">{letter}{letterStates.get(letter) === 'accidental' ? (accidental === 'sharp' ? "♯" : "b") : null}</div>
              <div className="scratch-segments">
                <button
                  type="button"
                  className={`scratch-seg scratch-seg-natural${state === 'natural' ? ' active' : ''}`}
                  onClick={() => setLetter(letter, 'natural')}
                  aria-label={`${letter} natural`}
                >
                  {notAccLabel}
                </button>
                <button
                  type="button"
                  className={`scratch-seg scratch-seg-acc${state === 'accidental' ? ' active' : ''}`}
                  onClick={() => setLetter(letter, 'accidental')}
                  aria-label={`${letter} ${accidental}`}
                >
                  {accLabel}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
