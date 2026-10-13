// Audio: a simple Tone.js synth that plays a note on every click.

import * as Tone from 'tone';

// C major pentatonic: every note sounds fine together
const NOTES = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'];

const synth = new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.8 },
}).toDestination();
synth.volume.value = -8;

// x is 0..1 across the screen: left = low, right = high
export async function playTone(x) {
  // browsers only allow sound after a user gesture, so start on the first click
  await Tone.start();

  const index = Math.min(NOTES.length - 1, Math.floor(x * NOTES.length));
  synth.triggerAttackRelease(NOTES[index], '8n');
}
