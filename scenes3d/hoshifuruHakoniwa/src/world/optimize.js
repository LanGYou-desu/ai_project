import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function attributeSignature(geometry) {
  if (!geometry || !geometry.attributes) return 'none';
  const attrs = Object.keys(geometry.attributes).sort().map((key) => {
    const a = geometry.attributes[key];
    return key + ':' + a.itemSize + ':' + (a.normalized ? 1 : 0);
  });
  return attrs.join('|') + ':' + (geometry.index ? 'indexed' : 'unindexed');
}

function groupKey(mesh) {
  return [
    mesh.material.uuid,
    mesh.castShadow ? 1 : 0,
    mesh.receiveShadow ? 1 : 0,
    mesh.renderOrder || 0,
    attributeSignature(mesh.geometry)
  ].join('::');
}

function mergeGroups(meshes, targetParent, transformInverse) {
  const groups = new Map();
  meshes.forEach((mesh) => {
    if (!mesh.geometry || Array.isArray(mesh.material) || !mesh.material || mesh.isInstancedMesh || mesh.isSkinnedMesh) return;
    const key = groupKey(mesh);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  });

  let removed = 0;
  let created = 0;
  groups.forEach((items) => {
    if (items.length < 2) return;
    const geometries = [];
    for (const mesh of items) {
      let geometry;
      try {
        geometry = mesh.geometry.clone();
        if (transformInverse) {
          const relative = new THREE.Matrix4().multiplyMatrices(transformInverse, mesh.matrixWorld);
          geometry.applyMatrix4(relative);
        } else {
          geometry.applyMatrix4(mesh.matrixWorld);
        }
        geometries.push(geometry);
      } catch (error) {
        if (geometry) geometry.dispose();
      }
    }
    if (geometries.length < 2) {
      geometries.forEach((g) => g.dispose());
      return;
    }
    let merged = null;
    try {
      merged = mergeGeometries(geometries, false);
    } catch (error) {
      merged = null;
    }
    geometries.forEach((g) => g.dispose());
    if (!merged) return;
    const source = items[0];
    const mesh = new THREE.Mesh(merged, source.material);
    mesh.castShadow = source.castShadow;
    mesh.receiveShadow = source.receiveShadow;
    mesh.renderOrder = source.renderOrder || 0;
    mesh.name = 'merged-static';
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    targetParent.add(mesh);
    created++;
    items.forEach((item) => {
      if (item.parent) item.parent.remove(item);
      removed++;
    });
  });
  return { removed, created };
}

function isNoMerge(object) {
  let current = object;
  while (current) {
    if (current.userData && current.userData.noMerge) return true;
    current = current.parent;
  }
  return false;
}

function mergeTree(tree) {
  tree.updateMatrixWorld(true);
  const meshes = [];
  tree.traverse((object) => {
    if (object === tree) return;
    if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh) return;
    if (Array.isArray(object.material)) return;
    meshes.push(object);
  });
  if (meshes.length < 2) return;
  const inverse = tree.matrixWorld.clone().invert();
  mergeGroups(meshes, tree, inverse);
  tree.userData.noMerge = true;
}

export function optimizeStaticWorld(root) {
  root.updateMatrixWorld(true);
  const trees = [];
  root.traverse((object) => {
    if (object.userData && object.userData.isTree) trees.push(object);
  });
  trees.forEach(mergeTree);
  root.updateMatrixWorld(true);

  const meshes = [];
  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh) return;
    if (Array.isArray(object.material)) return;
    if (isNoMerge(object)) return;
    if (object.userData && object.userData.dynamic) return;
    meshes.push(object);
  });
  const result = mergeGroups(meshes, root, null);
  root.updateMatrixWorld(true);
  return { ...result, trees: trees.length };
}
