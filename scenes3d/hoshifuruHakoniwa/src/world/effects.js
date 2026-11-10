import * as THREE from 'three';
import { mulberry32, clamp, TAU } from '../utils.js';

function createSmokeSystem(anchor, textures, rng, index) {
  const particles = [];
  const group = new THREE.Group();
  group.position.copy(anchor);
  const count = 5;
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: textures.smoke,
      color: '#eae6d9',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(0.3);
    group.add(sprite);
    particles.push({
      sprite,
      phase: i / count + rng() * 0.1,
      drift: (rng() - 0.5) * 0.45,
      size: 0.55 + rng() * 0.5,
      speed: 0.055 + rng() * 0.025
    });
  }
  return { group, particles, index };
}

function createBird(lib) {
  const bird = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#3f4b4e', roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), bodyMat);
  body.scale.set(0.72, 0.65, 1.8);
  body.castShadow = false;
  bird.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), bodyMat);
  head.position.set(0, 0.03, 0.15);
  bird.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.13, 4), new THREE.MeshStandardMaterial({ color: '#c49a5c', roughness: 0.8 }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.01, 0.25);
  bird.add(beak);
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, 0.07, 0.55, 0.06, -0.1, 0, 0, -0.14
  ]), 3));
  wingGeo.setIndex([0, 1, 2]);
  wingGeo.computeVertexNormals();
  const leftWing = new THREE.Mesh(wingGeo, bodyMat);
  leftWing.position.set(-0.05, 0.02, 0);
  leftWing.rotation.z = 0.15;
  bird.add(leftWing);
  const rightWing = leftWing.clone();
  rightWing.scale.x = -1;
  rightWing.position.x = 0.05;
  rightWing.rotation.z = -0.15;
  bird.add(rightWing);
  bird.userData = { leftWing, rightWing };
  bird.scale.setScalar(1.4);
  return bird;
}

function createFlock(lib, center, radius, phase, count = 6) {
  const group = new THREE.Group();
  const birds = [];
  for (let i = 0; i < count; i++) {
    const bird = createBird(lib);
    bird.userData.offset = new THREE.Vector3((i - count / 2) * 0.52, (i % 2) * 0.12, Math.abs(i - count / 2) * 0.36);
    bird.userData.phase = i * 1.3;
    group.add(bird);
    birds.push(bird);
  }
  return { group, birds, center, radius, phase };
}

function createFireflies(textures) {
  const rng = mulberry32(0xf1e55);
  const count = 170;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const clusters = [
    [-11.0, 3.6, 1.4], [-7.0, -1.8, 2.2], [3.5, 4.6, 1.2],
    [6.6, -3.7, 1.2], [-3.4, 0.9, 1.6], [11.0, 2.1, 0.8],
    [1.2, 6.5, 0.9], [-13.0, -1.5, 1.0]
  ];
  for (let i = 0; i < count; i++) {
    const c = clusters[i % clusters.length];
    const a = rng() * TAU;
    const r = Math.sqrt(rng()) * 1.25;
    positions[i * 3] = c[0] + Math.cos(a) * r;
    positions[i * 3 + 1] = c[2] + 0.25 + rng() * 0.9;
    positions[i * 3 + 2] = c[1] + Math.sin(a) * r;
    phases[i] = rng() * TAU;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: [
      'uniform float uTime;',
      'uniform float uPixelRatio;',
      'attribute float aPhase;',
      'varying float vAlpha;',
      'void main() {',
      '  vec3 p = position;',
      '  p.x += sin(uTime * 0.45 + aPhase) * 0.35;',
      '  p.z += cos(uTime * 0.31 + aPhase * 1.7) * 0.32;',
      '  p.y += sin(uTime * 0.62 + aPhase * 2.2) * 0.18;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_PointSize = (14.0 + sin(uTime * 2.1 + aPhase) * 3.0) * uPixelRatio * (1.0 / -mv.z) * 12.0;',
      '  vAlpha = smoothstep(-0.6, 0.5, sin(uTime * 1.6 + aPhase));',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uOpacity;',
      'varying float vAlpha;',
      'void main() {',
      '  vec2 c = gl_PointCoord - vec2(0.5);',
      '  float d = length(c);',
      '  float alpha = smoothstep(0.5, 0.0, d);',
      '  alpha *= alpha;',
      '  vec3 col = mix(vec3(0.82, 1.0, 0.52), vec3(1.0, 0.87, 0.44), c.y + 0.5);',
      '  gl_FragColor = vec4(col, alpha * uOpacity * (0.35 + vAlpha * 0.65));',
      '}'
    ].join('\n')
  });
  const points = new THREE.Points(geo, mat);
  points.renderOrder = 5;
  return { points, material: mat };
}

export function createEffects(lib, smokeAnchors) {
  const group = new THREE.Group();
  group.name = 'effects';
  const rng = mulberry32(0x9182a1);
  const smokeSystems = [];
  smokeAnchors.slice(0, 9).forEach((anchor, i) => {
    const system = createSmokeSystem(anchor, lib.textures, rng, i);
    group.add(system.group);
    smokeSystems.push(system);
  });
  const flocks = [
    createFlock(lib, new THREE.Vector3(-3, 11.8, -2), 9.0, 0.2, 7),
    createFlock(lib, new THREE.Vector3(7, 9.8, -5), 6.0, 2.4, 5)
  ];
  flocks.forEach((flock) => group.add(flock.group));
  const fireflies = createFireflies(lib.textures);
  group.add(fireflies.points);

  function update(dt, elapsed, state) {
    smokeSystems.forEach((system) => {
      system.particles.forEach((particle) => {
        const t = (elapsed * particle.speed + particle.phase) % 1;
        particle.sprite.position.set(particle.drift * t * 2.4 + Math.sin(t * 7 + particle.phase * 9) * 0.1, t * 2.2, Math.cos(t * 5.3 + particle.phase * 7) * 0.16);
        const size = particle.size * (0.55 + t * 1.8);
        particle.sprite.scale.set(size, size, 1);
        particle.sprite.material.opacity = Math.sin(t * Math.PI) * (0.22 + (state.nightFactor || 0) * 0.05);
        particle.sprite.material.color.set('#e9e4d8').lerp(new THREE.Color('#6f7c88'), (state.nightFactor || 0) * 0.35);
      });
    });
    flocks.forEach((flock, index) => {
      const theta = elapsed * (0.065 + index * 0.012) + flock.phase;
      flock.group.position.set(
        flock.center.x + Math.cos(theta) * flock.radius,
        flock.center.y + Math.sin(elapsed * 0.55 + index) * 0.6,
        flock.center.z + Math.sin(theta) * flock.radius * 0.55
      );
      flock.group.rotation.y = -theta + Math.PI / 2;
      flock.group.visible = state.nightFactor < 0.82;
      flock.birds.forEach((bird) => {
        const flap = Math.sin(elapsed * 8 + bird.userData.phase) * 0.65;
        bird.userData.leftWing.rotation.z = 0.15 + flap;
        bird.userData.rightWing.rotation.z = -0.15 - flap;
        bird.position.set(
          bird.userData.offset.x + Math.sin(elapsed * 0.7 + bird.userData.phase) * 0.2,
          bird.userData.offset.y + Math.sin(elapsed * 1.1 + bird.userData.phase) * 0.16,
          bird.userData.offset.z
        );
        bird.rotation.z = Math.sin(elapsed * 0.9 + bird.userData.phase) * 0.08;
      });
    });
    fireflies.material.uniforms.uTime.value = elapsed;
    fireflies.material.uniforms.uOpacity.value = clamp((state.nightFactor || 0) * 0.92, 0, 0.92);
  }
  return { group, update, smokeSystems, flocks, fireflies };
}
