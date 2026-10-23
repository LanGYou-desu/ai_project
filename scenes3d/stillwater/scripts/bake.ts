import { mkdir, writeFile } from 'node:fs/promises';
import { GI_BOUNDS } from '../src/scene/constants';
import { buildTriangleScene } from './lib/bake-common';
import { bakeGI, denoiseVolume, encodeHalfVolume } from './lib/bake-core';

interface Options {
  preview: boolean;
  dims: [number, number, number];
  spp: number;
  bounces: number;
  out: string;
  seed: number;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const get = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const preview = args.includes('--preview');
  const dimsArg = get('dims');
  const dims: [number, number, number] = preview
    ? [32, 24, 56]
    : dimsArg
      ? dimsArg.split('x').map(Number) as [number, number, number]
      : [56, 40, 96];
  return {
    preview,
    dims,
    spp: Number(get('spp') ?? (preview ? 32 : 64)),
    bounces: Number(get('bounces') ?? (preview ? 3 : 4)),
    out: get('out') ?? (preview ? 'preview' : ''),
    seed: Number(get('seed') ?? 1931),
  };
}

async function main() {
  const opts = parseArgs();
  const start = performance.now();
  console.log('STILLWATER light bake');
  console.log(`  mode: ${opts.preview ? 'preview' : 'final'}`);
  console.log(`  volume: ${opts.dims.join(' x ')}  (${(opts.dims[0] * opts.dims[1] * opts.dims[2] / 1000).toFixed(0)}k voxels)`);
  console.log(`  rays: ${opts.spp} spp, ${opts.bounces} bounces`);

  console.log('\nBuilding geometry and BVH…');
  const scene = buildTriangleScene();
  console.log(`  ${scene.count.toLocaleString()} triangles, ${scene.emitterIds.length} emissive surfaces`);
  console.log(`  ${scene.bvh.nodes.length.toLocaleString()} BVH nodes, emitter area ${scene.emitterTotalArea.toFixed(1)} m²`);
  console.log(`  geometry+BVH: ${((performance.now() - start) / 1000).toFixed(1)}s`);

  console.log('\nTracing ambient light…');
  const traceStart = performance.now();
  const data = bakeGI(scene, {
    dims: opts.dims,
    bounds: GI_BOUNDS,
    spp: opts.spp,
    bounces: opts.bounces,
    seed: opts.seed,
    zStart: 0,
    zEnd: opts.dims[2],
  }, (p) => {
    const now = performance.now();
    const elapsed = (now - traceStart) / 1000;
    const eta = p > 0.02 ? elapsed / p * (1 - p) : 0;
    process.stdout.write(`\r  ${(p * 100).toFixed(0).padStart(3)}%  ${elapsed.toFixed(0)}s elapsed  ~${eta.toFixed(0)}s remaining   `);
  });
  console.log(`\n  trace: ${((performance.now() - traceStart) / 1000).toFixed(1)}s`);

  console.log('Denoising…');
  denoiseVolume(data, opts.dims, 2);

  // Slight ambient floor so deep corners retain a trace of the room's colour.
  for (let i = 0; i < data.length; i += 3) {
    data[i] += 0.0018;
    data[i + 1] += 0.0026;
    data[i + 2] += 0.0025;
  }

  const half = encodeHalfVolume(data);
  const outDir = 'public/bake';
  await mkdir(outDir, { recursive: true });
  const base = `${outDir}/gi${opts.out ? `-${opts.out}` : ''}`;
  const info = {
    dims: opts.dims,
    min: GI_BOUNDS.min,
    max: GI_BOUNDS.max,
    spp: opts.spp,
    bounces: opts.bounces,
    format: 'RGBA16F',
    encoding: 'half-float linear radiance, alpha=1',
    generated: new Date().toISOString(),
  };
  await writeFile(`${base}.json`, JSON.stringify(info, null, 2));
  await writeFile(`${base}.bin`, Buffer.from(half.buffer));

  console.log(`\nWrote ${base}.bin (${(half.byteLength / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Total: ${((performance.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
