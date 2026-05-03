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
}

export function KeyPicker({
  keyName,
  mode,
  accidental,
  onKeyChange,
  onModeChange,
}: KeyPickerProps) {
  return (
    <div className="key-picker">
      <div className="key-selector">
        <span className="key-label">Key</span>
        {(accidental === 'sharp' ? SHARP_KEY_OPTIONS : FLAT_KEY_OPTIONS).map((k) => (
          <button
            key={k}
            type="button"
            className={`key-btn${k === keyName ? ' active' : ''}`}
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
          className={`mode-btn${mode === 'major' ? ' active' : ''}`}
          onClick={() => onModeChange('major')}
        >
          {formatNote(keyName, accidental)} Major
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'minor'}
          className={`mode-btn${mode === 'minor' ? ' active' : ''}`}
          onClick={() => onModeChange('minor')}
        >
          {formatNote(relativeMinorRoot(keyName), accidental)} minor
        </button>
      </div>
    </div>
  )
}
