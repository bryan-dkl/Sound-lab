// ---------------------------------------------------------------------------
// Repeater portal: port of Shadertoy https://www.shadertoy.com/view/lcfyDj
// The original credits: https://x.com/cmzw_/status/1787147460772864188 (celestianmaze)
// TODO: add the Shadertoy title and author shown on the page above.
//
// What it does: the pixel's direction is pushed back in z over time and
// twisted more towards the middle (-log2 of the distance), then run through
// 3D simplex noise (fbm). That noise warps a glowing orange ring, and the
// noise's largest direction ("facture") cuts dark streaks out of it.
//
// Original main function (GLSL), the noise helpers are ported below as-is:
//
//   void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
//     vec2 uv = (fragCoord * 2.0 - iResolution.xy) / iResolution.y;
//     vec3 color = vec3(uv.xy, 0.0);
//     color.z += 0.5;
//     color = normalize(color);
//     color -= 0.2 * vec3(0.0, 0.0, iTime);
//     float angle = -log2(length(uv));
//     color = rotateZ( color, angle );
//     float frequency = 1.4;
//     float distortion = 0.01;
//     color.x = fbm3d(color * frequency + 0.0, 5) + distortion;
//     color.y = fbm3d(color * frequency + 1.0, 5) + distortion;
//     color.z = fbm3d(color * frequency + 2.0, 5) + distortion;
//     vec3 noiseColor = color;
//     noiseColor *= 2.0;
//     noiseColor -= 0.1;
//     noiseColor *= 0.188;
//     noiseColor += vec3(uv.xy, 0.0);
//     float noiseColorLength = length(noiseColor);
//     noiseColorLength = 0.770 - noiseColorLength;
//     noiseColorLength *= 4.2;
//     noiseColorLength = pow(noiseColorLength, 1.0);
//     vec3 emissionColor = emission(vec3(0.961,0.592,0.078), noiseColorLength * 0.4);
//     float fac = length(uv) - facture(color + 0.32);
//     fac += 0.1;
//     fac *= 3.0;
//     color = mix(emissionColor, vec3(fac), fac + 1.2);
//     fragColor = vec4(color, 1.0);
//   }
//
// Porting notes (GLSL -> WGSL):
//   - vec2/vec3/vec4/float/int -> vec2f/vec3f/vec4f/f32/i32
//   - iTime and the pixel coordinate aren't globals: they're parameters that
//     Three.js fills (uv is already -1..1 across the repeater's disc)
//   - GLSL's mod() floors, WGSL's % truncates, so mod289() uses
//     x - 289 * floor(x / 289) to give the same result for negative numbers
//   - fbm3d's "loop to 32 with if (i < it)" (old GLSL needed constant loop
//     bounds) is just a loop up to `it` here
//   - `const` locals -> `let`, `x *= y` on vectors kept as `x = x * y`
//   - pow(x, 1.0) and emission() are dropped (they don't change anything)
//   - wgslFn treats the first function as the entry point and keeps the rest
//     of the file as-is, so the helpers come after it (WGSL allows that)
//   - the result is clamped to 0..1 (Shadertoy clamps when it displays it)
// ---------------------------------------------------------------------------

fn repeaterPortal(uv: vec2f, time: f32) -> vec3f {
  var color = normalize(vec3f(uv, 0.5));
  color = color - 0.2 * vec3f(0.0, 0.0, time);

  // max() keeps the very middle pixel away from log2(0)
  let angle = -log2(max(length(uv), 0.0001));
  color = rotateZ(color, angle);

  let frequency = 1.4;
  let distortion = 0.01;
  color.x = fbm3d(color * frequency + 0.0, 5) + distortion;
  color.y = fbm3d(color * frequency + 1.0, 5) + distortion;
  color.z = fbm3d(color * frequency + 2.0, 5) + distortion;

  var noiseColor = color;
  noiseColor = noiseColor * 2.0 - 0.1;
  noiseColor = noiseColor * 0.188 + vec3f(uv, 0.0);

  let ring = (0.770 - length(noiseColor)) * 4.2;
  let emissionColor = vec3f(0.961, 0.592, 0.078) * (ring * 0.4);

  let fac = (length(uv) - facture(color + 0.32) + 0.1) * 3.0;

  return clamp(mix(emissionColor, vec3f(fac), fac + 1.2), vec3f(0.0), vec3f(1.0));
}

fn mod289(x: vec4f) -> vec4f { return x - 289.0 * floor(x / 289.0); }
fn mod289v3(x: vec3f) -> vec3f { return x - 289.0 * floor(x / 289.0); }

fn permute_3d(x: vec4f) -> vec4f { return mod289(((x * 34.0) + 1.0) * x); }
fn taylorInvSqrt3d(r: vec4f) -> vec4f { return 1.79284291400159 - 0.85373472095314 * r; }

fn simplexNoise3d(v: vec3f) -> f32 {
  let C = vec2f(1.0 / 6.0, 1.0 / 3.0);
  let D = vec4f(0.0, 0.5, 1.0, 2.0);

  // First corner
  var i = floor(v + dot(v, C.yyy));
  let x0 = v - i + dot(i, C.xxx);

  // Other corners
  let g = step(x0.yzx, x0.xyz);
  let l = 1.0 - g;
  let i1 = min(g.xyz, l.zxy);
  let i2 = max(g.xyz, l.zxy);

  let x1 = x0 - i1 + 1.0 * C.xxx;
  let x2 = x0 - i2 + 2.0 * C.xxx;
  let x3 = x0 - 1.0 + 3.0 * C.xxx;

  // Permutations
  i = mod289v3(i);
  let p = permute_3d(permute_3d(permute_3d(
      i.z + vec4f(0.0, i1.z, i2.z, 1.0)) +
      i.y + vec4f(0.0, i1.y, i2.y, 1.0)) +
      i.x + vec4f(0.0, i1.x, i2.x, 1.0));

  // Gradients: N*N points uniformly over a square, mapped onto an octahedron (N = 7)
  let n_ = 1.0 / 7.0;
  let ns = n_ * D.wyz - D.xzx;

  let j = p - 49.0 * floor(p * ns.z * ns.z); // mod(p, N*N)

  let x_ = floor(j * ns.z);
  let y_ = floor(j - 7.0 * x_); // mod(j, N)

  let x = x_ * ns.x + ns.yyyy;
  let y = y_ * ns.x + ns.yyyy;
  let h = 1.0 - abs(x) - abs(y);

  let b0 = vec4f(x.xy, y.xy);
  let b1 = vec4f(x.zw, y.zw);

  let s0 = floor(b0) * 2.0 + 1.0;
  let s1 = floor(b1) * 2.0 + 1.0;
  let sh = -step(h, vec4f(0.0));

  let a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  let a1 = b1.xzyw + s1.xzyw * sh.zzww;

  var p0 = vec3f(a0.xy, h.x);
  var p1 = vec3f(a0.zw, h.y);
  var p2 = vec3f(a1.xy, h.z);
  var p3 = vec3f(a1.zw, h.w);

  // Normalise gradients
  let norm = taylorInvSqrt3d(vec4f(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 = p0 * norm.x;
  p1 = p1 * norm.y;
  p2 = p2 * norm.z;
  p3 = p3 * norm.w;

  // Mix final noise value
  var m = max(0.6 - vec4f(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4f(0.0));
  m = m * m;
  return 42.0 * dot(m * m, vec4f(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

fn fbm3d(start: vec3f, it: i32) -> f32 {
  var x = start;
  var v = 0.0;
  var a = 0.5;
  let shift = vec3f(100.0);

  for (var i = 0; i < it; i++) {
    v += a * simplexNoise3d(x);
    x = x * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

fn rotateZ(v: vec3f, angle: f32) -> vec3f {
  let c = cos(angle);
  let s = sin(angle);
  return vec3f(v.x * c - v.y * s, v.x * s + v.y * c, v.z);
}

fn facture(v: vec3f) -> f32 {
  let n = normalize(v);
  return max(max(n.x, n.y), n.z);
}
