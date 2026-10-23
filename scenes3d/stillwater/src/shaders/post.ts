import { WATER_LEVELS, WATER_Y, POOL } from '../scene/constants';

export const FULLSCREEN_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const WATER_FRAG = /* glsl */ `
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tReflection;
uniform mat4 uInvProjection;
uniform mat4 uCameraWorld;
uniform mat4 uReflVP;
uniform vec2 uResolution;
uniform float uTime;
uniform float uReflectionReady;
uniform float uWaterY;
uniform float uDebugMask;
uniform vec4 uPool; // xmin xmax zmin zmax
uniform vec3 uFoamCenters[12];
uniform int uFoamCount;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float wave(vec2 p, vec2 dir, float freq, float speed, float phase) {
  return sin(dot(p, dir) * freq + uTime * speed + phase);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float causticLayer(vec2 p, float t) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      o = 0.5 + 0.5 * sin(t * 0.55 + 6.2831853 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return exp(-(sqrt(d2) - sqrt(d1)) * 9.0);
}
float causticPattern(vec2 p, float t) {
  float a = causticLayer(p, t);
  float b = causticLayer(p * 1.87 + vec2(13.1, -7.7), t * 1.27 + 2.3);
  return a * 0.8 + b * 0.42;
}

vec3 waveNormal(vec2 p, float dist, out float crest) {
  vec2 slope = vec2(0.0);
  float detailFade = smoothstep(26.0, 3.0, dist);
  float amp = 1.0;
  // Long, soft swells.
  vec2 dirs[8] = vec2[8](
    vec2(0.94, 0.34), vec2(-0.66, 0.75), vec2(0.31, -0.95), vec2(-0.86, -0.51),
    vec2(0.72, -0.69), vec2(0.12, 0.99), vec2(-0.98, 0.21), vec2(0.55, 0.83)
  );
  float freqs[8] = float[8](1.24, 1.87, 2.83, 4.15, 5.95, 8.2, 12.4, 17.8);
  float speeds[8] = float[8](0.32, -0.44, 0.55, -0.67, 0.83, -1.02, 1.22, -1.45);
  float amps[8] = float[8](0.014, 0.010, 0.007, 0.005, 0.0032, 0.0022, 0.0014, 0.0009);
  // Distant water gets larger, sparser swells.
  float distScale = mix(1.0, 2.25, smoothstep(8.0, 34.0, dist));
  for (int i = 0; i < 8; i++) {
    float fade = (i < 4 ? 1.0 : detailFade);
    float f = freqs[i] / distScale;
    float a = amps[i] * distScale * fade;
    float ph = dot(p, dirs[i]) * f + uTime * speeds[i] * (0.7 + float(i) * 0.05) + float(i) * 1.63;
    slope += dirs[i] * cos(ph) * a * f;
    crest += sin(ph) * a;
  }
  // Wind-driven fine ripples, faded with distance.
  vec2 gp = p * 3.6 + vec2(uTime * 0.24, -uTime * 0.17);
  float n0 = vnoise(gp);
  float nx = vnoise(gp + vec2(0.08, 0.0));
  float nz = vnoise(gp + vec2(0.0, 0.08));
  slope += vec2(nx - n0, nz - n0) * 0.34 * detailFade;

  // Ring-shaped ripples around floaters and the red totem.
  for (int i = 0; i < 12; i++) {
    if (i >= uFoamCount) break;
    vec2 d = p - uFoamCenters[i].xy;
    float r = length(d) + 0.0001;
    float rad = 0.8 + float(i) * 0.13;
    float env = exp(-abs(r - rad) * 0.9) * exp(-r * 0.055);
    float phase = r * 9.0 - uTime * 1.9 + float(i) * 1.7;
    float waveAmp = (0.003 + 0.002 * sin(float(i) * 2.2)) * env;
    slope += (d / r) * cos(phase) * waveAmp;
    crest += sin(phase) * waveAmp * 3.0;
  }

  // Calm the surface right at the coping.
  vec2 inside = min(p - uPool.xy, uPool.zw - p);
  float edge = smoothstep(0.0, 0.55, min(inside.x, inside.y));
  slope *= mix(0.42, 1.0, edge);
  return normalize(vec3(-slope.x, 1.0, -slope.y));
}

void main() {
  vec3 scene = texture(tScene, vUv).rgb;
  float depth = texture(tDepth, vUv).r;
  vec4 ndc = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 view = uInvProjection * ndc;
  view.xyz /= view.w;
  vec3 world = (uCameraWorld * vec4(view.xyz, 1.0)).xyz;

  vec3 col = scene;
  float thickness = uWaterY - world.y;
  vec2 inside = min(world.xz - uPool.xy, uPool.zw - world.xz);
  float inPool = smoothstep(-0.025, 0.015, min(inside.x, inside.y));
  float valid = inPool * step(0.002, thickness) * step(depth, 0.99999) * step(world.y, uWaterY);
  if (uDebugMask > 0.5) {
    fragColor = vec4(inPool, valid, clamp(thickness * 0.4, 0.0, 1.0), 1.0);
    return;
  }
  if (valid > 0.001) {
    vec3 V = normalize(cameraPosition - world);
    float dist = length(cameraPosition - world);
    float crest = 0.0;
    vec3 N = waveNormal(world.xz, dist, crest);

    float NoV = clamp(dot(N, V), 0.001, 1.0);
    float fres = 0.018 + 0.982 * pow(1.0 - NoV, 5.0);
    fres = clamp(fres, 0.0, 1.0);

    // Screen-space refraction. Blur more where the water is deep and far away;
    // this hides the sharp tile grid and reads as a volume rather than a wet floor.
    float rippleScale = (0.0045 + 0.008 * smoothstep(0.0, 1.6, thickness)) / (1.0 + dist * 0.04);
    vec2 refrUv = clamp(vUv + N.xz * rippleScale, vec2(0.001), vec2(0.999));
    vec2 refrStep = vec2(rippleScale * 3.0);
    vec3 refracted = texture(tScene, refrUv).rgb * 0.36;
    refracted += texture(tScene, clamp(refrUv + N.xz * refrStep.x + vec2(refrStep.y, 0.0), vec2(0.001), vec2(0.999))).rgb * 0.16;
    refracted += texture(tScene, clamp(refrUv - N.xz * refrStep.x - vec2(refrStep.y, 0.0), vec2(0.001), vec2(0.999))).rgb * 0.16;
    refracted += texture(tScene, clamp(refrUv + vec2(refrStep.y, -refrStep.x), vec2(0.001), vec2(0.999))).rgb * 0.16;
    refracted += texture(tScene, clamp(refrUv - vec2(refrStep.y, -refrStep.x), vec2(0.001), vec2(0.999))).rgb * 0.16;

    // Clear water absorbs red first, leaving the characteristic green-teal.
    // The basin reads as a dark, mineral volume, not a glassy floor.
    vec3 absorb = exp(-thickness * vec3(1.95, 0.8, 0.58));
    float scatterAmt = 1.0 - exp(-thickness * 0.95);
    vec3 deepCol = vec3(0.0035, 0.024, 0.026);
    // Subtle caustic shimmer inside the water volume.
    float caustic = causticPattern(world.xz * 1.5, uTime * 0.56);
    deepCol += vec3(0.005, 0.026, 0.024) * caustic * smoothstep(-0.04, 0.3, -crest);
    vec3 waterBody = refracted * absorb + deepCol * scatterAmt;
    // A faint cold veil keeps the volume from reading black in the deep end.
    waterBody += vec3(0.012, 0.055, 0.056) * scatterAmt * 0.12;

    // Reflection, projected through the mirrored camera and distorted by the surface.
    vec4 rclip = uReflVP * vec4(world + vec3(0.0, 0.02, 0.0), 1.0);
    vec2 reflBase = rclip.xy / max(rclip.w, 0.0001) * 0.5 + 0.5;
    vec2 reflWarp = N.xz * (0.026 + 0.034 * smoothstep(0.0, 1.4, thickness)) / (1.0 + dist * 0.045);
    vec2 reflUv = clamp(reflBase + reflWarp, vec2(0.001), vec2(0.999));
    vec3 reflected = texture(tReflection, reflUv).rgb;
    // Extra taps along the ripple slope smear bright highlights into the long
    // liquid streaks seen in the reference photographs.
    reflected += texture(tReflection, clamp(reflUv + reflWarp * 1.65 + vec2(0.0, 0.006), vec2(0.001), vec2(0.999))).rgb;
    reflected += texture(tReflection, clamp(reflUv - reflWarp * 1.65 - vec2(0.0, 0.006), vec2(0.001), vec2(0.999))).rgb;
    reflected *= 0.3333;
    reflected *= mix(vec3(0.78, 0.94, 0.92), vec3(0.98, 1.0, 1.0), smoothstep(0.15, 1.0, fres));
    reflected *= 0.92;

    // Sharp glints: skylight and the two window strips.
    vec3 R = reflect(-V, N);
    vec3 skylightDir = normalize(vec3(0.16, 1.0, 0.11));
    vec3 Hsky = normalize(V + skylightDir);
    float nh = max(dot(N, Hsky), 0.0);
    float glintSky = pow(nh, 900.0) * 5.0 + pow(nh, 140.0) * 0.24;
    float shimmer = smoothstep(0.38, 0.88, vnoise(world.xz * 17.0 + uTime * 0.3));
    vec3 glint = vec3(1.1, 1.18, 1.12) * glintSky * (0.3 + shimmer * 0.7);
    vec3 wl = normalize(vec3(-0.78, 0.52, -0.34));
    vec3 wr = normalize(vec3(0.74, 0.5, 0.1));
    float wlSpec = pow(max(dot(N, normalize(V + wl)), 0.0), 420.0);
    float wrSpec = pow(max(dot(N, normalize(V + wr)), 0.0), 480.0);
    glint += vec3(1.3, 1.0, 0.72) * (wlSpec + wrSpec) * (0.25 + shimmer * 0.75) * 2.6;

    float mirror = clamp(fres * 1.22 + 0.055, 0.0, 0.94);
    vec3 color = mix(waterBody, reflected, mirror) + glint;

    // Shoreline and contact foam, plus foam collars around the floaters.
    float edgeDist = min(inside.x, inside.y);
    float foamNoise = vnoise(world.xz * 6.0 + vec2(uTime * 0.13, -uTime * 0.1));
    float edgeFoam = (1.0 - smoothstep(0.015, 0.24 + foamNoise * 0.1, edgeDist)) * smoothstep(0.42, 0.75, foamNoise);
    float contact = 0.0;
    float contactShade = 0.0;
    for (int i = 0; i < 12; i++) {
      if (i >= uFoamCount) break;
      vec2 d = world.xz - uFoamCenters[i].xy;
      float r = length(d);
      float edgeR = uFoamCenters[i].z;
      float collar = smoothstep(edgeR * 0.97, edgeR * 1.0, r) * (1.0 - smoothstep(edgeR * 1.03, edgeR * 1.09, r));
      contact += collar * smoothstep(0.42, 0.86, foamNoise);
      contactShade = max(contactShade, 1.0 - smoothstep(edgeR * 0.8, edgeR * 1.35, r));
    }
    color *= 1.0 - contactShade * 0.22;
    float foam = clamp(edgeFoam * 0.62 + contact * 0.14, 0.0, 0.58);
    color = mix(color, vec3(0.72, 0.76, 0.69) * (0.35 + 0.4 * foamNoise), foam * 0.2);

    // Slight darkening at the very shoreline.
    color *= 1.0 - (1.0 - smoothstep(0.0, 0.08, edgeDist)) * 0.2;
    col = mix(scene, color, valid);
  }

  fragColor = vec4(col, 1.0);
}
`;

export const ATMO_FRAG = /* glsl */ `
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform mat4 uInvProjection;
uniform mat4 uCameraWorld;
uniform vec2 uResolution;
uniform float uTime;
uniform float uAtmoStrength;
uniform float uAtmoFade;
uniform sampler3D uFog;
uniform float uFogReady;
uniform vec3 uFogMin;
uniform vec3 uFogInvRange;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1,0,0));
  float n010 = hash13(i + vec3(0,1,0));
  float n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1));
  float n101 = hash13(i + vec3(1,0,1));
  float n011 = hash13(i + vec3(0,1,1));
  float n111 = hash13(i + vec3(1,1,1));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float fbm3(vec3 p) {
  float a = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    a += vnoise3(p) * amp;
    p = p * 2.07 + 13.1;
    amp *= 0.5;
  }
  return a;
}
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
// The clerestory windows sit every 6.5 m; this mask selects their light shafts.
float windowBand(float z) {
  float phase = z * 0.96664;
  return smoothstep(0.56, 0.965, 0.5 + 0.5 * cos(phase));
}

void main() {
  vec3 scene = texture(tScene, vUv).rgb;
  float depth = texture(tDepth, vUv).r;
  vec4 ndc = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 view = uInvProjection * ndc;
  view.xyz /= view.w;
  vec3 world = (uCameraWorld * vec4(view.xyz, 1.0)).xyz;

  vec3 ray = world - cameraPosition;
  float sceneDist = length(ray);
  vec3 rd = ray / max(sceneDist, 0.0001);
  if (depth > 0.99999) sceneDist = 55.0;

  const int STEPS = 24;
  float stepLen = sceneDist / float(STEPS);
  vec3 acc = vec3(0.0);
  float trans = 1.0;
  float t = stepLen * 0.35;

  for (int i = 0; i < STEPS; i++) {
    vec3 p = cameraPosition + rd * t;
    float h = clamp((p.y + 2.4) / 20.6, 0.0, 1.0);
    float base = 0.009 + 0.016 * exp(-h * 3.2);
    float wisps = fbm3(p * vec3(0.11, 0.075, 0.11) + vec3(0.0, -uTime * 0.011, uTime * 0.006));
    float density = base * (0.5 + wisps * 0.62) * uAtmoFade;
    density *= smoothstep(-0.2, 1.4, p.y);

    vec3 inscatter = vec3(0.0);
    if (uFogReady > 0.5) {
      vec3 fuv = clamp((p - uFogMin) * uFogInvRange, vec3(0.0), vec3(1.0));
      vec4 f = texture(uFog, fuv);
      inscatter = f.rgb * (0.35 + 0.9 * f.a) * f.a;
    }

    // Soft analytic skylight column. The baked fog supplies the detailed shafts.
    float skyDistance = abs(p.x + (p.y - 18.2) * 0.11);
    float skyBeam = exp(-skyDistance * skyDistance * 0.5) * smoothstep(1.0, 5.5, 18.2 - p.y);
    skyBeam *= smoothstep(-0.4, 2.2, p.y) * (0.55 + 0.45 * vnoise3(p * 0.35 + uTime * 0.018));
    inscatter += vec3(0.34, 0.48, 0.47) * skyBeam * 0.012;

    // Angled shafts from the clerestory windows. Two broad slabs are enough
    // to read as separate beams; the windowBand mask gives them their rhythm.
    for (int s = 0; s < 2; s++) {
      float side = s == 0 ? -1.0 : 1.0;
      vec3 L = normalize(vec3(side * 0.82, -0.57, -side * 0.04));
      vec3 rel = p - vec3(side * 12.0, 10.95, p.z);
      float along = dot(rel, L);
      if (along > 0.0) {
        vec3 V = normalize(cross(L, vec3(0.0, 0.0, 1.0)));
        float perpY = dot(rel, V);
        float halfH = 1.5 + along * 0.035;
        float beam = exp(-pow(perpY / halfH, 2.0) * 3.4);
        beam *= windowBand(p.z);
        beam *= smoothstep(0.0, 2.0, along);
        beam *= exp(-along * 0.028);
        beam *= smoothstep(-0.4, 1.4, p.y);
        vec3 tint = side < 0.0 ? vec3(1.0, 0.78, 0.5) : vec3(0.62, 0.8, 1.0);
        inscatter += tint * beam * 0.065;
      }
    }

    // Warm haze from the far vestibule.
    float porta = exp(-length(p - vec3(0.0, 2.5, -32.0)) * 0.13);
    inscatter += vec3(0.7, 0.36, 0.15) * porta * 0.013;

    float stepTrans = exp(-density * stepLen);
    acc += inscatter * density * stepLen * trans;
    trans *= stepTrans;
    t += stepLen;
  }

  scene = scene * trans + acc * uAtmoStrength;

  // Subtle cold shadow on the extreme flanks, warm center — a filmic grade done in light.
  float luma = dot(scene, vec3(0.2126, 0.7152, 0.0722));
  scene = mix(scene, scene * vec3(0.93, 1.015, 1.02), smoothstep(0.0, 0.5, luma) * 0.35);

  fragColor = vec4(scene, 1.0);
}
`;

export const BRIGHT_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D tSource;
uniform vec2 uTexel;
uniform float uThreshold;
void main() {
  vec3 c = texture(tSource, vUv + uTexel * vec2(-0.5, -0.5)).rgb;
  c += texture(tSource, vUv + uTexel * vec2(0.5, -0.5)).rgb;
  c += texture(tSource, vUv + uTexel * vec2(-0.5, 0.5)).rgb;
  c += texture(tSource, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  c *= 0.25;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float knee = uThreshold * 0.55;
  float soft = clamp((l - uThreshold + knee) / (2.0 * knee + 0.0001), 0.0, 1.0);
  soft = soft * soft * knee;
  float contribution = max(l - uThreshold, 0.0) + soft;
  contribution /= max(l, 0.0001);
  fragColor = vec4(c * contribution, 1.0);
}
`;

export const BLUR_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D tSource;
uniform vec2 uDirection;
void main() {
  vec2 uv = vUv;
  vec3 c = texture(tSource, uv).rgb * 0.227027;
  c += texture(tSource, uv + uDirection * 1.3846).rgb * 0.316216;
  c += texture(tSource, uv - uDirection * 1.3846).rgb * 0.316216;
  c += texture(tSource, uv + uDirection * 3.2308).rgb * 0.070270;
  c += texture(tSource, uv - uDirection * 3.2308).rgb * 0.070270;
  fragColor = vec4(c, 1.0);
}
`;

export const DEBUG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D tSource;
uniform float uGamma;
void main() {
  vec3 c = texture(tSource, vUv).rgb;
  c = c / (c + vec3(1.0));
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  fragColor = vec4(c, 1.0);
}
`;

export const FINAL_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tDepth;
uniform vec2 uResolution;
uniform float uTime;
uniform float uExposure;
uniform float uBloomStrength;
uniform float uGrain;
uniform float uFade;
uniform float uVignette;
uniform float uChroma;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 aces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
void main() {
  vec2 uv = vUv;
  vec2 centered = uv - 0.5;
  float r2 = dot(centered, centered);

  // Very subtle spherical/chromatic aberration at the edges.
  float ab = uChroma * r2;
  vec3 scene;
  scene.r = texture(tScene, uv - centered * ab).r;
  scene.g = texture(tScene, uv).g;
  scene.b = texture(tScene, uv + centered * ab).b;
  vec3 bloom = texture(tBloom, uv).rgb;
  scene += bloom * uBloomStrength;

  vec3 hdrCenter = scene * uExposure;
  scene = aces(hdrCenter);

  // Compact FXAA pass on the tonemapped image. The tiled architecture produces
  // dense high-frequency grout lines; a light edge blend keeps them from
  // shimmering while leaving the film grain intact.
  vec2 texel = 1.0 / uResolution;
  vec3 nw = aces(texture(tScene, uv + vec2(-1.0, -1.0) * texel).rgb * uExposure);
  vec3 ne = aces(texture(tScene, uv + vec2(1.0, -1.0) * texel).rgb * uExposure);
  vec3 sw = aces(texture(tScene, uv + vec2(-1.0, 1.0) * texel).rgb * uExposure);
  vec3 se = aces(texture(tScene, uv + vec2(1.0, 1.0) * texel).rgb * uExposure);
  float lumaM = dot(scene, vec3(0.299, 0.587, 0.114));
  float lumaNW = dot(nw, vec3(0.299, 0.587, 0.114));
  float lumaNE = dot(ne, vec3(0.299, 0.587, 0.114));
  float lumaSW = dot(sw, vec3(0.299, 0.587, 0.114));
  float lumaSE = dot(se, vec3(0.299, 0.587, 0.114));
  float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
  float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
  float range = lumaMax - lumaMin;
  if (range > max(0.045, lumaMax * 0.17)) {
    vec2 dir = vec2(
      -((lumaNW + lumaNE) - (lumaSW + lumaSE)),
      ((lumaNW + lumaSW) - (lumaNE + lumaSE))
    );
    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.25 * 0.03125, 1.0 / 128.0);
    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = clamp(dir * rcpDirMin, vec2(-8.0), vec2(8.0)) * texel;
    vec3 rgbA = 0.5 * (
      aces(texture(tScene, uv + dir * 0.5).rgb * uExposure) +
      aces(texture(tScene, uv - dir * 0.5).rgb * uExposure)
    );
    vec3 rgbB = rgbA * 0.5 + 0.25 * (
      aces(texture(tScene, uv + dir * 2.0).rgb * uExposure) +
      aces(texture(tScene, uv - dir * 2.0).rgb * uExposure)
    );
    float lumaB = dot(rgbB, vec3(0.299, 0.587, 0.114));
    float lumaA = dot(rgbA, vec3(0.299, 0.587, 0.114));
    bool useB = lumaB >= lumaMin && lumaB <= lumaMax;
    vec3 fxaa = useB ? rgbB : rgbA;
    // Weight the correction so crisp grout detail and intentional edges survive.
    float edge = smoothstep(0.045, 0.2, range);
    scene = mix(scene, mix(scene, fxaa, 0.72), edge);
  }

  // Film grade: cool shadows, warm cream highlights.
  float luma = dot(scene, vec3(0.2126, 0.7152, 0.0722));
  vec3 shadowTint = vec3(0.88, 0.965, 0.98);
  vec3 highTint = vec3(1.045, 1.01, 0.95);
  vec3 tint = mix(shadowTint, highTint, smoothstep(0.05, 0.8, luma));
  scene *= tint;
  scene = mix(scene, scene * vec3(0.96, 1.0, 0.995), 0.2);

  // Gentle S-curve and a touch of saturation: glazed tile needs richer
  // midtones than a linear tonemap gives.
  scene = clamp(scene, 0.0, 1.0);
  scene = mix(scene, scene * scene * (3.0 - 2.0 * scene), 0.16);
  float afterLuma = dot(scene, vec3(0.2126, 0.7152, 0.0722));
  scene = mix(vec3(afterLuma), scene, 1.06);

  // Vignette.
  float vig = 1.0 - uVignette * smoothstep(0.12, 0.72, r2 + 0.08);
  scene *= vig;

  // Fine 35mm grain, strongest in the mids.
  float grain = hash12(gl_FragCoord.xy + fract(uTime) * 311.7) - 0.5;
  float grainMask = 0.55 + 0.45 * smoothstep(0.0, 0.35, luma) * smoothstep(1.0, 0.55, luma);
  scene += grain * uGrain * grainMask;

  // sRGB transfer (the final pass writes to the default framebuffer).
  scene = max(scene, vec3(0.0));
  scene = pow(scene, vec3(1.0 / 2.2));

  // Slight black lift, keeps the shadows from crushing on OLEDs.
  scene = scene * 0.985 + vec3(0.006, 0.008, 0.007);
  scene *= uFade;
  fragColor = vec4(scene, 1.0);
}
`;
