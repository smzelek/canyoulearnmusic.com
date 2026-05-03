import * as Tone from 'tone'

const sampler = new Tone.Sampler({
  urls: {
    A1: 'A1.mp3',
    A2: 'A2.mp3',
    A3: 'A3.mp3',
    A4: 'A4.mp3',
    A5: 'A5.mp3',
    A6: 'A6.mp3',
  },
  release: 1,
  baseUrl: 'https://tonejs.github.io/audio/salamander/',
}).toDestination()

let started = false

async function ensureStarted() {
  if (started) return
  await Tone.start()
  Tone.getContext().lookAhead = 0
  await Tone.loaded()
  started = true
}

export function playNote(note: string, duration: Tone.Unit.Time = '2n') {
  if (started) {
    sampler.triggerAttackRelease(note, duration)
    return
  }
  ensureStarted().then(() => sampler.triggerAttackRelease(note, duration))
}

export function playChord(notes: string[], duration: Tone.Unit.Time = '2n') {
  if (started) {
    sampler.triggerAttackRelease(notes, duration)
    return
  }
  ensureStarted().then(() => sampler.triggerAttackRelease(notes, duration))
}
