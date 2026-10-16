// Line variants: each one looks and sounds a bit different.
// The look lives in lines.js, the sound in audio.js; this is the shared list.

export const VARIANTS = [
  { id: 'classic', name: 'Classic', key: '1', radius: 0.12 }, // soft synth
  { id: 'glass', name: 'Glass', key: '2', radius: 0.09 }, // bell, an octave up, reverb
  { id: 'deep', name: 'Deep', key: '3', radius: 0.17 }, // warm bass, an octave down, filtered
  { id: 'echo', name: 'Echo', key: '4', radius: 0.12 }, // pluck with a ping-pong delay
];

export const variantById = (id) => VARIANTS.find((v) => v.id === id) ?? VARIANTS[0];
