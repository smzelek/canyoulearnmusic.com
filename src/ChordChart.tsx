import { formatNote, type Accidental } from './notes'
import {
  NOTE_NAMES,
  relativeMinorRoot,
  type Mode,
  type NoteName,
  type ScaleChord,
} from './chords'
import './ChordChart.css'

type ChordChartProps = {
  onChordPlay: (notes: string[]) => void
  accidental: Accidental
  keyName: NoteName
  mode: Mode
  chords: ScaleChord[]
  onKeyChange: (k: NoteName) => void
  onModeChange: (m: Mode) => void
}

export function ChordChart({
  onChordPlay,
  accidental,
  keyName,
  mode,
  chords,
  onKeyChange,
  onModeChange,
}: ChordChartProps) {
  const relMinor = relativeMinorRoot(keyName)

  return (
    <div className="chord-chart">
      <div className="key-selector">
        <span className="key-label">Key</span>
        {NOTE_NAMES.map((k) => (
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
          {formatNote(relMinor, accidental)} minor
        </button>
      </div>
      <div className="chord-grid">
        {chords.map((c) => {
          const rootDisplay = formatNote(c.name.replace(/[m°]$/, ''), accidental)
          const suffix = c.name.match(/[m°]$/)?.[0] ?? ''
          return (
            <div className="chord-cell" key={c.roman}>
              <div className="chord-header">
                <div className="quality">{c.label}</div>
                <div className="roman">({c.roman})</div>
              </div>
              <button
                type="button"
                className="chord-btn"
                onClick={() => onChordPlay(c.notes)}
              >
                {rootDisplay}
                {suffix}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
