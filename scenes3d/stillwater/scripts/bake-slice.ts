import { writeFile } from 'node:fs/promises';
import { GI_BOUNDS } from '../src/scene/constants';
import { buildTriangleScene } from './lib/bake-common';
import { bakeGI } from './lib/bake-core';

interface SliceOptions {
  dims: [number, number, number];
  spp: number;
  bounces: number;
  seed: number;
  zStart: number;
  zEnd: number;
  out: string;
}

function parseArgs(): SliceOptions {
  const args = process.argv.slice(2);
  const get = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const dims = (get('dims') ?? '56x40x96').split('x').map(Number) as [number, number, number];
  return {
    dims,
    spp: Number(get('spp') ?? 64),
    bounces: Number(get('bounces') ?? 4),
    seed: Number(get('seed') ?? 1931),
    zStart: Number(get('zstart') ?? 0),
    zEnd: Number(get('zend') ?? dims[2]),
    out: get('out') ?? 'slice.bin',
  };
}

async function main() {
  const opts = parseArgs();
  const scene = buildTriangleScene();
  const data = bakeGI(scene, {
    dims: opts.dims,
    bounds: GI_BOUNDS,
    spp: opts.spp,
    bounces: opts.bounces,
    seed: opts.seed,
    zStart: opts.zStart,
    zEnd: opts.zEnd,
  });
  await writeFile(opts.out, Buffer.from(data.buffer));
  console.log(`slice ${opts.zStart}-${opts.zEnd} complete (${data.byteLength} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
