// Audio: Tone.js synths that play pentatonic notes. Every line variant has
// its own instrument (see INSTRUMENTS), the background uses the classic one.

// C major pentatonic, low to high: every note sounds fine together
export const NOTES = [
  'C3', 'D3', 'E3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5',
];

// Tone.js is only loaded on the first click: it creates its AudioContext as
// soon as it's imported, and doing that before a click gives an
// "AudioContext was not allowed to start" warning in the console
let Tone = null;

// Browsers only allow sound after a user gesture, so call this on a click
export const startAudio = async () => {
  Tone ??= await import('tone');
  await Tone.start();
};

// ------------------------------------------------------------ instruments
// One per line variant. They're all PolySynths, so several notes can ring at
// once (e.g. clicking lines quickly). `transpose` shifts the note in
// semitones: 12 = an octave higher. `sustain` in the envelopes is the volume
// a held note settles on.
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

  // a bell an octave up, ringing out in a reverb
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

  // a warm bass an octave down: three detuned saws with the harsh top cut off
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

  // a short pluck that bounces between left and right
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

// instruments are only built the first time they're played
const built = {};

const instrumentFor = async (variant) => {
  await startAudio();
  const instrument = INSTRUMENTS[variant] ?? INSTRUMENTS.classic;
  built[variant] ??= instrument.create();
  return { synth: built[variant], transpose: instrument.transpose };
};

const shift = (note, semitones) => (semitones ? Tone.Frequency(note).transpose(semitones).toNote() : note);

// velocity is 0..1: how hard the note is played (used for ball hits)
export const playNote = async (note, velocity = 1, variant = 'classic') => {
  const { synth, transpose } = await instrumentFor(variant);
  synth.triggerAttackRelease(shift(note, transpose), '8n', undefined, velocity);
};

// ------------------------------------------------------------ held notes
// One note keeps sounding while the mouse button is down
let held = null; // { note, variant, synth, played }

export const holdNote = async (note, variant = 'classic') => {
  if (held?.note === note && held.variant === variant) return;
  releaseNote();
  const current = { note, variant };
  held = current;

  const { synth, transpose } = await instrumentFor(variant);
  // the button may have been released while the audio was starting
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

// ------------------------------------------------------------ drones
// A drone is a note that keeps playing until it's stopped (used by the
// holders). Each one has its own synth, so drones never cut each other off.
export const createDrone = () => {
  let drone = null;
  let wanted = null; // the note it should play, null = silent
  let playing = false;

  const start = async (note) => {
    wanted = note;
    await startAudio();
    if (wanted !== note) return; // stopped while the audio was starting
    drone ??= new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 1.2 },
    }).toDestination();
    drone.volume.value = -14;
    // already playing: switch to the new note without starting it again
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
    // wait for the release to fade out before throwing the synth away
    const old = drone;
    drone = null;
    if (old) setTimeout(() => old.dispose(), 1500);
  };

  return { start, stop, dispose };
};

// ------------------------------------------------------------ notes
// x is 0..1 across the screen: left = low, right = high
export const noteForX = (x) => {
  const index = Math.floor(x * NOTES.length);
  return NOTES[Math.min(NOTES.length - 1, Math.max(0, index))];
};

// Like a string: a longer line plays a lower note
export const MIN_LENGTH = 0.5;
export const MAX_LENGTH = 10;

export const noteIndexForLength = (length) => {
  const t = (length - MIN_LENGTH) / (MAX_LENGTH - MIN_LENGTH);
  const index = Math.round((1 - t) * (NOTES.length - 1));
  return Math.min(NOTES.length - 1, Math.max(0, index));
};
