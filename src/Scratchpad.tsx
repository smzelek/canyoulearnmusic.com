import { type Accidental } from './notes'

const SHARP_LETTERS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const
const FLAT_LETTERS = ['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const
import './Scratchpad.css'

type ScratchpadProps = {
  accidental: Accidental
  letterStates: Map<string, 'natural' | 'accidental'>
  onLetterStatesChange: (next: Map<string, 'natural' | 'accidental'>) => void
  onLetterPlay: (letter: string, state: 'natural' | 'accidental') => void
}

export function Scratchpad({
  accidental,
  letterStates,
  onLetterStatesChange,
  onLetterPlay,
}: ScratchpadProps) {
  const setLetter = (letter: string, state: 'natural' | 'accidental' | null) => {
    const next = new Map(letterStates)
    if (state === null) next.delete(letter)
    else next.set(letter, state)
    onLetterStatesChange(next)
    if (state !== null) onLetterPlay(letter, state)
  }

  const letters = accidental === 'sharp' ? SHARP_LETTERS : FLAT_LETTERS
  const accSymbol = accidental === 'sharp' ? '♯' : '♭'

  return (
    <div className={`scratchpad scratchpad-${accidental}`}>
      <div className="scratchpad-label">
        Scratchpad — guess the notes in your key
      </div>
      <div className="scratchpad-row">
        {letters.map((letter) => {
          const state = letterStates.get(letter) ?? null
          return (
            <div className="scratch-cell" key={letter}>
              <button
                type="button"
                className={`scratch-clear${state !== null ? ' visible' : ''}`}
                onClick={() => setLetter(letter, null)}
                aria-label={`Clear ${letter}`}
              >
                ×
              </button>
              <div className="scratch-letter">{letter}</div>
              <div className="scratch-segments">
                {accidental === 'flat' && (
                  <button
                    type="button"
                    className={`scratch-seg scratch-seg-acc${state === 'accidental' ? ' active' : ''}`}
                    onClick={() => setLetter(letter, 'accidental')}
                    aria-label={`${letter} ${accidental}`}
                  >
                    {accSymbol}
                  </button>
                )}
                <button
                  type="button"
                  className={`scratch-seg scratch-seg-natural${state === 'natural' ? ' active' : ''}`}
                  onClick={() => setLetter(letter, 'natural')}
                  aria-label={`${letter} natural`}
                >
                  ♮
                </button>
                {accidental === 'sharp' && (
                  <button
                    type="button"
                    className={`scratch-seg scratch-seg-acc${state === 'accidental' ? ' active' : ''}`}
                    onClick={() => setLetter(letter, 'accidental')}
                    aria-label={`${letter} ${accidental}`}
                  >
                    {accSymbol}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
