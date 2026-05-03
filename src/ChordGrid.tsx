import { formatNote, type Accidental } from './notes'
import { type ScaleChord } from './chords'
import './ChordChart.css'

type ChordGridProps = {
  chords: ScaleChord[]
  accidental: Accidental
  onChordPlay: (notes: string[]) => void
}

export function ChordGrid({ chords, accidental, onChordPlay }: ChordGridProps) {
  return (
    <div className="chord-chart">
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
