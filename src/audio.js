// Audio: a simple Tone.js synth that plays pentatonic notes.

import * as Tone from 'tone';

// C major pentatonic, low to high: every note sounds fine together
export const NOTES = [
  'C3', 'D3', 'E3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5',
];

// Several notes can ring at once (e.g. clicking lines quickly)
const synth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.8 },
}).toDestination();
synth.volume.value = -10;

// Browsers only allow sound after a user gesture, so call this on a click
export const startAudio = () => {
  return Tone.start();
};

export const playNote = async (note) => {
  await startAudio();
  synth.triggerAttackRelease(note, '8n');
};

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
