// line variants: each looks and sounds different
// look in lines.js, sound in audio.js

export const VARIANTS = [
  { id: 'classic', name: 'Classic', key: '1', radius: 0.12 }, // soft synth
  { id: 'glass', name: 'Glass', key: '2', radius: 0.09 }, // bell, octave up, reverb
  { id: 'deep', name: 'Deep', key: '3', radius: 0.17 }, // bass, octave down, filtered
  { id: 'echo', name: 'Echo', key: '4', radius: 0.12 }, // pluck with ping-pong delay
];

export const variantById = (id) => VARIANTS.find((v) => v.id === id) ?? VARIANTS[0];
