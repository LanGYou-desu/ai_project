import * as THREE from 'three';

export function applyBoxUV(geometry, scale = 2, offset = [0, 0]) {
  const pos = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));
    let u, v;
    if (nx >= ny && nx >= nz) {
      u = pos.getZ(i) / scale + offset[0];
      v = pos.getY(i) / scale + offset[1];
    } else if (ny >= nx && ny >= nz) {
      u = pos.getX(i) / scale + offset[0];
      v = pos.getZ(i) / scale + offset[1];
    } else {
      u = pos.getX(i) / scale + offset[0];
      v = pos.getY(i) / scale + offset[1];
    }
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geometry;
}

export function applyPlaneUV(geometry, scale = 2, offset = [0, 0]) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / scale + offset[0], pos.getY(i) / scale + offset[1]);
  }
  uv.needsUpdate = true;
  return geometry;
}

export function boxGeometry(w, h, d, {
  scale = 2,
  offset = [0, 0],
  segments = 1,
  segmentsY = segments,
  segmentsX = segments,
  segmentsZ = segments
} = {}) {
  const geo = new THREE.BoxGeometry(w, h, d, segmentsX, segmentsY, segmentsZ);
  applyBoxUV(geo, scale, offset);
  return geo;
}

export function planeGeometry(w, h, {
  scale = 2,
  offset = [0, 0],
  segmentsX = 1,
  segmentsY = 1,
  uvScaled = true
} = {}) {
  const geo = new THREE.PlaneGeometry(w, h, segmentsX, segmentsY);
  if (uvScaled) applyPlaneUV(geo, scale, offset);
  return geo;
}

export function boxGeometryRaw(w, h, d, segments = 1) {
  return new THREE.BoxGeometry(w, h, d, segments, segments, segments);
}

export function cylinderGeometry(radiusTop, radiusBottom, height, {
  radial = 16,
  heightSegments = 1,
  scale = 2,
  openEnded = false
} = {}) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radial, heightSegments, openEnded);
  const uv = geo.attributes.uv;
  const circumference = Math.PI * (radiusTop + radiusBottom);
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * circumference / scale, uv.getY(i) * height / scale);
  }
  uv.needsUpdate = true;
  return geo;
}

export function sphereGeometry(radius, {
  widthSegments = 12,
  heightSegments = 8,
  scale = 2
} = {}) {
  const geo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  const uv = geo.attributes.uv;
  const circumference = Math.PI * 2 * radius;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * circumference / scale, uv.getY(i) * Math.PI * radius / scale);
  }
  uv.needsUpdate = true;
  return geo;
}

const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _matrix = new THREE.Matrix4();

export function pipeGeometryBetween(a, b, radius, {
  radial = 10,
  scale = 2,
  uvOffset = 0
} = {}) {
  _dir.subVectors(b, a);
  const len = _dir.length();
  if (len < 0.0001) return null;
  const geo = cylinderGeometry(radius, radius, len, { radial, heightSegments: 1, scale });
  _quat.setFromUnitVectors(UP, _dir.clone().normalize());
  _mid.addVectors(a, b).multiplyScalar(.5);
  _matrix.compose(_mid, _quat, new THREE.Vector3(1, 1, 1));
  geo.applyMatrix4(_matrix);
  return geo;
}

export function horizontalCylinderAt(x, y, z, length, radius, axis = 'x', options = {}) {
  const geo = cylinderGeometry(radius, radius, length, options);
  if (axis === 'x') geo.rotateZ(Math.PI / 2);
  else if (axis === 'z') geo.rotateX(Math.PI / 2);
  geo.translate(x, y, z);
  return geo;
}

export function torusGeometry(radius, tube, radialSegments = 8, tubularSegments = 16, arc = Math.PI * 2) {
  return new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments, arc);
}

export function planeMesh(w, h, material, {
  x = 0, y = 0, z = 0,
  rx = 0, ry = 0, rz = 0,
  scale = 1,
  offset = [0, 0],
  segmentsX = 1,
  segmentsY = 1,
  uvScaled = true
} = {}) {
  const geo = planeGeometry(w, h, { scale, offset, segmentsX, segmentsY, uvScaled });
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}

export function setShadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

export function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        // Shared materials are owned by MaterialLibrary; only dispose unique clones here when flagged.
        if (mat.userData?.disposeWithObject) mat.dispose();
      }
    }
  });
}

export function makeInstancedMesh(geometry, material, transforms, { castShadow = false, receiveShadow = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  transforms.forEach((t, i) => {
    q.setFromEuler(t.rotation || new THREE.Euler());
    s.set(t.scale?.x ?? 1, t.scale?.y ?? 1, t.scale?.z ?? 1);
    m.compose(t.position, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}
