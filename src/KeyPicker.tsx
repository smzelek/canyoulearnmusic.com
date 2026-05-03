import { formatNote, type Accidental } from './notes'
import {
  relativeMinorRoot,
  type Mode,
  type NoteName,
} from './chords'

const SHARP_KEY_OPTIONS: NoteName[] = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']
const FLAT_KEY_OPTIONS: NoteName[] = ['C', 'F', 'A#', 'D#', 'G#', 'C#', 'F#', 'B']

type KeyPickerProps = {
  keyName: NoteName
  mode: Mode
  accidental: Accidental
  onKeyChange: (k: NoteName) => void
  onModeChange: (m: Mode) => void
  wrongKey?: boolean
  wrongMode?: boolean
}

export function KeyPicker({
  keyName,
  mode,
  accidental,
  onKeyChange,
  onModeChange,
  wrongKey = false,
  wrongMode = false,
}: KeyPickerProps) {
  return (
    <div className="key-picker">
      <div className="key-selector">
        <span className="key-label">Key</span>
        {(accidental === 'sharp' ? SHARP_KEY_OPTIONS : FLAT_KEY_OPTIONS).map((k) => (
          <button
            key={k}
            type="button"
            className={`key-btn${k === keyName ? ' active' : ''}${wrongKey && k === keyName ? ' is-wrong' : ''}`}
            onClick={() => onKeyChange(k)}
          >
            {formatNote(k, accidental)}
          </button>
        ))}
      </div>
      <div className="mode-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'major'}
          className={`mode-btn${mode === 'major' ? ' active' : ''}${wrongMode && mode === 'major' ? ' is-wrong' : ''}`}
          onClick={() => onModeChange('major')}
        >
          {formatNote(keyName, accidental)} Major
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'minor'}
          className={`mode-btn${mode === 'minor' ? ' active' : ''}${wrongMode && mode === 'minor' ? ' is-wrong' : ''}`}
          onClick={() => onModeChange('minor')}
        >
          {formatNote(relativeMinorRoot(keyName), accidental)} minor (relative)
        </button>
      </div>
    </div>
  )
}
