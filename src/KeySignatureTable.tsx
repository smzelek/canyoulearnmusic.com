import './KeySignatureTable.css'

type KeyRow = { major: string; minor: string; count: number }

const FLAT_ACCIDENTALS = ['B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭', 'F♭']
const FLAT_KEYS: KeyRow[] = [
  { major: 'F', minor: 'D', count: 1 },
  { major: 'B♭', minor: 'G', count: 2 },
  { major: 'E♭', minor: 'C', count: 3 },
  { major: 'A♭', minor: 'F', count: 4 },
  { major: 'D♭', minor: 'B♭', count: 5 },
  { major: 'G♭', minor: 'E♭', count: 6 },
  { major: 'C♭', minor: 'A♭', count: 7 },
]

const SHARP_ACCIDENTALS = ['F♯', 'C♯', 'G♯', 'D♯', 'A♯', 'E♯', 'B♯']
const SHARP_KEYS: KeyRow[] = [
  { major: 'G', minor: 'E', count: 1 },
  { major: 'D', minor: 'B', count: 2 },
  { major: 'A', minor: 'F♯', count: 3 },
  { major: 'E', minor: 'C♯', count: 4 },
  { major: 'B', minor: 'G♯', count: 5 },
  { major: 'F♯', minor: 'D♯', count: 6 },
  { major: 'C♯', minor: 'A♯', count: 7 },
]

function HalfTable({
  side,
  accidentals,
  keys,
  selected,
}: {
  side: 'flat' | 'sharp'
  accidentals: string[]
  keys: KeyRow[]
  selected: boolean
}) {
  const title = side === 'flat' ? 'Flat Notes' : 'Sharp Notes'
  return (
    <div className={`sig-half sig-${side}${selected ? ' selected' : ''}`}>
      <h3 className="sig-title">{title}</h3>
      <div className="sig-body">
        <div className="sig-vlabel sig-vlabel-left">Major Keys</div>
        <table className="sig-grid">
          <thead>
            <tr>
              <th aria-hidden="true" />
              {accidentals.map((a) => (
                <th key={a} className="sig-acc">
                  {a}
                </th>
              ))}
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {keys.map((row) => (
              <tr key={row.major}>
                <td className="sig-rowkey">{row.major}</td>
                {accidentals.map((_, i) => (
                  <td key={i} className="sig-cell">
                    <span
                      className={`sig-dot ${i < row.count ? 'sig-dot-filled' : 'sig-dot-empty'}`}
                    />
                  </td>
                ))}
                <td className="sig-rowkey sig-rowkey-minor">{row.minor}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="sig-vlabel sig-vlabel-right sig-minor">Minor Keys</div>
      </div>
    </div>
  )
}

type KeySignatureTableProps = {
  selected: 'flat' | 'sharp'
}

export function KeySignatureTable({ selected }: KeySignatureTableProps) {
  return (
    <div className="signature-tables">
      {selected === 'flat' ? (
        <HalfTable
          side="flat"
          accidentals={FLAT_ACCIDENTALS}
          keys={FLAT_KEYS}
          selected
        />
      ) : (
        <HalfTable
          side="sharp"
          accidentals={SHARP_ACCIDENTALS}
          keys={SHARP_KEYS}
          selected
        />
      )}
    </div>
  )
}
