// ---------------------------------------------------------------------------
// Port of "Creation" by Silexars
// Original (GLSL): https://www.shadertoy.com/view/XsXXDn
//
// Original Shadertoy code:
//
//   #define t iTime
//   #define r iResolution.xy
//   void mainImage( out vec4 fragColor, in vec2 fragCoord ){
//     vec3 c;
//     float l,z=t;
//     for(int i=0;i<3;i++) {
//       vec2 uv,p=fragCoord.xy/r;
//       uv=p;
//       p-=.5;
//       p.x*=r.x/r.y;
//       z+=.07;
//       l=length(p);
//       uv+=p/l*(sin(z)+1.)*abs(sin(l*9.-z-z));
//       c[i]=.02/length(mod(uv,1.)-.5);
//     }
//     fragColor=vec4(c/l,t);
//   }
//
// Porting notes (GLSL -> WGSL):
//   - vec2/vec3/float  -> vec2f/vec3f/f32
//   - iTime, iResolution don't exist: passed in as function params that
//     Three.js fills from uniforms
//   - mod(uv, 1.0) -> fract(uv). WGSL's `%` behaves differently from GLSL's
//     mod() for negative numbers, fract() = x - floor(x) matches mod(x, 1.0)
//   - c[i] = ... on a vec3 is replaced by an explicit if/else per channel
//   - l is clamped so the centre pixel can't divide by zero
//   - extra inputs: `center` (mouse), `level` (intensity), `kick` (clicks)
// ---------------------------------------------------------------------------

fn creation(fragUV: vec2f, res: vec2f, time: f32, center: vec2f, level: f32, kick: f32) -> vec3f {
  var c = vec3f(0.0);
  var l = 0.0;
  var z = time;

  for (var i = 0; i < 3; i++) {
    var p = fragUV;
    var uv = p;
    p = p - center;
    p.x = p.x * (res.x / res.y);
    z = z + 0.07 + kick * 0.06;              // kick = stronger colour split
    l = max(length(p), 0.0001);
    uv = uv + p / l * (sin(z) + 1.0) * abs(sin(l * (9.0 + level * 10.0) - z - z));
    let v = (0.02 + level * 0.02) / length(fract(uv) - 0.5);

    if (i == 0) { c.x = v; } else if (i == 1) { c.y = v; } else { c.z = v; }
  }

  return min(c / l, vec3f(1.5));
}
