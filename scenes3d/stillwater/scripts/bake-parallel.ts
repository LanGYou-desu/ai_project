import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { GI_BOUNDS } from '../src/scene/constants';
import { denoiseVolume, encodeHalfVolume } from './lib/bake-core';

interface Options {
  dims: [number, number, number];
  spp: number;
  bounces: number;
  seed: number;
  workers: number;
  passes: number;
  out: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const get = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const dims = (get('dims') ?? '56x40x96').split('x').map(Number) as [number, number, number];
  return {
    dims,
    spp: Number(get('spp') ?? 64),
    bounces: Number(get('bounces') ?? 4),
    seed: Number(get('seed') ?? 1931),
    workers: Number(get('workers') ?? Math.min(16, Math.max(2, cpus().length - 2))),
    passes: Number(get('passes') ?? 2),
    out: get('out') ?? 'gi',
  };
}

function runSlice(opts: Options, zStart: number, zEnd: number, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      'tsx', 'scripts/bake-slice.ts',
      `--dims=${opts.dims.join('x')}`,
      `--spp=${opts.spp}`,
      `--bounces=${opts.bounces}`,
      `--seed=${opts.seed}`,
      `--zstart=${zStart}`,
      `--zend=${zEnd}`,
      `--out=${out}`,
    ];
    const child = spawn('npx.cmd', args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let err = '';
    child.stderr?.on('data', (d: Buffer) => { err += d.toString(); });
    child.stdout?.on('data', (d: Buffer) => {
      const text = d.toString().trim();
      if (text) console.log(`  [${zStart}-${zEnd}] ${text.split('\n').pop()}`);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`slice ${zStart}-${zEnd} failed (${code})\n${err}`));
    });
  });
}

async function main() {
  const opts = parseArgs();
  const [nx, ny, nz] = opts.dims;
  const start = performance.now();
  console.log('STILLWATER parallel light bake');
  console.log(`  volume: ${nx} x ${ny} x ${nz}  (${(nx * ny * nz / 1000).toFixed(0)}k voxels)`);
  console.log(`  rays: ${opts.spp} spp, ${opts.bounces} bounces, ${opts.workers} workers`);

  const tempDir = join(process.cwd(), '.bake-parts');
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });

  const chunks: Array<[number, number, string]> = [];
  const chunkCount = Math.min(opts.workers, nz);
  const base = Math.floor(nz / chunkCount);
  let extra = nz % chunkCount;
  let cursor = 0;
  for (let i = 0; i < chunkCount; i++) {
    const size = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    const zStart = cursor;
    const zEnd = cursor + size;
    chunks.push([zStart, zEnd, join(tempDir, `slice-${String(i).padStart(3, '0')}.bin`)]);
    cursor = zEnd;
  }

  console.log(`  ${chunks.length} slices of ~${(nz / chunks.length).toFixed(1)} rows`);
  let finished = 0;
  await Promise.all(chunks.map(async ([zStart, zEnd, out]) => {
    await runSlice(opts, zStart, zEnd, out);
    finished++;
    const elapsed = ((performance.now() - start) / 1000).toFixed(0);
    console.log(`  ${finished}/${chunks.length} slices done  (${elapsed}s)`);
  }));

  console.log('\nMerging slices…');
  const full = new Float32Array(nx * ny * nz * 3);
  const sliceFloats = nx * ny * 3;
  let mergeAt = 0;
  for (const [zStart, zEnd, file] of chunks) {
    const raw = await readFile(file);
    const part = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
    const expected = (zEnd - zStart) * sliceFloats;
    if (part.length !== expected) {
      throw new Error(`slice ${file} has ${part.length} floats, expected ${expected}`);
    }
    full.set(part, zStart * sliceFloats);
    mergeAt += part.length;
  }
  if (mergeAt !== full.length) throw new Error('merged volume has the wrong size');
  await rm(tempDir, { recursive: true, force: true });

  console.log('Denoising…');
  denoiseVolume(full, opts.dims, opts.passes);

  // A tiny ambient floor keeps deep corners from going completely black.
  for (let i = 0; i < full.length; i += 3) {
    full[i] += 0.0018;
    full[i + 1] += 0.0026;
    full[i + 2] += 0.0025;
  }

  const half = encodeHalfVolume(full);
  const outDir = 'public/bake';
  await mkdir(outDir, { recursive: true });
  const info = {
    dims: opts.dims,
    min: GI_BOUNDS.min,
    max: GI_BOUNDS.max,
    spp: opts.spp,
    bounces: opts.bounces,
    format: 'RGBA16F',
    encoding: 'half-float linear radiance, alpha=1',
    workers: opts.workers,
    generated: new Date().toISOString(),
  };
  await writeFile(`${outDir}/${opts.out}.json`, JSON.stringify(info, null, 2));
  await writeFile(`${outDir}/${opts.out}.bin`, Buffer.from(half.buffer));
  if (opts.out === 'gi') {
    await copyFile(`${outDir}/gi.json`, `${outDir}/gi-final.json`);
    await copyFile(`${outDir}/gi.bin`, `${outDir}/gi-final.bin`);
  }
  console.log(`\nWrote ${outDir}/${opts.out}.bin (${(half.byteLength / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Total: ${((performance.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
