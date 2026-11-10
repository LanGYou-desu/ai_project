import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function attrSignature(geometry) {
  return Object.keys(geometry.attributes)
    .sort()
    .map((key) => {
      const attr = geometry.attributes[key];
      return key + ':' + attr.itemSize + ':' + (attr.normalized ? 1 : 0);
    })
    .join('|') + '|index:' + (geometry.index ? 1 : 0);
}

function canMerge(mesh) {
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh) return false;
  if (Array.isArray(mesh.material)) return false;
  if (!mesh.geometry || !mesh.geometry.attributes || !mesh.geometry.attributes.position) return false;
  if (mesh.material.transparent || mesh.material.isShaderMaterial) return false;
  return true;
}

export function optimizeGroupChildren(group) {
  group.updateMatrixWorld(true);
  const groupInverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  let scanned = 0;

  function traverse(object, blocked) {
    for (const child of object.children) {
      const block = blocked || child.userData?.noMerge === true;
      if (!block && canMerge(child)) {
        scanned++;
        const attrs = attrSignature(child.geometry);
        const key = [child.material.uuid, attrs, child.castShadow ? 1 : 0, child.receiveShadow ? 1 : 0, child.renderOrder || 0].join('_');
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { material: child.material, cast: child.castShadow, receive: child.receiveShadow, renderOrder: child.renderOrder || 0, geos: [], meshes: [] };
          buckets.set(key, bucket);
        }
        const geo = child.geometry.clone();
        geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(groupInverse, child.matrixWorld));
        bucket.geos.push(geo);
        bucket.meshes.push(child);
      }
      if (!block) traverse(child, false);
    }
  }
  traverse(group, false);

  let created = 0, removed = 0;
  for (const bucket of buckets.values()) {
    if (bucket.geos.length < 2) {
      for (const geo of bucket.geos) geo.dispose();
      continue;
    }
    let merged;
    try { merged = mergeGeometries(bucket.geos, false); } catch (error) { merged = null; }
    if (!merged) {
      for (const geo of bucket.geos) geo.dispose();
      continue;
    }
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    mesh.renderOrder = bucket.renderOrder;
    mesh.name = 'merged-group-static';
    mesh.userData.merged = true;
    group.add(mesh);
    for (const geo of bucket.geos) geo.dispose();
    for (const source of bucket.meshes) {
      if (source.parent) source.parent.remove(source);
      removed++;
    }
    created++;
  }
  return { scanned, created, removed };
}

export function optimizeStaticWorld(root) {
  root.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  let scanned = 0;

  function traverse(object, blocked) {
    const block = blocked || object.userData?.noMerge === true;
    if (!block && object !== root && canMerge(object)) {
      scanned++;
      const mesh = object;
      const mat = mesh.material;
      const attrs = attrSignature(mesh.geometry);
      const key = [
        mat.uuid, attrs, mesh.castShadow ? 1 : 0, mesh.receiveShadow ? 1 : 0, mesh.renderOrder || 0
      ].join('_');
      let bucket = groups.get(key);
      if (!bucket) {
        bucket = { material: mat, cast: mesh.castShadow, receive: mesh.receiveShadow, renderOrder: mesh.renderOrder || 0, geos: [], meshes: [], merged: false };
        groups.set(key, bucket);
      }
      const geo = mesh.geometry.clone();
      const world = new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);
      geo.applyMatrix4(world);
      bucket.geos.push(geo);
      bucket.meshes.push(mesh);
    }
    for (const child of object.children) traverse(child, block);
  }
  traverse(root, false);

  let created = 0;
  let removed = 0;
  for (const bucket of groups.values()) {
    if (bucket.geos.length < 2) {
      // Keep lone meshes exactly where they were; their originals remain in the scene graph.
      for (const geo of bucket.geos) geo.dispose();
      continue;
    }
    let merged;
    try {
      merged = mergeGeometries(bucket.geos, false);
    } catch (error) {
      merged = null;
    }
    if (!merged) {
      for (const geo of bucket.geos) geo.dispose();
      continue;
    }
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    mesh.renderOrder = bucket.renderOrder;
    mesh.name = 'merged-static';
    mesh.userData.merged = true;
    root.add(mesh);
    created++;
    for (const geo of bucket.geos) geo.dispose();
    for (const source of bucket.meshes) {
      if (source.parent) source.parent.remove(source);
      removed++;
    }
  }

  return { scanned, created, removed, total: root.children.length };
}
