import { useEffect, useRef, useState } from 'react'
import { formatNote, type Accidental } from './notes'
import { type ScaleChord } from './chords'
import { playChord } from './piano'
import './AudioPlayer.css'

function trimSilence(ac: AudioContext, buffer: AudioBuffer, threshold = 0.01): AudioBuffer {
  const ch0 = buffer.getChannelData(0)
  let start = 0
  while (start < ch0.length && Math.abs(ch0[start]) < threshold) start++
  let end = ch0.length - 1
  while (end > start && Math.abs(ch0[end]) < threshold) end--
  if (start === 0 && end === ch0.length - 1) return buffer
  const length = end - start + 1
  const trimmed = ac.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    trimmed.getChannelData(ch).set(buffer.getChannelData(ch).subarray(start, end + 1))
  }
  return trimmed
}

const CHORD_COLORS = ['#d65f5f', '#d6a032', '#32a0d6', '#9f32d6'] as const

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const VOCALS_LOOP_STARTS = [0, 11.9, 23.1, 34.2] as const

const VOCALS_VERSE_LINES: string[][] = [
  ["And it's new, the shape of your body", "It's blue, the feeling I've got", "And it's ooh-ooh ooh whoa-oh", "It's a cruel summer"],
  ["It's cool, that's what I tell 'em", "No rules in breakable heaven", "But ooh-ooh ooh whoa-oh", "It's a cruel summer, with you"],
]

const LAST_DISPLAYED_LOOP = VOCALS_VERSE_LINES.length // loop indices 0,1,2 → 2 is last

function getVocalsLoopInfo(globalPos: number, totalDuration: number) {
  let idx = VOCALS_LOOP_STARTS.length - 1
  for (let i = 0; i < VOCALS_LOOP_STARTS.length - 1; i++) {
    if (globalPos < VOCALS_LOOP_STARTS[i + 1]) { idx = i; break }
  }
  if (idx > LAST_DISPLAYED_LOOP) return { idx: LAST_DISPLAYED_LOOP, pct: 1 }
  const loopStart = VOCALS_LOOP_STARTS[idx]
  const loopEnd = VOCALS_LOOP_STARTS[idx + 1] ?? totalDuration
  return { idx, pct: Math.min(1, (globalPos - loopStart) / (loopEnd - loopStart)) }
}

type AudioPlayerProps = {
  variant?: 'instrumental' | 'with-vocals' | 'chord-scratchpad'
  accidental?: Accidental
  chordOptions?: ScaleChord[]
}

export function AudioPlayer({
  variant = 'instrumental',
  accidental = 'sharp',
  chordOptions = [],
}: AudioPlayerProps) {
  const isVocals = variant === 'with-vocals'
  const isScratchpad = variant === 'chord-scratchpad'

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const segmentProgressRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null])
  const playheadRef = useRef<HTMLDivElement>(null)

  const acRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)

  const startTimeRef = useRef(0)
  const globalOffsetRef = useRef(0)
  const loopIndexRef = useRef(0)
  const chordIndexRef = useRef(0)
  const rafRef = useRef<number>(0)
  const activeSegmentRef = useRef<number | null>(null)

  const [playing, setPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loopIndex, setLoopIndex] = useState(0)
  const [chordIndex, setChordIndex] = useState(0)
  const [activeSegment, setActiveSegment] = useState<number | null>(null)
  const [chosenChords, setChosenChords] = useState<(number | null)[]>([null, null, null, null])

  useEffect(() => {
    const ac = new AudioContext()
    acRef.current = ac
    const src = isVocals ? '/instrumental-to-vocal-chorus.mp3' : '/instrumental-chorus-loop.mp3'
    fetch(src)
      .then((r) => r.arrayBuffer())
      .then((buf) => ac.decodeAudioData(buf))
      .then((decoded) => {
        bufferRef.current = isVocals ? decoded : trimSilence(ac, decoded)
        setLoaded(true)
      })
    return () => {
      cancelAnimationFrame(rafRef.current)
      try { sourceRef.current?.stop() } catch { /**/ }
      ac.close()
    }
  }, [])

  const drawWaveform = (canvas: HTMLCanvasElement, buffer: AudioBuffer, loopIdx = 0) => {
    const dpr = window.devicePixelRatio || 1
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    const allData = buffer.getChannelData(0)
    const sampleStart = isVocals
      ? Math.floor(VOCALS_LOOP_STARTS[loopIdx] * buffer.sampleRate)
      : 0
    const sampleEnd = isVocals
      ? Math.floor((VOCALS_LOOP_STARTS[loopIdx + 1] ?? buffer.duration) * buffer.sampleRate)
      : allData.length
    const data = allData.subarray(sampleStart, sampleEnd)
    const mid = h / 2
    const step = data.length / w
    for (let x = 0; x < w; x++) {
      let peak = 0
      const s = Math.floor(x * step)
      const e = Math.min(Math.floor((x + 1) * step), data.length)
      for (let i = s; i < e; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a }
      const half = peak * mid * 0.85
      const chordIdx = Math.min(3, Math.floor((x / w) * 4))
      ctx.fillStyle = hexToRgba(CHORD_COLORS[chordIdx], 0.6)
      ctx.fillRect(x, mid - half, 1, Math.max(1, half * 2))
    }
  }

  useEffect(() => {
    if (!loaded) return
    const canvas = canvasRef.current
    const buffer = bufferRef.current
    if (!canvas || !buffer) return
    drawWaveform(canvas, buffer, loopIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, loopIndex])

  const applyPct = (pct: number, onlySeg?: number | null) => {
    segmentProgressRefs.current.forEach((el, i) => {
      if (!el) return
      if (onlySeg !== undefined) {
        if (onlySeg === null || i !== onlySeg) {
          el.style.width = '0%'
          return
        }
      }
      const fill = Math.max(0, Math.min(pct - i * 0.25, 0.25)) * 100
      el.style.width = `${fill}%`
    })
    if (playheadRef.current) playheadRef.current.style.left = `${pct * 100}%`
  }

  const getCurrentGlobalPos = () => {
    const ac = acRef.current
    if (!ac) return globalOffsetRef.current
    return globalOffsetRef.current + (ac.currentTime - startTimeRef.current)
  }

  const animate = () => {
    const buffer = bufferRef.current
    const ac = acRef.current
    if (buffer && ac) {
      if (isScratchpad) {
        const segIdx = activeSegmentRef.current
        if (segIdx !== null) {
          const segDur = buffer.duration / 4
          const segStart = segIdx * segDur
          const elapsed = ac.currentTime - startTimeRef.current
          const posInSeg = ((elapsed % segDur) + segDur) % segDur
          const globalPos = segStart + posInSeg
          const pct = globalPos / buffer.duration
          applyPct(pct, segIdx)
        }
      } else if (isVocals) {
        const globalPos = getCurrentGlobalPos()
        const { idx, pct } = getVocalsLoopInfo(globalPos, buffer.duration)
        applyPct(pct)
        const chordIdx = Math.min(3, Math.floor(pct * 4))
        if (idx !== loopIndexRef.current) { loopIndexRef.current = idx; setLoopIndex(idx) }
        if (chordIdx !== chordIndexRef.current) { chordIndexRef.current = chordIdx; setChordIndex(chordIdx) }
      } else {
        const globalPos = getCurrentGlobalPos()
        const pct = (globalPos % buffer.duration) / buffer.duration
        applyPct(pct)
        const chordIdx = Math.min(3, Math.floor(pct * 4))
        if (chordIdx !== chordIndexRef.current) { chordIndexRef.current = chordIdx; setChordIndex(chordIdx) }
      }
    }
    rafRef.current = requestAnimationFrame(animate)
  }

  const startSource = (offset: number) => {
    const ac = acRef.current
    const buffer = bufferRef.current
    if (!ac || !buffer) return
    if (ac.state === 'suspended') ac.resume()
    const source = ac.createBufferSource()
    source.buffer = buffer
    source.loop = !isVocals
    source.connect(ac.destination)
    source.start(0, offset)
    if (isVocals) {
      source.onended = () => {
        if (sourceRef.current === source) {
          setPlaying(false)
          cancelAnimationFrame(rafRef.current)
          globalOffsetRef.current = 0
          loopIndexRef.current = 0
          chordIndexRef.current = 0
          setLoopIndex(0)
          setChordIndex(0)
          applyPct(0)
        }
      }
    }
    sourceRef.current = source
    startTimeRef.current = ac.currentTime
  }

  const stop = () => {
    try { sourceRef.current?.stop() } catch { /**/ }
    sourceRef.current = null
    cancelAnimationFrame(rafRef.current)
    globalOffsetRef.current = 0
    loopIndexRef.current = 0
    chordIndexRef.current = 0
    activeSegmentRef.current = null
    setLoopIndex(0)
    setChordIndex(0)
    setPlaying(false)
    setActiveSegment(null)
    applyPct(0, isScratchpad ? null : undefined)
  }

  const play = () => {
    startSource(globalOffsetRef.current)
    setPlaying(true)
    rafRef.current = requestAnimationFrame(animate)
  }

  const startFromLoop = (loopIdx: number) => {
    try { sourceRef.current?.stop() } catch { /**/ }
    sourceRef.current = null
    cancelAnimationFrame(rafRef.current)
    const offset = VOCALS_LOOP_STARTS[loopIdx]
    globalOffsetRef.current = offset
    loopIndexRef.current = loopIdx
    chordIndexRef.current = 0
    setLoopIndex(loopIdx)
    setChordIndex(0)
    startSource(offset)
    setPlaying(true)
    rafRef.current = requestAnimationFrame(animate)
  }

  const toggleSegmentLoop = (idx: number) => {
    const ac = acRef.current
    const buffer = bufferRef.current
    if (!ac || !buffer) return
    if (activeSegmentRef.current === idx) {
      stop()
      return
    }
    try { sourceRef.current?.stop() } catch { /**/ }
    sourceRef.current = null
    cancelAnimationFrame(rafRef.current)
    if (ac.state === 'suspended') ac.resume()

    const segDur = buffer.duration / 4
    const segStart = idx * segDur
    const segEnd = (idx + 1) * segDur

    const source = ac.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.loopStart = segStart
    source.loopEnd = segEnd
    source.connect(ac.destination)
    source.start(0, segStart)
    sourceRef.current = source
    startTimeRef.current = ac.currentTime
    activeSegmentRef.current = idx
    setActiveSegment(idx)
    setPlaying(true)
    rafRef.current = requestAnimationFrame(animate)
  }

  const handleChordChoice = (slotIdx: number, chordIdx: number) => {
    const next = [...chosenChords]
    next[slotIdx] = chordIdx
    setChosenChords(next)
    const chord = chordOptions[chordIdx]
    if (chord) playChord(chord.notes)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isScratchpad) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const buffer = bufferRef.current
    if (!buffer) return
    let newOffset: number
    if (isVocals) {
      const loopStart = VOCALS_LOOP_STARTS[loopIndexRef.current]
      const loopEnd = VOCALS_LOOP_STARTS[loopIndexRef.current + 1] ?? buffer.duration
      newOffset = loopStart + pct * (loopEnd - loopStart)
    } else {
      newOffset = pct * buffer.duration
    }
    globalOffsetRef.current = newOffset
    applyPct(pct)
    if (playing) {
      try { sourceRef.current?.stop() } catch { /**/ }
      sourceRef.current = null
      startSource(newOffset)
    }
  }

  const variantClass =
    isVocals ? 'variant-vocals'
    : isScratchpad ? 'variant-scratchpad'
    : 'variant-instrumental'

  return (
    <div className={`audio-player ${variantClass}`}>
      <div className="ap-chord-slots">
        {CHORD_COLORS.map((color, i) => (
          <div className="ap-slot" key={i}>
            {isScratchpad ? (
              <div
                className="ap-chord-toggle"
                role="radiogroup"
                aria-label={`Chord slot ${i + 1}`}
              >
                {chordOptions.map((c, j) => {
                  const root = formatNote(c.name.replace(/[m°]$/, ''), accidental)
                  const suffix = c.name.match(/[m°]$/)?.[0] ?? ''
                  const selected = chosenChords[i] === j
                  return (
                    <button
                      key={j}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`ap-chord-toggle-btn${selected ? ' active' : ''}`}
                      style={selected ? { borderColor: color, color, background: hexToRgba(color, 0.15) } : undefined}
                      onClick={() => handleChordChoice(i, j)}
                    >
                      {root}{suffix}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="ap-slot-circle" style={{ borderColor: color, color }}>?</div>
            )}
          </div>
        ))}
      </div>

      {isVocals ? (
        <div className="ap-loop-btns">
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              type="button"
              className={`ap-loop-btn${loopIndex === idx && playing ? ' active' : ''}`}
              onClick={() => startFromLoop(idx)}
              disabled={!loaded}
              aria-label={`Start loop ${idx + 1}`}
            >
              {idx + 1}
            </button>
          ))}
          <button
            type="button"
            className="ap-loop-btn ap-stop-btn"
            onClick={stop}
            disabled={!loaded || !playing}
            aria-label="Stop"
          >
            ⏹
          </button>
        </div>
      ) : isScratchpad ? null : (
        <button
          type="button"
          className={`ap-play-btn${playing ? ' playing' : ''}`}
          onClick={playing ? stop : play}
          disabled={!loaded}
          aria-label={playing ? 'Stop' : 'Play'}
        >
          {!loaded ? '…' : playing ? '⏹' : '▶'}
        </button>
      )}

      <div className="ap-waveform-wrap" onClick={handleSeek}>
        <canvas ref={canvasRef} className="ap-canvas" />
        {CHORD_COLORS.map((color, i) => (
          <div
            key={i}
            ref={(el) => { segmentProgressRefs.current[i] = el }}
            className="ap-progress-segment"
            style={{ left: `${i * 25}%`, background: hexToRgba(color, 0.2) }}
          />
        ))}
        {[0, 0.25, 0.5, 0.75].map((pct) => (
          <div key={pct} className="ap-marker-line" style={{ left: `${pct * 100}%` }} />
        ))}
        <div ref={playheadRef} className="ap-playhead" />
      </div>

      {isScratchpad && (
        <div className="ap-segment-btns">
          {CHORD_COLORS.map((color, i) => {
            const active = activeSegment === i
            return (
              <button
                key={i}
                type="button"
                className={`ap-segment-btn${active ? ' active' : ''}`}
                style={active ? { borderColor: color, color } : undefined}
                onClick={() => toggleSegmentLoop(i)}
                disabled={!loaded}
                aria-label={active ? `Stop loop ${i + 1}` : `Loop segment ${i + 1}`}
              >
                {active ? '⏹' : '▶'}
              </button>
            )
          })}
        </div>
      )}

      {isVocals && (
        <div className="ap-lyrics">
          <p
            className="ap-lyrics-instrumental"
            style={{ opacity: playing && loopIndex === 0 ? 1 : 0.3, gridColumn: '1 / -1' }}
          >
            [ instrumental ]
          </p>
          {VOCALS_VERSE_LINES.map((verse, verseIdx) =>
            verse.map((line, lineIdx) => {
              const color = CHORD_COLORS[lineIdx]
              const active = playing && loopIndex === verseIdx + 1 && chordIndex === lineIdx
              return (
                <p key={`${verseIdx}-${lineIdx}`} style={{ color, opacity: active ? 1 : 0.3 }}>
                  {line}
                </p>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
