// Audio: a simple Tone.js synth that plays pentatonic notes.

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
let synth = null;

// Browsers only allow sound after a user gesture, so call this on a click
export const startAudio = async () => {
  Tone ??= await import('tone');
  await Tone.start();
  if (!synth) {
    // Several notes can ring at once (e.g. clicking lines quickly)
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      // sustain is the volume a held note settles on
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.8 },
    }).toDestination();
    synth.volume.value = -10;
  }
};

// velocity is 0..1: how hard the note is played (used for ball hits)
export const playNote = async (note, velocity = 1) => {
  await startAudio();
  synth.triggerAttackRelease(note, '8n', undefined, velocity);
};

// ------------------------------------------------------------ held notes
// One note keeps sounding while the mouse button is down
let heldNote = null;

export const holdNote = async (note) => {
  if (note === heldNote) return;
  const previous = heldNote;
  heldNote = note;

  await startAudio();
  if (previous) synth.triggerRelease(previous);
  // the button may have been released while the audio was starting
  if (heldNote === note) synth.triggerAttack(note);
};

export const releaseNote = () => {
  if (!heldNote) return;
  synth?.triggerRelease(heldNote);
  heldNote = null;
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
