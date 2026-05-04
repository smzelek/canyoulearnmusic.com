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

const CHORD_COLORS = ['#5fc468', '#d6a032', '#32a0d6', '#9f32d6'] as const

function transposeDownOctave(note: string): string {
  const m = note.match(/^([A-G][#b]?)(-?\d+)$/)
  if (!m) return note
  return `${m[1]}${Number(m[2]) - 1}`
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const VOCALS_LOOP_STARTS = [0, 11.9, 23.1, 34.2] as const

const SCRATCHPAD_SLICE_SEC = 0.70
const SCRATCHPAD_SILENCE_SEC = 0.7
const SCRATCHPAD_CYCLE_SEC = SCRATCHPAD_SLICE_SEC + SCRATCHPAD_SILENCE_SEC

function makeConcatBuffer(
  ac: AudioContext,
  src: AudioBuffer,
  sliceSec: number,
): AudioBuffer {
  const fullSegDur = src.duration / 4
  const sliceLen = Math.floor(sliceSec * src.sampleRate)
  const out = ac.createBuffer(src.numberOfChannels, sliceLen * 4, src.sampleRate)
  const fadeInLen = Math.min(Math.floor(0.02 * src.sampleRate), Math.floor(sliceLen / 4))
  const fadeOutLen = Math.min(Math.floor(0.12 * src.sampleRate), Math.floor(sliceLen / 2))
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const data = src.getChannelData(ch)
    const dst = out.getChannelData(ch)
    for (let s = 0; s < 4; s++) {
      const startSample = Math.floor(s * fullSegDur * src.sampleRate)
      const copyLen = Math.min(sliceLen, data.length - startSample)
      if (copyLen <= 0) continue
      const offset = s * sliceLen
      for (let i = 0; i < copyLen; i++) dst[offset + i] = data[startSample + i]
      for (let i = 0; i < fadeInLen && i < copyLen; i++) {
        dst[offset + i] *= i / fadeInLen
      }
      for (let i = 0; i < fadeOutLen && i < copyLen; i++) {
        const idx2 = copyLen - fadeOutLen + i
        if (idx2 >= 0) dst[offset + idx2] *= 1 - i / fadeOutLen
      }
    }
  }
  return out
}

function makeSliceWithSilence(
  ac: AudioContext,
  src: AudioBuffer,
  startSec: number,
  sliceSec: number,
  silenceSec: number,
): AudioBuffer {
  const sliceLen = Math.floor(sliceSec * src.sampleRate)
  const silenceLen = Math.floor(silenceSec * src.sampleRate)
  const out = ac.createBuffer(src.numberOfChannels, sliceLen + silenceLen, src.sampleRate)
  const startSample = Math.floor(startSec * src.sampleRate)
  const fadeInLen = Math.min(Math.floor(0.02 * src.sampleRate), Math.floor(sliceLen / 4))
  const fadeOutLen = Math.min(Math.floor(0.12 * src.sampleRate), Math.floor(sliceLen / 2))
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const data = src.getChannelData(ch)
    const dst = out.getChannelData(ch)
    const copyLen = Math.min(sliceLen, data.length - startSample)
    if (copyLen <= 0) continue
    dst.set(data.subarray(startSample, startSample + copyLen), 0)
    for (let i = 0; i < fadeInLen && i < copyLen; i++) {
      dst[i] *= i / fadeInLen
    }
    for (let i = 0; i < fadeOutLen && i < copyLen; i++) {
      const idx = copyLen - fadeOutLen + i
      if (idx >= 0) dst[idx] *= 1 - i / fadeOutLen
    }
  }
  return out
}

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
  chosenChords?: (number | null)[]
  onChosenChordsChange?: (next: (number | null)[]) => void
  wrongChordSlots?: Set<number>
  onNotesActive?: (notes: string[]) => void
}

export function AudioPlayer({
  variant = 'instrumental',
  accidental = 'sharp',
  chordOptions = [],
  chosenChords = [null, null, null, null],
  onChosenChordsChange,
  wrongChordSlots,
  onNotesActive,
}: AudioPlayerProps) {
  const isVocals = variant === 'with-vocals'
  const showLyrics = variant === 'with-vocals'
  const isScratchpad = variant === 'chord-scratchpad'

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const segmentProgressRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null])
  const playheadRef = useRef<HTMLDivElement>(null)

  const acRef = useRef<AudioContext | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const chosenChordsRef = useRef(chosenChords)
  const chordOptionsRef = useRef(chordOptions)

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
  const [activeButton, setActiveButton] = useState<{ idx: number; kind: 'original' | 'together' } | null>(null)

  useEffect(() => {
    const ac = new AudioContext()
    acRef.current = ac
    const gain = ac.createGain()
    gain.gain.value = isScratchpad ? 1 : 0.8
    gain.connect(ac.destination)
    gainRef.current = gain
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const mid = h / 2

    if (isScratchpad) {
      const fullSegDur = buffer.duration / 4
      const sliceLen = Math.floor(SCRATCHPAD_SLICE_SEC * buffer.sampleRate)
      const quarterW = w / 4
      for (let s = 0; s < 4; s++) {
        const segStartSample = Math.floor(s * fullSegDur * buffer.sampleRate)
        const slice = allData.subarray(segStartSample, segStartSample + sliceLen)
        const step = slice.length / quarterW
        const xStart = s * quarterW
        ctx.fillStyle = hexToRgba(CHORD_COLORS[s], 0.6)
        for (let xi = 0; xi < quarterW; xi++) {
          let peak = 0
          const sStart = Math.floor(xi * step)
          const sEnd = Math.min(Math.floor((xi + 1) * step), slice.length)
          for (let i = sStart; i < sEnd; i++) { const a = Math.abs(slice[i]); if (a > peak) peak = a }
          const half = peak * mid * 0.85
          ctx.fillRect(xStart + xi, mid - half, 1, Math.max(1, half * 2))
        }
      }
      return
    }

    const sampleStart = isVocals
      ? Math.floor(VOCALS_LOOP_STARTS[loopIdx] * buffer.sampleRate)
      : 0
    const sampleEnd = isVocals
      ? Math.floor((VOCALS_LOOP_STARTS[loopIdx + 1] ?? buffer.duration) * buffer.sampleRate)
      : allData.length
    const data = allData.subarray(sampleStart, sampleEnd)
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
          const elapsed = ac.currentTime - startTimeRef.current
          const posInCycle = ((elapsed % SCRATCHPAD_CYCLE_SEC) + SCRATCHPAD_CYCLE_SEC) % SCRATCHPAD_CYCLE_SEC
          const audioPhasePos = Math.min(posInCycle, SCRATCHPAD_SLICE_SEC)
          const pct = (segIdx + audioPhasePos / SCRATCHPAD_SLICE_SEC) * 0.25
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
    source.connect(gainRef.current ?? ac.destination)
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
    setActiveButton(null)
    applyPct(0, isScratchpad ? null : undefined)
  }

  const play = () => {
    startSource(globalOffsetRef.current)
    setPlaying(true)
    rafRef.current = requestAnimationFrame(animate)
  }

  // const startFromLoop = (loopIdx: number) => {
  //   try { sourceRef.current?.stop() } catch { /**/ }
  //   sourceRef.current = null
  //   cancelAnimationFrame(rafRef.current)
  //   const offset = VOCALS_LOOP_STARTS[loopIdx]
  //   globalOffsetRef.current = offset
  //   loopIndexRef.current = loopIdx
  //   chordIndexRef.current = 0
  //   setLoopIndex(loopIdx)
  //   setChordIndex(0)
  //   startSource(offset)
  //   setPlaying(true)
  //   rafRef.current = requestAnimationFrame(animate)
  // }

  const playSegmentGuitar = (idx: number, kind: 'original' | 'together' = 'original') => {
    const ac = acRef.current
    const buffer = bufferRef.current
    if (!ac || !buffer) return
    try { sourceRef.current?.stop() } catch { /**/ }
    sourceRef.current = null
    cancelAnimationFrame(rafRef.current)
    if (ac.state === 'suspended') ac.resume()

    const fullSegDur = buffer.duration / 4
    const segStart = idx * fullSegDur
    const sliceBuf = makeSliceWithSilence(ac, buffer, segStart, SCRATCHPAD_SLICE_SEC, 0)

    const source = ac.createBufferSource()
    source.buffer = sliceBuf
    source.loop = false
    source.connect(gainRef.current ?? ac.destination)
    source.start(0)
    source.onended = () => {
      if (sourceRef.current !== source) return
      sourceRef.current = null
      cancelAnimationFrame(rafRef.current)
      activeSegmentRef.current = null
      setActiveButton(null)
      setPlaying(false)
      applyPct(0, null)
    }
    sourceRef.current = source
    startTimeRef.current = ac.currentTime
    activeSegmentRef.current = idx
    setActiveButton({ idx, kind })
    setPlaying(true)
    rafRef.current = requestAnimationFrame(animate)
  }

  const playSegmentPiano = (idx: number) => {
    const chordIdx = chosenChordsRef.current[idx]
    if (chordIdx === null || chordIdx === undefined) return
    const chord = chordOptionsRef.current[chordIdx]
    if (!chord) return
    playChord(chord.notes.map(transposeDownOctave), SCRATCHPAD_SLICE_SEC)
    onNotesActive?.(chord.notes)
  }

  const playSegmentOriginal = (idx: number) => {
    playSegmentGuitar(idx, 'original')
  }

  const playSegmentYours = (idx: number) => {
    try { sourceRef.current?.stop() } catch { /**/ }
    sourceRef.current = null
    playSegmentPiano(idx)
  }

  const playSegmentTogether = (idx: number) => {
    playSegmentGuitar(idx, 'together')
    playSegmentPiano(idx)
  }

  const handleChordChoice = (slotIdx: number, chordIdx: number) => {
    const next = [...chosenChords]
    next[slotIdx] = chordIdx
    onChosenChordsChange?.(next)
    const chord = chordOptions[chordIdx]
    if (!chord) return
    playChord(chord.notes.map(transposeDownOctave), SCRATCHPAD_SLICE_SEC)
    onNotesActive?.(chord.notes)
  }

  useEffect(() => {
    chosenChordsRef.current = chosenChords
  }, [chosenChords])

  useEffect(() => {
    chordOptionsRef.current = chordOptions
  }, [chordOptions])

  const sweepStartTimeRef = useRef(0)

  const sweepAnimate = () => {
    const ac = acRef.current
    if (!ac) return
    const totalDur = SCRATCHPAD_SLICE_SEC * 4
    const elapsed = ac.currentTime - sweepStartTimeRef.current
    const pct = Math.max(0, Math.min(elapsed / totalDur, 1))
    applyPct(pct)
    if (pct < 1) {
      rafRef.current = requestAnimationFrame(sweepAnimate)
    }
  }

  const startSweep = () => {
    const ac = acRef.current
    if (!ac) return
    sweepStartTimeRef.current = ac.currentTime
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(sweepAnimate)
  }

  const hearOriginal = () => {
    const ac = acRef.current
    const buffer = bufferRef.current
    if (!ac || !buffer) return
    stop()
    clearHearYours()
    if (ac.state === 'suspended') ac.resume()
    const concat = makeConcatBuffer(ac, buffer, SCRATCHPAD_SLICE_SEC)
    const source = ac.createBufferSource()
    source.buffer = concat
    source.loop = false
    source.connect(gainRef.current ?? ac.destination)
    source.start(0)
    source.onended = () => {
      if (sourceRef.current === source) sourceRef.current = null
      cancelAnimationFrame(rafRef.current)
      applyPct(0, null)
    }
    sourceRef.current = source
    startSweep()
  }

  const hearYoursTimersRef = useRef<number[]>([])

  const clearHearYours = () => {
    hearYoursTimersRef.current.forEach((t) => window.clearTimeout(t))
    hearYoursTimersRef.current = []
  }

  const hearYours = () => {
    const ac = acRef.current
    if (!ac) return
    stop()
    clearHearYours()
    if (ac.state === 'suspended') ac.resume()
    for (let i = 0; i < 4; i++) {
      const idx = chosenChords[i]
      if (idx === null) continue
      const chord = chordOptions[idx]
      if (!chord) continue
      const t = window.setTimeout(() => {
        playChord(chord.notes.map(transposeDownOctave), SCRATCHPAD_SLICE_SEC)
        onNotesActive?.(chord.notes)
      }, i * SCRATCHPAD_SLICE_SEC * 1000)
      hearYoursTimersRef.current.push(t)
    }
    startSweep()
    const totalMs = SCRATCHPAD_SLICE_SEC * 4 * 1000
    hearYoursTimersRef.current.push(
      window.setTimeout(() => {
        cancelAnimationFrame(rafRef.current)
        applyPct(0, null)
      }, totalMs),
    )
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
        {CHORD_COLORS.map((color, i) => {
          const slotChordIdx = chosenChords[i]
          const slotChord = slotChordIdx !== null ? chordOptions[slotChordIdx] : null
          const slotRoot = slotChord ? formatNote(slotChord.name.replace(/[m°]$/, ''), accidental) : ''
          const slotSuffix = slotChord ? slotChord.name.match(/[m°]$/)?.[0] ?? '' : ''
          return (
            <div className="ap-slot" key={i}>
              {isScratchpad ? (
                <div
                  className={`ap-chord-toggle${wrongChordSlots?.has(i) ? ' is-wrong' : ''}`}
                  role="radiogroup"
                  aria-label={`Chord slot ${i + 1}`}
                >
                  {chordOptions.map((c, j) => {
                    const root = formatNote(c.name.replace(/[m°]$/, ''), accidental)
                    const suffix = c.name.match(/[m°]$/)?.[0] ?? ''
                    const selected = chosenChords[i] === j
                    const wrong = selected && (wrongChordSlots?.has(i) ?? false)
                    return (
                      <button
                        key={j}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`ap-chord-toggle-btn${selected ? ' active' : ''}${wrong ? ' is-wrong' : ''}`}
                        style={selected && !wrong ? { borderColor: color, color, background: hexToRgba(color, 0.15) } : undefined}
                        onClick={() => handleChordChoice(i, j)}
                      >
                        {root}{suffix}
                      </button>
                    )
                  })}
                </div>
              ) : slotChord ? (
                <button
                  type="button"
                  className={`ap-slot-circle ap-slot-circle-btn${playing && chordIndex === i ? ' is-current' : ''}`}
                  style={{ borderColor: color, color, ['--slot-color' as string]: color }}
                  onClick={() => {
                    playChord(slotChord.notes.map(transposeDownOctave))
                    onNotesActive?.(slotChord.notes)
                  }}
                  aria-label={`Play ${slotRoot}${slotSuffix}`}
                >
                  {slotRoot}{slotSuffix}
                </button>
              ) : (
                <div className="ap-slot-circle" style={{ borderColor: color, color }}>?</div>
              )}
            </div>
          )
        })}
      </div>

      {isScratchpad ? null : (
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
            const slotChordIdx = chosenChords[i]
            const hasChord = slotChordIdx !== null && slotChordIdx !== undefined
            const originalActive = activeButton?.idx === i && activeButton.kind === 'original'
            const togetherActive = activeButton?.idx === i && activeButton.kind === 'together'
            return (
              <div className="ap-segment-col" key={i}>
                <button
                  type="button"
                  className={`ap-segment-btn${originalActive ? ' active' : ''}`}
                  style={originalActive ? { borderColor: color, color } : undefined}
                  onClick={() => playSegmentOriginal(i)}
                  disabled={!loaded}
                >
                  Original
                </button>
                <button
                  type="button"
                  className="ap-segment-btn"
                  onClick={() => playSegmentYours(i)}
                  disabled={!loaded || !hasChord}
                >
                  Yours
                </button>
                <button
                  type="button"
                  className={`ap-segment-btn${togetherActive ? ' active' : ''}`}
                  style={togetherActive ? { borderColor: color, color } : undefined}
                  onClick={() => playSegmentTogether(i)}
                  disabled={!loaded || !hasChord}
                >
                  Together
                </button>
              </div>
            )
          })}
        </div>
      )}

      {isScratchpad && (
        <div className="ap-hear-btns">
          <button
            type="button"
            className="ap-hear-btn"
            onClick={hearOriginal}
            disabled={!loaded}
          >
            Hear Original (Full)
          </button>
          <button
            type="button"
            className="ap-hear-btn"
            onClick={hearYours}
            disabled={!loaded || chosenChords.every((c) => c === null)}
          >
            Hear Yours (Full)
          </button>
        </div>
      )}

      {showLyrics && (
        <div className="ap-lyrics">
          <p
            className="ap-lyrics-instrumental"
            style={{ opacity: playing && loopIndex === 0 ? 1 : 0.3, gridColumn: '1 / -1' }}
          >
            [ instrumental ]
          </p>
          {VOCALS_VERSE_LINES.map((verse, verseIdx) => {
            const reached =
              loopIndex > verseIdx ||
              (loopIndex === verseIdx && chordIndex === 3)
            return verse.map((line, lineIdx) => {
              const color = CHORD_COLORS[lineIdx]
              const active = playing && loopIndex === verseIdx + 1 && chordIndex === lineIdx
              const opacity = !reached ? 0 : active ? 1 : 0.3
              return (
                <p
                  key={`${verseIdx}-${lineIdx}`}
                  style={{ color, opacity }}
                >
                  {line}
                </p>
              )
            })
          })}
        </div>
      )}
    </div>
  )
}
