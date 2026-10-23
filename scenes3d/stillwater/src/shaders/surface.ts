export const MAX_LIGHTS = 14;

export const VERT = /* glsl */ `
in vec3 color;
in float aTileSize;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec2 vUv;
out float vTile;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vColor = color;
  vUv = uv;
  vTile = aTileSize;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const COMMON_UNIFORMS = /* glsl */ `
uniform float uTime;
uniform float uWaterY;
uniform float uClipWater;
uniform float uGIReady;
uniform sampler3D uGI;
uniform vec3 uGIMin;
uniform vec3 uGIInvRange;
uniform float uGIGain;
uniform float uEnvEnabled;
uniform samplerCube uEnv;
uniform float uEnvIntensity;

uniform int uLightCount;
uniform vec3 uLightCenter[${MAX_LIGHTS}];
uniform vec3 uLightRight[${MAX_LIGHTS}];
uniform vec3 uLightUp[${MAX_LIGHTS}];
uniform vec3 uLightNormal[${MAX_LIGHTS}];
uniform vec3 uLightColor[${MAX_LIGHTS}];
`;

export const COMMON_FUNCS = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash12(i.xy + i.z * 17.13);
  float n100 = hash12(i.xy + vec2(1.0, 0.0) + i.z * 17.13);
  float n010 = hash12(i.xy + vec2(0.0, 1.0) + i.z * 17.13);
  float n110 = hash12(i.xy + vec2(1.0, 1.0) + i.z * 17.13);
  float n001 = hash12(i.xy + (i.z + 1.0) * 17.13);
  float n101 = hash12(i.xy + vec2(1.0, 0.0) + (i.z + 1.0) * 17.13);
  float n011 = hash12(i.xy + vec2(0.0, 1.0) + (i.z + 1.0) * 17.13);
  float n111 = hash12(i.xy + vec2(1.0, 1.0) + (i.z + 1.0) * 17.13);
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}
float fbm3(vec3 p) {
  float a = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    a += vnoise(p) * amp;
    p = p * 2.03 + 17.1;
    amp *= 0.5;
  }
  return a;
}
float fbm4(vec3 p) {
  float a = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    a += vnoise(p) * amp;
    p = p * 2.03 + 17.1;
    amp *= 0.5;
  }
  return a;
}
float fbm2d(vec2 p) {
  return vnoise(vec3(p, 0.37));
}

// Standard screen-space bump mapping.
vec3 perturbNormal(vec3 N, vec3 P, float h) {
  vec3 dpdx = dFdx(P);
  vec3 dpdy = dFdy(P);
  float dhdx = dFdx(h);
  float dhdy = dFdy(h);
  vec3 r1 = cross(dpdy, N);
  vec3 r2 = cross(N, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  return normalize(abs(det) * N - grad);
}

float D_GGX(float NoH, float a) {
  float a2 = a * a;
  float d = NoH * NoH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d + 1e-7);
}
float V_SmithGGX(float NoV, float NoL, float a) {
  float a2 = a * a;
  float gv = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2);
  float gl = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
  return 0.5 / (gv + gl + 1e-6);
}
vec3 fresnelSchlick(float c, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - c, 0.0, 1.0), 5.0);
}
vec3 fresnelRough(float c, vec3 F0, float rough) {
  return F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(clamp(1.0 - c, 0.0, 1.0), 5.0);
}

vec3 sampleGI(vec3 P, vec3 N) {
  if (uGIReady < 0.5) {
    vec3 amb = mix(vec3(0.035, 0.052, 0.048), vec3(0.14, 0.16, 0.15), clamp(N.y * 0.5 + 0.5, 0.0, 1.0));
    return amb;
  }
  vec3 q = P + N * 0.12;
  vec3 uvw = clamp((q - uGIMin) * uGIInvRange, vec3(0.001), vec3(0.999));
  return texture(uGI, uvw).rgb * uGIGain;
}

// Approximate diffuse irradiance from the strong rectangular sources. The baked
// volume provides the soft bounce; this restores the crisp window modelling.
vec3 rectLightDiffuse(
  vec3 P, vec3 N,
  vec3 C, vec3 Rh, vec3 Uh, vec3 Ln, vec3 Lc
) {
  float planeDist = dot(C - P, Ln);
  if (planeDist >= -0.01) return vec3(0.0);
  vec3 Q = P + Ln * planeDist;
  vec3 d = Q - C;
  vec2 local = vec2(dot(d, Rh) / max(dot(Rh, Rh), 1e-5), dot(d, Uh) / max(dot(Uh, Uh), 1e-5));
  local = clamp(local, -1.0, 1.0);
  Q = C + Rh * local.x + Uh * local.y;
  vec3 Lv = Q - P;
  float dist2 = max(dot(Lv, Lv), 0.08);
  vec3 L = Lv * inversesqrt(dist2);
  float NoL = max(dot(N, L), 0.0);
  float cosL = max(dot(Ln, -L), 0.0);
  if (NoL <= 0.0 || cosL <= 0.0) return vec3(0.0);
  float area = 4.0 * length(Rh) * length(Uh);
  float solid = area * cosL / (dist2 + area * 0.3);
  return Lc * NoL * solid / PI;
}

vec3 allRectDiffuse(vec3 P, vec3 N) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uLightCount) break;
    s += rectLightDiffuse(P, N, uLightCenter[i], uLightRight[i], uLightUp[i], uLightNormal[i], uLightColor[i]);
  }
  return s;
}

vec3 sampleEnv(vec3 R, float rough) {
  if (uEnvEnabled < 0.5) return vec3(0.012, 0.016, 0.015);
  float lod = clamp(rough * 7.0, 0.0, 7.0);
  return textureLod(uEnv, R, lod).rgb * uEnvIntensity;
}

// Approximate rectangular area light, using the closest point on the source.
vec3 rectLightSpec(
  vec3 P, vec3 N, vec3 V, vec3 F0, float rough,
  vec3 C, vec3 Rh, vec3 Uh, vec3 Ln, vec3 Lc
) {
  vec3 Rdir = reflect(-V, N);
  float denom = dot(Rdir, Ln);
  if (denom > -0.03) return vec3(0.0);
  float t = dot(C - P, Ln) / denom;
  if (t < 0.0) return vec3(0.0);
  vec3 Q = P + Rdir * t;
  vec3 d = Q - C;
  vec2 local = vec2(dot(d, Rh) / max(dot(Rh, Rh), 1e-5), dot(d, Uh) / max(dot(Uh, Uh), 1e-5));
  local = clamp(local, -1.0, 1.0);
  Q = C + Rh * local.x + Uh * local.y;
  vec3 Lv = Q - P;
  float dist2 = max(dot(Lv, Lv), 0.05);
  vec3 L = Lv * inversesqrt(dist2);
  float NoL = max(dot(N, L), 0.0);
  float NoV = max(dot(N, V), 1e-4);
  if (NoL <= 0.0) return vec3(0.0);
  vec3 H = normalize(V + L);
  float NoH = max(dot(N, H), 0.0);
  float VoH = max(dot(V, H), 0.0);
  float a = max(rough * rough, 0.0025);
  float D = D_GGX(NoH, a);
  float Vis = V_SmithGGX(NoV, NoL, a);
  vec3 F = fresnelSchlick(VoH, F0);
  float area = 4.0 * length(Rh) * length(Uh);
  float solid = area * max(dot(Ln, -L), 0.0) / (dist2 + area * 0.35);
  float spec = D * Vis * NoL;
  return F * Lc * spec * solid;
}

vec3 allRectSpec(vec3 P, vec3 N, vec3 V, vec3 F0, float rough) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uLightCount) break;
    s += rectLightSpec(P, N, V, F0, rough, uLightCenter[i], uLightRight[i], uLightUp[i], uLightNormal[i], uLightColor[i]);
  }
  return s;
}

// Caustics as the bright walls between drifting Voronoi cells. Two scales
// break up the cells; a slow low-frequency mask keeps the network irregular.
float causticLayer(vec2 p, float t) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      o = 0.5 + 0.5 * sin(t * 0.55 + TAU * o);
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
  float edge = sqrt(d2) - sqrt(d1);
  return exp(-edge * 9.0);
}

float causticPattern(vec2 p, float t) {
  float a = causticLayer(p, t);
  float b = causticLayer(p * 1.87 + vec2(13.1, -7.7), t * 1.27 + 2.3);
  float mask = 0.74 + 0.26 * fbm2d(p * 0.29 + vec2(t * 0.02, -t * 0.015));
  return (a * 0.8 + b * 0.42) * mask;
}

float causticField(vec2 p, float t) {
  return causticPattern(p, t);
}

float tileHash(vec2 cell, float seed) {
  return hash12(cell * vec2(1.0, 1.0) + seed * 17.31);
}
`;

export const FRAG_HEADER = /* glsl */ `
precision highp float;
precision highp sampler3D;

in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec2 vUv;
in float vTile;

out vec4 fragColor;

${COMMON_UNIFORMS}
${COMMON_FUNCS}

void clipBelowWater() {
  if (uClipWater > 0.5 && vWorld.y < uWaterY - 0.015) discard;
}
`;
