import { COLORS, WINDOW_Y, WINDOW_Z, type Color3, type Vec3 } from './constants';

export type EmitterGroup = 'left' | 'right' | 'sky' | 'portal' | 'sconce' | 'cove' | 'under';

export interface RectEmitter {
  id: string;
  group: EmitterGroup;
  center: Vec3;
  right: Vec3;
  up: Vec3;
  normal: Vec3;
  color: Color3;
  intensity: number;
  width: number;
  height: number;
  visible?: boolean;
}

const yMid = (WINDOW_Y[0] + WINDOW_Y[1]) / 2;
const yHalf = (WINDOW_Y[1] - WINDOW_Y[0]) / 2;

export function buildEmitters(): RectEmitter[] {
  const emitters: RectEmitter[] = [];

  WINDOW_Z.forEach((z, i) => {
    emitters.push({
      id: `window-left-${i}`,
      group: 'left',
      center: [-12.19, yMid, z],
      right: [0, 0, 0.58],
      up: [0, yHalf, 0],
      normal: [1, 0, 0],
      color: [1.0, 0.94, 0.84],
      intensity: 12.0,
      width: 1.16,
      height: yHalf * 2,
      visible: true,
    });
    emitters.push({
      id: `window-right-${i}`,
      group: 'right',
      center: [12.19, yMid, z],
      right: [0, 0, 0.58],
      up: [0, yHalf, 0],
      normal: [-1, 0, 0],
      color: [0.82, 0.91, 1.0],
      intensity: 7.6,
      width: 1.16,
      height: yHalf * 2,
      visible: true,
    });
  });

  // continuous skylight spine
  emitters.push({
    id: 'skylight',
    group: 'sky',
    center: [0, 18.18, -6.0],
    right: [1.06, 0, 0],
    up: [0, 0, 26.0],
    normal: [0, -1, 0],
    color: [0.88, 0.94, 1.0],
    intensity: 7.4,
    width: 2.12,
    height: 52.0,
    visible: true,
  });

  // far glass
  emitters.push({
    id: 'portal-main',
    group: 'portal',
    center: [0, 4.3, -32.3],
    right: [3.4, 0, 0],
    up: [0, 4.2, 0],
    normal: [0, 0, 1],
    color: [1.0, 0.72, 0.42],
    intensity: 6.2,
    width: 6.84,
    height: 8.4,
    visible: true,
  });
  emitters.push({
    id: 'portal-left',
    group: 'portal',
    center: [-8.0, 2.8, -32.3],
    right: [1.72, 0, 0],
    up: [0, 2.6, 0],
    normal: [0, 0, 1],
    color: [0.9, 0.95, 0.9],
    intensity: 3.2,
    width: 3.44,
    height: 5.2,
    visible: true,
  });
  emitters.push({
    id: 'portal-right',
    group: 'portal',
    center: [8.0, 2.8, -32.3],
    right: [-1.72, 0, 0],
    up: [0, 2.6, 0],
    normal: [0, 0, 1],
    color: [0.9, 0.95, 0.9],
    intensity: 3.2,
    width: 3.44,
    height: 5.2,
    visible: true,
  });

  // sconces along the outer walls
  const sconceZ = [-24.0, -16.5, -9.0, -1.5, 6.0, 13.5];
  for (const side of [-1, 1]) {
    for (let i = 0; i < sconceZ.length; i++) {
      const z = sconceZ[i];
      emitters.push({
        id: `sconce-${side}-${i}`,
        group: 'sconce',
        center: [side * 11.72, 4.75, z],
        right: [0, 0, 0.22],
        up: [0, 0.22, 0],
        normal: [-side, 0, 0],
        color: [1.0, 0.62, 0.32],
        intensity: 4.2,
        width: 0.44,
        height: 0.44,
        visible: true,
      });
    }
  }
  // Entrance sconces on the near wall.
  for (const side of [-1, 1]) {
    emitters.push({
      id: `sconce-entry-${side}`,
      group: 'sconce',
      center: [side * 4.85, 5.25, 19.7],
      right: [0.22, 0, 0],
      up: [0, 0.22, 0],
      normal: [0, 0, -1],
      color: [1.0, 0.62, 0.32],
      intensity: 4.2,
      width: 0.44,
      height: 0.44,
      visible: true,
    });
  }

  // warm cove washes at the springline of the vault
  for (const side of [-1, 1]) {
    emitters.push({
      id: `cove-${side}`,
      group: 'cove',
      center: [side * 11.64, 12.9, -6.0],
      right: [0, 0, 24.0],
      up: [0.12, 0, 0],
      normal: [0, 1, 0],
      color: [1.0, 0.68, 0.4],
      intensity: 5.0,
      width: 48.0,
      height: 0.24,
      visible: true,
    });
  }

  // underwater niche lights
  const under = [
    [-6.77, -1.55, -11.5, 1],
    [6.77, -1.55, -11.5, -1],
    [-6.77, -1.55, 2.5, 1],
    [6.77, -1.55, 2.5, -1],
  ] as const;
  under.forEach(([x, y, z, n], i) => {
    emitters.push({
      id: `under-${i}`,
      group: 'under',
      center: [x, y, z],
      right: [0, 0, 0.36],
      up: [0, 0.3, 0],
      normal: [n, 0, 0],
      color: [0.45, 0.92, 0.86],
      intensity: 3.4,
      width: 0.72,
      height: 0.6,
      visible: true,
    });
  });

  return emitters;
}

/** The strongest rectangle lights used for realtime ceramic highlights. */
export function specularLights(emitters: RectEmitter[]) {
  const wanted = new Set<string>([
    'window-left-1',
    'window-left-3',
    'window-left-5',
    'window-right-1',
    'window-right-3',
    'window-right-5',
    'skylight',
    'portal-main',
    'sconce--1-2',
    'sconce--1-3',
    'sconce-1-2',
    'sconce-1-3',
    'cove--1',
    'cove-1',
  ]);
  return emitters.filter((e) => wanted.has(e.id));
}

export const BEAM_GROUPS = [
  { key: 'left', color: [1.0, 0.78, 0.5], dir: [0.92, -0.38, 0.1], planeNormal: [1, 0, 0], planePoint: [-12, 0, 0] },
  { key: 'right', color: [0.62, 0.79, 1.0], dir: [-0.92, -0.34, -0.1], planeNormal: [-1, 0, 0], planePoint: [12, 0, 0] },
  { key: 'sky', color: [0.75, 0.88, 1.0], dir: [0, -1, 0], planeNormal: [0, 1, 0], planePoint: [0, 18.2, 0] },
  { key: 'portal', color: [1.0, 0.55, 0.26], dir: [0, 0, 1], planeNormal: [0, 0, 1], planePoint: [0, 0, -32] },
] as const;

export const PALETTE_TEAL = COLORS.teal;
