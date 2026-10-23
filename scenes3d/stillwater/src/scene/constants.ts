// The architecture is laid out in metres. Y is up.
// The long axis of the bathhouse runs along Z, the camera enters from +Z.

export const WATER_Y = -0.085;
export const DECK_Y = 0.0;

export const HALL = {
  xMin: -12.0,
  xMax: 12.0,
  zMin: -32.0,
  zMax: 20.0,
  vaultSpringY: 12.8,
  vaultCrownY: 17.3,
  vaultRadiusX: 12.0,
  slotHalf: 1.08,
  skylightY: 18.25,
};

export const POOL = {
  xMin: -8.6,
  xMax: 8.6,
  zMin: -25.0,
  zMax: 11.0,
  deepY: -2.35,
  ledgeY: -0.62,
  ledgeWidth: 1.25,
  // The wide submerged steps at the near end.
  stepZMin: 7.1,
  stepZMax: 11.0,
  stepCount: 5,
};

export const COLONNADE = {
  x: 9.9,
  columnHalf: 0.46,
  zStart: -27.5,
  zEnd: 16.5,
  spacing: 5.5,
  shaftTopY: 6.95,
  capitalTopY: 7.9,
  archSpringY: 5.45,
  archRadius: 2.29,
  entablatureBottomY: 7.9,
  entablatureTopY: 8.75,
};

export const WINDOW_Z = [-26, -19.5, -13, -6.5, 0, 6.5, 13];
export const WINDOW_Y = [9.45, 12.45];
export const WINDOW_WIDTH = 1.16;

export const WATER_LEVELS = {
  // used by the water composite; margin keeps the shoreline clipped neatly
  xMin: POOL.xMin + 0.045,
  xMax: POOL.xMax - 0.045,
  zMin: POOL.zMin + 0.045,
  zMax: POOL.zMax - 0.045,
};

export const GI_BOUNDS = {
  min: [-12.0, -2.7, -32.0] as [number, number, number],
  max: [12.0, 18.2, 20.0] as [number, number, number],
};

export const FOG_BOUNDS = {
  min: [-12.0, -2.7, -32.0] as [number, number, number],
  max: [12.0, 18.2, 20.0] as [number, number, number],
};

export const COLORS: Record<string, Color3> = {
  tile: [0.78, 0.775, 0.74],
  tileCool: [0.73, 0.75, 0.735],
  tileWarm: [0.81, 0.79, 0.745],
  grout: [0.49, 0.49, 0.46],
  teal: [0.05, 0.165, 0.155],
  tealLight: [0.08, 0.22, 0.205],
  poolTile: [0.07, 0.2, 0.185],
  paint: [0.81, 0.805, 0.765],
  chrome: [0.78, 0.79, 0.78],
  steelDark: [0.16, 0.17, 0.17],
  red: [0.72, 0.052, 0.034],
  redDeep: [0.4, 0.028, 0.02],
  yellow: [0.88, 0.56, 0.06],
  orange: [0.88, 0.25, 0.035],
  blue: [0.05, 0.18, 0.47],
  slide: [0.035, 0.26, 0.4],
  slideInside: [0.008, 0.065, 0.085],
  door: [0.07, 0.17, 0.16],
  black: [0.012, 0.014, 0.013],
};

export type Vec3 = [number, number, number];
export type Color3 = [number, number, number];
