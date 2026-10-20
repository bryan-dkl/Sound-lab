// audio: Tone.js synths, one instrument per line variant

// c major pentatonic
export const NOTES = [
  'C3', 'D3', 'E3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5',
];

// tone.js loads on the first click: importing it earlier
// gives an "AudioContext was not allowed to start" warning
let Tone = null;

// browsers only allow sound after a click
export const startAudio = async () => {
  Tone ??= await import('tone');
  await Tone.start();
};

// TONE.JS
// all PolySynths, so notes can overlap
const INSTRUMENTS = {
  // soft and simple
  classic: {
    transpose: 0,
    create: () => {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.8 },
      }).toDestination();
      synth.volume.value = -10;
      return synth;
    },
  },

  // bell an octave up, with reverb
  glass: {
    transpose: 12,
    create: () => {
      const reverb = new Tone.Reverb({ decay: 3, wet: 0.35 }).toDestination();
      const synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 10,
        envelope: { attack: 0.002, decay: 1.2, sustain: 0.15, release: 1.6 },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
      }).connect(reverb);
      synth.volume.value = -16;
      return synth;
    },
  },

  // bass an octave down
  deep: {
    transpose: -12,
    create: () => {
      const filter = new Tone.Filter({ type: 'lowpass', frequency: 700, Q: 1 }).toDestination();
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 25 },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.6, release: 0.6 },
      }).connect(filter);
      synth.volume.value = -14;
      return synth;
    },
  },

  // short pluck bouncing left and right
  echo: {
    transpose: 0,
    create: () => {
      const delay = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.35, wet: 0.35 }).toDestination();
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fmsine', harmonicity: 2, modulationIndex: 2 },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.5 },
      }).connect(delay);
      synth.volume.value = -10;
      return synth;
    },
  },
};

// built on first use
const built = {};

const instrumentFor = async (variant) => {
  await startAudio();
  const instrument = INSTRUMENTS[variant] ?? INSTRUMENTS.classic;
  built[variant] ??= instrument.create();
  return { synth: built[variant], transpose: instrument.transpose };
};

const shift = (note, semitones) => (semitones ? Tone.Frequency(note).transpose(semitones).toNote() : note);

// velocity
export const playNote = async (note, velocity = 1, variant = 'classic') => {
  const { synth, transpose } = await instrumentFor(variant);
  synth.triggerAttackRelease(shift(note, transpose), '8n', undefined, velocity);
};

// held notes
// one note sounds while the mouse is down
let held = null; // { note, variant, synth, played }

export const holdNote = async (note, variant = 'classic') => {
  if (held?.note === note && held.variant === variant) return;
  releaseNote();
  const current = { note, variant };
  held = current;

  const { synth, transpose } = await instrumentFor(variant);
  // released while audio was starting
  if (held !== current) return;
  current.synth = synth;
  current.played = shift(note, transpose);
  synth.triggerAttack(current.played);
};

export const releaseNote = () => {
  if (!held) return;
  held.synth?.triggerRelease(held.played);
  held = null;
};

// holders
export const createDrone = () => {
  let drone = null;
  let wanted = null; // note to play, null = silent
  let playing = false;

  const start = async (note) => {
    wanted = note;
    await startAudio();
    if (wanted !== note) return; // stopped while audio was starting
    drone ??= new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 1.2 },
    }).toDestination();
    drone.volume.value = -14;
    // already playing: just switch note
    if (playing) drone.setNote(note);
    else drone.triggerAttack(note);
    playing = true;
  };

  const stop = () => {
    wanted = null;
    playing = false;
    drone?.triggerRelease();
  };

  const dispose = () => {
    stop();
    // dispose after the release fades out
    const old = drone;
    drone = null;
    if (old) setTimeout(() => old.dispose(), 1500);
  };

  return { start, stop, dispose };
};

// ------------------------------------------------------------ notes
// x 0..1: left = low, right = high
export const noteForX = (x) => {
  const index = Math.floor(x * NOTES.length);
  return NOTES[Math.min(NOTES.length - 1, Math.max(0, index))];
};

// like a string: longer = lower
export const MIN_LENGTH = 0.5;
export const MAX_LENGTH = 10;

export const noteIndexForLength = (length) => {
  const t = (length - MIN_LENGTH) / (MAX_LENGTH - MIN_LENGTH);
  const index = Math.round((1 - t) * (NOTES.length - 1));
  return Math.min(NOTES.length - 1, Math.max(0, index));
};
