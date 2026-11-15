// FlameScope Live Flame: a qualitative, physically-cued flame.
//
// Physics cues (qualitative, not a CFD solution):
//  - gravity drives buoyant convection: tall, flickering, sooty yellow-orange teardrop at 1 g;
//    near-spherical, steady, dim blue diffusion flame at 0 g; Moon/Mars sit in between.
//  - forced flow (cm/s) skews and stretches the flame downstream (+x), even at 0 g.
//  - more O2 makes the flame larger, brighter and hotter (whiter core).
//  - lower pressure makes it slightly dimmer, larger and more diffuse.
//  - at low O2 (roughly below 15-17%) the flame weakens and flickers toward going out.
//
// All inputs are eased on the CPU, so the shader is a pure function of its uniforms.
precision highp float;

uniform vec2  u_resolution; // drawing buffer size in device pixels
uniform float u_dpr;        // device pixel ratio used for the buffer
uniform float u_time;       // seconds (already slowed for reduced motion)
uniform float u_phase;      // integrated turbulence phase (speed depends on gravity and flow)
uniform float u_o2;         // O2 percent, 10..100
uniform float u_pressure;   // psi, 1..15
uniform float u_flow;       // forced flow, cm/s, 0..50
uniform float u_gravity;    // g, 0..1

// ---------------------------------------------------------------- noise
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = m * p;
    a *= 0.5;
  }
  return s; // ~0..1, mean ~0.48
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// soot incandescence: ember red -> flame orange -> core yellow -> white-hot
vec3 sootRamp(float t) {
  vec3 c0 = vec3(0.32, 0.04, 0.01);
  vec3 c1 = vec3(1.00, 0.478, 0.102); // --flame-orange
  vec3 c2 = vec3(1.00, 0.878, 0.541); // --flame-core
  vec3 c3 = vec3(1.00, 0.975, 0.93);
  vec3 c = mix(c0, c1, smoothstep(0.0, 0.38, t));
  c = mix(c, c2, smoothstep(0.38, 0.74, t));
  c = mix(c, c3, smoothstep(0.80, 1.10, t));
  return c;
}

float gridLine(float x, float spacing) {
  float d = abs(mod(x + 0.5 * spacing, spacing) - 0.5 * spacing);
  return 1.0 - smoothstep(0.0, 1.0, d);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5 * u_resolution) / u_resolution.y; // y in [-0.5, 0.5]

  // ---------------------------------------------------------- regime terms
  float g = clamp(u_gravity, 0.0, 1.2);
  float gs = sqrt(g);                                   // buoyant velocity ~ sqrt(g)
  float fn = clamp(u_flow / 50.0, 0.0, 1.0);
  float heat = sqrt(clamp((u_o2 - 10.0) / 90.0, 0.0, 1.0)); // hotter, brighter with O2 (21% -> 0.35)
  float lowP = clamp((14.7 - u_pressure) / 13.7, 0.0, 1.0);
  float weak = 1.0 - smoothstep(11.0, 17.0, u_o2);      // approach to extinction

  // irregular dropouts when weak
  float strobe = 0.6 * vnoise(vec2(u_time * 9.0, 1.3)) + 0.4 * vnoise(vec2(u_time * 23.0, 7.1));
  float alive = 1.0 - weak * (0.40 + 0.50 * strobe);

  // buoyant "puffing" of the plume length
  float puff = vnoise(vec2(u_phase * 1.7, 4.2)) - 0.5;

  // convective drive: buoyancy up, forced flow to +x
  vec2 drive = vec2(u_flow / 50.0, 1.2 * gs);
  vec2 dir = normalize(drive + vec2(0.0, 1e-4));
  vec2 nrm = vec2(dir.y, -dir.x);

  float E = 1.0 + 2.2 * gs + 1.1 * fn * (1.0 - 0.4 * gs); // elongation along dir
  E *= 1.0 + puff * (0.18 * gs + 0.03);
  E = mix(E, 1.0 + (E - 1.0) * 0.6, weak);

  float R = 0.115 * mix(0.72, 1.25, heat) * (1.0 + 0.30 * lowP) * (1.0 + 0.30 * (1.0 - gs)) * mix(1.0, 0.62, weak);

  float k = clamp((E - 1.0) / 2.2, 0.0, 1.0);
  R *= 1.0 - 0.25 * k * max(heat, lowP); // keep tall, hot plumes inside the frame

  // framing: wick sits lower when the plume rises, upstream when flow pushes it
  vec2 W = vec2(-0.10 * fn * dir.x, -0.05 - 0.15 * gs);
  vec2 C = W + dir * R * 0.4 * clamp((E - 1.0) / 2.2, 0.0, 1.0);

  // ---------------------------------------------------------- flame frame + turbulence
  vec2 q = p - C;
  float a = dot(q, dir) / R;   // along the flow / plume
  float b = dot(q, nrm) / R;   // across

  float turbAmp = 0.03 + 0.30 * gs + 0.08 * fn + 0.10 * weak;
  float up = smoothstep(-0.6, 2.5, a);
  vec2 tp = vec2(b * 1.3, a * 0.9 - u_phase * 2.2);
  float n1 = fbm(tp);
  float n2 = fbm(tp * 1.7 + vec2(5.2, 1.3));
  b += (n1 - 0.5) * turbAmp * (0.25 + 1.6 * up);
  a += (n2 - 0.5) * turbAmp * 0.5;
  // whole-plume sway, strongest at the tip (buoyant only)
  float sway = vnoise(vec2(u_phase * 0.8, 9.0)) - 0.5;
  b += sway * 0.55 * gs * pow(clamp(a / E, 0.0, 1.0), 2.0);

  // ---------------------------------------------------------- teardrop shape
  float ay = a / (a > 0.0 ? E : 1.0 + 0.2 * (E - 1.0));
  float taper = mix(1.0, max(0.1, 1.0 - 0.8 * max(ay, 0.0)), k);
  float bx = b / (taper * mix(1.0, 0.82, k));
  float d = length(vec2(bx, ay)); // 1.0 at the visible flame surface

  float soft = 0.16 + 0.22 * lowP + 0.10 * (1.0 - gs);
  float body = 1.0 - smoothstep(1.0 - soft, 1.0 + 0.5 * soft, d);
  float shellW = 0.09 + 0.07 * lowP + 0.05 * (1.0 - gs);
  float shell = exp(-pow((d - 0.93) / shellW, 2.0));

  // ---------------------------------------------------------- blue reaction zone
  float baseMask = 1.0 - smoothstep(-0.2, 0.6, ay);
  float blueMask = mix(1.0, baseMask, 0.85 * gs);
  float blueAmt = (shell + mix(0.38, 0.15, gs) * body) * blueMask + 0.12 * shell * gs;
  vec3 blueCol = mix(vec3(0.16, 0.30, 1.0), vec3(0.29, 0.64, 1.0), shell); // --flame-blue

  // ---------------------------------------------------------- soot (yellow-orange)
  float sootAmt = clamp(0.10 + 0.90 * gs + 0.25 * fn * (1.0 - gs), 0.0, 1.0)
                * mix(0.55, 1.15, heat) * (1.0 - 0.75 * weak) * (1.0 - 0.25 * lowP);
  float sootZone = mix(1.0, smoothstep(-0.55, 0.25, ay), clamp(gs + 2.0 * fn, 0.0, 1.0));
  float darkZone = smoothstep(0.15, 0.6, length(p - W) / R);
  float wisps = mix(1.0, 0.65 + 0.7 * fbm(vec2(b * 2.2, a * 1.4 - u_phase * 3.0) + 11.0), gs);
  float sootD = pow(body, 1.4) * sootZone * darkZone * wisps;
  float t = sootD * (0.50 + 0.60 * heat) * (1.0 - 0.35 * smoothstep(0.2, 1.0, ay));

  // ---------------------------------------------------------- emission
  float I = mix(0.55, 1.3, heat) * mix(1.0, 0.62, lowP) * alive;
  vec3 sootEm = sootRamp(t) * sootD * sootAmt * 1.9;
  vec3 blueEm = blueCol * blueAmt * (0.50 + 0.35 * heat) * mix(1.0, 0.8, gs);
  vec3 glowCol = mix(blueCol * 0.7, vec3(1.0, 0.5, 0.15), clamp(sootAmt, 0.0, 1.0));
  float halo = exp(-max(d - 0.6, 0.0) * 2.6);
  float bloom = exp(-length(p - C - dir * R * (E - 1.0) * 0.4) * 4.0);
  vec3 em = (sootEm + blueEm) * I + glowCol * (0.16 * halo + 0.06 * bloom) * I;

  // ---------------------------------------------------------- backdrop: grid + vignette
  vec2 px = (frag - 0.5 * u_resolution) / u_dpr;
  float minor = max(gridLine(px.x, 28.0), gridLine(px.y, 28.0));
  float major = max(gridLine(px.x, 140.0), gridLine(px.y, 140.0));
  vec3 bg = vec3(0.027, 0.043, 0.078); // --bg
  bg += vec3(0.30, 0.45, 0.75) * (0.022 * minor + 0.045 * major);
  float vig = smoothstep(1.05, 0.25, length(p * vec2(0.85, 1.1)));
  bg *= mix(0.45, 1.0, vig);
  bg += glowCol * 0.05 * exp(-length(p - C) * 2.5) * I; // flame lights the backdrop

  // wick / fuel holder, entering from below
  float wd = sdSegment(p, W, W - vec2(0.0, 0.6)) - 0.0042;
  float px1 = 1.0 / u_resolution.y;
  float wickMask = 1.0 - smoothstep(-px1, px1, wd);
  vec3 col = mix(bg, vec3(0.05, 0.055, 0.07), wickMask * 0.92);
  em += vec3(1.0, 0.36, 0.08) * 0.5 * exp(-length(p - W) / (0.012 + 0.01 * heat)) * alive;

  // filmic compress of the emission only, so the dark backdrop stays true
  col += (1.0 - exp(-em * 1.3)) * (1.0 - 0.5 * wickMask);

  col += (hash12(frag + fract(u_time)) - 0.5) / 255.0; // dither against banding
  gl_FragColor = vec4(col, 1.0);
}
