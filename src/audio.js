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
