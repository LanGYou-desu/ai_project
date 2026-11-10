import * as THREE from 'three';

export function createWaterMaterial(options = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(options.deep || '#2f7f83') },
    uShallow: { value: new THREE.Color(options.shallow || '#77c9c0') },
    uSky: { value: new THREE.Color(options.sky || '#aad9dc') },
    uSunColor: { value: new THREE.Color('#ffe8bd') },
    uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
    uSunIntensity: { value: 1 },
    uOpacity: { value: options.opacity ?? 0.88 },
    uWaveScale: { value: options.waveScale ?? 1 }
  };

  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: [
      'uniform float uTime;',
      'uniform float uWaveScale;',
      'varying vec3 vWorldPos;',
      'varying vec2 vUv;',
      'void main() {',
      '  vec3 p = position;',
      '  float wave = sin(p.x * 1.75 + uTime * 1.05) * 0.028;',
      '  wave += cos(p.z * 2.15 - uTime * 0.78) * 0.019;',
      '  wave += sin((p.x + p.z) * 3.2 + uTime * 0.45) * 0.009;',
      '  p.y += wave * uWaveScale;',
      '  vec4 world = modelMatrix * vec4(p, 1.0);',
      '  vWorldPos = world.xyz;',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * viewMatrix * world;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime;',
      'uniform vec3 uDeep;',
      'uniform vec3 uShallow;',
      'uniform vec3 uSky;',
      'uniform vec3 uSunColor;',
      'uniform vec3 uSunDirection;',
      'uniform float uSunIntensity;',
      'uniform float uOpacity;',
      'uniform float uWaveScale;',
      'varying vec3 vWorldPos;',
      'varying vec2 vUv;',
      'void main() {',
      '  vec2 p = vWorldPos.xz;',
      '  float w1 = sin(p.x * 2.3 + p.y * 0.8 + uTime * 1.2) * 0.5 + 0.5;',
      '  float w2 = cos(p.y * 2.8 - p.x * 0.5 - uTime * 0.9) * 0.5 + 0.5;',
      '  vec3 n = normalize(vec3(0.055 * sin(p.x * 1.8 + uTime), 1.0, 0.055 * cos(p.y * 2.2 - uTime * 1.1)));',
      '  vec3 viewDir = normalize(cameraPosition - vWorldPos);',
      '  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.2);',
      '  vec3 color = mix(uDeep, uShallow, clamp(0.22 + w1 * 0.34 + w2 * 0.18, 0.0, 1.0));',
      '  color = mix(color, uSky, fresnel * 0.42);',
      '  vec3 sunDir = normalize(uSunDirection);',
      '  vec3 halfDir = normalize(sunDir + viewDir);',
      '  float spec = pow(max(dot(n, halfDir), 0.0), 80.0) * uSunIntensity;',
      '  color += uSunColor * spec * 0.52;',
      '  float shimmer = smoothstep(0.86, 1.0, sin(p.x * 1.25 + p.y * 2.15 - uTime * 0.72) * 0.5 + 0.5);',
      '  color += uSunColor * shimmer * 0.035 * uSunIntensity;',
      '  float edge = smoothstep(0.0, 0.05, uOpacity);',
      '  gl_FragColor = vec4(color, uOpacity * edge);',
      '}'
    ].join('\n')
  });
}

export function createRiverRibbon(points, width, material, options = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.35);
  const segments = options.segments || 72;
  const vertices = [];
  const uvs = [];
  const indices = [];
  const left = [];
  const right = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    tangent.y = 0;
    tangent.normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const w = typeof width === 'function' ? width(t) : width;
    const l = point.clone().addScaledVector(side, w * 0.5);
    const r = point.clone().addScaledVector(side, -w * 0.5);
    l.y += 0.012;
    r.y += 0.012;
    left.push(l);
    right.push(r);
    vertices.push(l.x, l.y, l.z, r.x, r.y, r.z);
    uvs.push(0, t * (options.vRepeat || 3), 1, t * (options.vRepeat || 3));
    if (i < segments) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  mesh.renderOrder = 3;
  return { mesh, curve, left, right };
}

export function createWaterfallPlane(width, height, material) {
  const geo = new THREE.PlaneGeometry(width, height, 10, 24);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 4;
  return mesh;
}
