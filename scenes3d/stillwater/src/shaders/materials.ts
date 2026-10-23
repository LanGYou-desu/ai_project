import { FRAG_HEADER } from './surface';

export const TILE_FRAG = /* glsl */ `
${FRAG_HEADER}

void main() {
  clipBelowWater();
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 P = vWorld;
  vec3 V = normalize(cameraPosition - P);
  vec3 Ns = N;

  float tsize = max(vTile, 0.001);
  vec2 tuv;
  if (abs(N.y) > 0.62) {
    tuv = P.xz;
  } else if (abs(N.x) > abs(N.z)) {
    tuv = vec2(P.z, P.y);
  } else {
    tuv = vec2(P.x, P.y);
  }
  // The barrel vault needs a cylindrical parameterisation or the planar
  // projection above breaks into a woven diamond pattern across the crown.
  float vaultMask = smoothstep(12.62, 12.78, P.y) * (1.0 - smoothstep(0.35, 0.75, abs(N.z)));
  float arcU = asin(clamp(P.x / 12.0, -1.0, 1.0)) * 8.66;
  tuv = mix(tuv, vec2(arcU, P.z), vaultMask);
  vec2 q = tuv / tsize;
  vec2 cell = floor(q);
  vec2 f = fract(q);
  float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
  float aa = max(fwidth(edge), 0.0008);
  float grout = 1.0 - smoothstep(0.020 - aa, 0.052 + aa, edge);
  float far = smoothstep(0.15, 0.55, aa);

  float tealness = 1.0 - smoothstep(0.16, 0.5, vColor.r);
  vec2 h2 = hash22(cell + 3.17);
  float h = h2.x;
  vec3 tileColor = vColor * (0.976 + 0.048 * h);
  tileColor *= mix(vec3(0.995, 1.0, 1.0), vec3(1.012, 1.0, 0.985), h2.y);
  vec3 groutColor = mix(vColor * 0.7, vColor * 0.5, tealness);

  vec3 albedo = mix(tileColor, groutColor, grout * 0.85);
  vec3 avg = mix(vColor * 0.99, groutColor, 0.22);
  albedo = mix(albedo, avg, far * 0.92);

  float tileRough = mix(0.13, 0.175, h) + 0.012 * fbm3(P * 2.7);
  tileRough = mix(tileRough, 0.155, tealness * 0.35);
  tileRough = mix(tileRough, 0.155, far * 0.85);
  float roughness = mix(tileRough, 0.68, grout);
  roughness = mix(roughness, 0.28, far * 0.8);

  // Grime and patina. Vertical streaks are stronger on walls.
  float grime = fbm4(vec3(P.x * 1.35, P.y * 0.55, P.z * 1.35));
  float streak = fbm3(vec3((P.x + P.z) * 3.7, P.y * 0.24, 7.13));
  float wallness = 1.0 - abs(N.y);
  albedo *= 1.0 - (smoothstep(0.48, 0.78, grime) * 0.045 + smoothstep(0.58, 0.85, streak) * 0.035) * (0.4 + wallness);
  roughness += smoothstep(0.55, 0.85, streak) * 0.09 * wallness;

  // Mineral line and wet band around the water.
  float nearWater = exp(-abs(P.y - uWaterY - 0.015) * 38.0);
  float mineral = smoothstep(0.36, 0.7, fbm3(vec3(P.x * 2.4, P.y * 4.0, P.z * 2.4)));
  albedo = mix(albedo, vec3(0.2, 0.215, 0.175), nearWater * mineral * 0.3);
  roughness = mix(roughness, 0.46, nearWater * 0.55);
  float wet = smoothstep(0.5, 0.02, P.y - uWaterY) * step(uWaterY, P.y);
  albedo *= 1.0 - wet * 0.09;
  roughness *= 1.0 - wet * 0.33;

  // Tile bevel, micro relief and per-tile tilt. High-frequency relief is
  // faded by its screen-space footprint so distance tiles stay calm.
  float bevel = smoothstep(0.028, 0.11, edge);
  float microAA = length(fwidth(P * 310.0));
  float microFade = 1.0 - smoothstep(0.28, 1.35, microAA);
  float micro = fbm3(P * 310.0) - 0.5;
  float height = (bevel * 0.00085 + micro * 0.000045 * microFade) * (1.0 - far * 0.85);
  N = perturbNormal(N, P, height);
  vec2 tilt = (h2 - 0.5) * 0.0025 * (1.0 - far) * (1.0 - far);
  N = normalize(N + vec3(tilt.x, 0.0, tilt.y) * (1.0 - grout));

  // Material-level contact darkening in the grout.
  albedo *= mix(0.88, 1.0, 1.0 - grout * 0.9);

  bool submerged = P.y < uWaterY - 0.002;
  vec3 gi = sampleGI(P, N);
  if (submerged) gi *= 0.6;
  vec3 directDiffuse = allRectDiffuse(P, N);
  if (submerged) directDiffuse *= 0.34;
  vec3 diffuse = albedo * (gi + directDiffuse * 0.62) * (1.0 - far * 0.05);

  // Caustics on every submerged surface.
  if (submerged) {
    vec2 cp = abs(N.y) > 0.55 ? P.xz : vec2(P.x + P.z, P.y * 0.92);
    float ca = causticField(cp * 1.7, uTime * 0.72);
    ca = pow(clamp(ca, 0.0, 1.0), 1.4) * 0.34 * smoothstep(0.22, 0.7, tealness);
    float depthFade = smoothstep(0.0, 0.5, uWaterY - P.y);
    diffuse += albedo * ca * mix(vec3(0.36, 0.55, 0.5), vec3(0.7, 0.86, 0.8), 0.44) * (0.28 + depthFade * 0.28);
    diffuse *= 0.72;
  }

  float NoV = clamp(dot(N, V), 1e-4, 1.0);
  vec3 F0 = vec3(0.04);
  float glossFade = mix(1.0 - grout * 0.55, 0.97, far);
  // Evaluate the glossy lobe on a single, smooth roughness. Per-tile roughness
  // and micro-normals turn the large area sources into glittering sand.
  float specRough = mix(0.24, 0.68, grout);
  specRough = mix(specRough, 0.3, far * 0.8);
  vec3 spec = allRectSpec(P, Ns, V, F0, specRough) * glossFade * 0.4;
  vec3 R = reflect(-V, Ns);
  vec3 env = sampleEnv(R, max(roughness, 0.36)) * fresnelRough(NoV, F0, roughness) * 0.7 * glossFade;

  vec3 color = diffuse + spec + env;
  fragColor = vec4(color, 1.0);
}
`;

export const PAINT_FRAG = /* glsl */ `
${FRAG_HEADER}

void main() {
  clipBelowWater();
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 P = vWorld;
  vec3 V = normalize(cameraPosition - P);
  float tealness = 1.0 - smoothstep(0.16, 0.5, vColor.r);

  float n1 = fbm4(P * 1.15);
  float n2 = fbm3(vec3(P.x * 4.0, P.y * 1.2, P.z * 4.0));
  float height = (n1 - 0.5) * 0.00055 + (n2 - 0.5) * 0.00009;
  N = perturbNormal(N, P, height);

  vec3 albedo = vColor * (0.93 + 0.1 * n1);
  albedo *= 1.0 - smoothstep(0.58, 0.85, n2) * 0.045;
  float roughness = mix(0.58, 0.4, tealness) + 0.08 * n1;

  float nearWater = exp(-abs(P.y - uWaterY - 0.02) * 34.0);
  albedo = mix(albedo, albedo * 0.62, nearWater * 0.35);

  vec3 gi = sampleGI(P, N);
  vec3 diffuse = albedo * (gi + allRectDiffuse(P, N) * 0.62);
  float NoV = clamp(dot(N, V), 1e-4, 1.0);
  vec3 F0 = vec3(0.04);
  vec3 spec = allRectSpec(P, N, V, F0, roughness);
  vec3 R = reflect(-V, N);
  vec3 env = sampleEnv(R, roughness) * fresnelRough(NoV, F0, roughness) * 0.55;
  fragColor = vec4(diffuse + spec + env, 1.0);
}
`;

export const METAL_FRAG = /* glsl */ `
${FRAG_HEADER}

void main() {
  clipBelowWater();
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 P = vWorld;
  vec3 V = normalize(cameraPosition - P);
  float tarnish = fbm4(P * 3.1);
  float brushed = fbm3(vec3(P.x * 180.0, P.y * 3.0, P.z * 180.0));
  vec3 base = vColor * mix(0.74, 1.0, tarnish);
  float roughness = clamp(0.1 + tarnish * 0.16 + brushed * 0.03, 0.06, 0.42);
  N = perturbNormal(N, P, (brushed - 0.5) * 0.00007);

  float NoV = clamp(dot(N, V), 1e-4, 1.0);
  vec3 F0 = mix(vec3(0.62, 0.64, 0.62), base, 0.62);
  vec3 R = reflect(-V, N);
  vec3 F = fresnelRough(NoV, F0, roughness);
  vec3 env = sampleEnv(R, roughness) * F;
  vec3 spec = allRectSpec(P, N, V, F0, max(roughness, 0.045));
  vec3 color = env + spec + base * 0.012;
  fragColor = vec4(color, 1.0);
}
`;

export const PLASTIC_FRAG = /* glsl */ `
${FRAG_HEADER}

void main() {
  clipBelowWater();
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 P = vWorld;
  vec3 V = normalize(cameraPosition - P);

  float vv = fract(vUv.y);
  float seamDist = min(abs(vv - 0.25), abs(vv - 0.75));
  float seam = 1.0 - smoothstep(0.0, 0.035, seamDist);
  float uu = fract(vUv.x);
  float uDist = min(uu, 1.0 - uu);
  seam = max(seam, (1.0 - smoothstep(0.0, 0.007, uDist)) * 0.6);

  float wrinkle = fbm4(vec3(P.x * 5.0, P.y * 5.0, P.z * 5.0));
  float height = seam * 0.0009 + (wrinkle - 0.5) * 0.00032;
  N = perturbNormal(N, P, height);

  float wet = smoothstep(0.42, 0.0, P.y - uWaterY) * step(uWaterY, P.y);
  vec3 albedo = vColor * (0.92 + 0.1 * wrinkle);
  albedo = mix(albedo, albedo * 0.62, wet * 0.55);
  albedo *= 1.0 - seam * 0.3;
  float roughness = 0.22 + wrinkle * 0.06 + seam * 0.12 - wet * 0.12;
  roughness = clamp(roughness, 0.1, 0.5);

  vec3 gi = sampleGI(P, N);
  vec3 diffuse = albedo * (gi + allRectDiffuse(P, N) * 0.7);
  float NoV = clamp(dot(N, V), 1e-4, 1.0);
  vec3 F0 = vec3(0.05);
  vec3 spec = allRectSpec(P, N, V, F0, roughness) * (1.0 - seam * 0.4);
  spec += allRectSpec(P, N, V, vec3(0.04), 0.035) * 0.5;
  vec3 R = reflect(-V, N);
  vec3 env = sampleEnv(R, roughness) * fresnelRough(NoV, F0, roughness);
  env += sampleEnv(R, 0.025) * fresnelRough(NoV, vec3(0.04), 0.025) * 0.5;
  fragColor = vec4(diffuse + spec + env, 1.0);
}
`;

export const SLIDE_FRAG = /* glsl */ `
${FRAG_HEADER}

void main() {
  clipBelowWater();
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 P = vWorld;
  vec3 V = normalize(cameraPosition - P);

  float peel = fbm3(vec3(vUv.x * 320.0, vUv.y * 22.0, 2.4));
  float broad = fbm3(P * 2.2);
  N = perturbNormal(N, P, (peel - 0.5) * 0.00018 + (broad - 0.5) * 0.00012);

  float wet = smoothstep(0.35, 0.0, P.y - uWaterY) * step(uWaterY, P.y);
  vec3 albedo = vColor * (0.96 + 0.06 * broad);
  albedo = mix(albedo, albedo * 0.55, wet * 0.6);
  float roughness = 0.15 + 0.05 * broad - wet * 0.06;
  roughness = clamp(roughness, 0.08, 0.3);

  vec3 gi = sampleGI(P, N);
  vec3 diffuse = albedo * (gi + allRectDiffuse(P, N) * 0.7);
  float NoV = clamp(dot(N, V), 1e-4, 1.0);
  vec3 F0 = vec3(0.055);
  vec3 spec = allRectSpec(P, N, V, F0, roughness);
  spec += allRectSpec(P, N, V, vec3(0.04), 0.05) * 0.6;
  vec3 R = reflect(-V, N);
  vec3 env = sampleEnv(R, roughness) * fresnelRough(NoV, F0, roughness) * 1.15;
  env += sampleEnv(R, 0.03) * fresnelRough(NoV, vec3(0.04), 0.03) * 0.4;
  fragColor = vec4(diffuse + spec + env, 1.0);
}
`;

export const EMISSIVE_FRAG = /* glsl */ `
${FRAG_HEADER}

void main() {
  clipBelowWater();
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 P = vWorld;
  vec3 V = normalize(cameraPosition - P);
  float frost = fbm3(P * 2.1);
  float fine = fbm3(P * 11.0);
  vec3 c = vColor * (0.93 + frost * 0.12 + fine * 0.035);
  float ndv = abs(dot(N, V));
  c *= 1.0 + pow(1.0 - ndv, 2.5) * 0.28;
  fragColor = vec4(c, 1.0);
}
`;

export const DECAL_FRAG = /* glsl */ `
${FRAG_HEADER}
uniform sampler2D tDecal;
uniform float uDecalEmissive;
uniform vec3 uDecalTint;

void main() {
  clipBelowWater();
  vec4 t = texture(tDecal, vUv);
  if (t.a < 0.015) discard;
  vec3 c = pow(t.rgb, vec3(2.2));
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  if (uDecalEmissive > 0.5) {
    c = c * uDecalTint * uDecalEmissive;
  } else {
    vec3 gi = sampleGI(vWorld + N * 0.05, N);
    float g = dot(gi, vec3(0.333));
    c *= (0.35 + 1.05 * g);
  }
  fragColor = vec4(c, t.a);
}
`;
