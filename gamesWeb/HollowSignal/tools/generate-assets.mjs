/**
 * Rebuilds the locally generated media in assets/.
 *
 * - Four streamed ambience beds (three seamless-enough 8-second WAV chunks each)
 * - A menu background painting rendered by headless Chromium
 *
 * Run: node tools/generate-assets.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_ROOT = path.join(ROOT, 'assets', 'audio', 'ambience');
const MENU_IMAGE = path.join(ROOT, 'assets', 'menu-bg.jpg');
const SAMPLE_RATE = 22050;
const CHUNK_SECONDS = 8;
const CHUNKS = 3;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

function drip(s, tt, gain = .11) {
  return s + Math.sin(TAU * (1040 - tt * 430) * tt) * Math.exp(-tt * 9.2) * gain +
    Math.sin(TAU * (520 - tt * 210) * tt + .7) * Math.exp(-tt * 6.4) * gain * .35;
}

function creak(s, tt, gain = .08) {
  const wobble = Math.sin(TAU * (42 + tt * 2.1) * tt + Math.sin(tt * 2.4) * .8);
  const scrape = (Math.sin(TAU * 173 * tt) + Math.sin(TAU * 287 * tt)) * .12;
  return s + (wobble + scrape) * Math.exp(-tt * .72) * gain;
}

function synthChunk(trackId, chunkIndex) {
  const totalSeconds = CHUNK_SECONDS * CHUNKS;
  const start = chunkIndex * CHUNK_SECONDS;
  const length = SAMPLE_RATE * CHUNK_SECONDS;
  const output = new Float32Array(length);
  const random = mulberry32(0x51A1C0DE + chunkIndex * 977 + trackId.length * 101);
  let brown = 0;
  let low = 0;
  let band = 0;

  const dripTimes = [1.15, 2.9, 4.55, 7.0, 8.9, 11.8, 13.1, 15.7, 17.3, 19.6, 21.2, 23.0];
  const creakTimes = [3.7, 9.3, 14.2, 20.4];
  const stepTimes = [5.2, 10.7, 15.9, 21.1];

  for (let i = 0; i < length; i++) {
    const t = start + i / SAMPLE_RATE;
    const n = random() * 2 - 1;
    brown = (brown + n * .018) * .9965;
    low += (n - low) * .013;
    band += (n - band) * .09;
    let s = 0;

    if (trackId === 'lowWater') {
      const swell = .62 + .38 * Math.sin(t * .31 + .6);
      s += Math.sin(TAU * 29.2 * t) * .115;
      s += Math.sin(TAU * 43.6 * t + .8) * .052 * swell;
      s += Math.sin(TAU * 73.9 * t + Math.sin(t * .17) * .6) * .017;
      s += brown * .32 + low * .3;
      s += Math.sin(TAU * .44 * t) * low * .16;
      for (const at of dripTimes) {
        if (t >= at && t - at < 1.5) s = drip(s, t - at, .10);
      }
      for (const at of creakTimes) {
        if (t >= at && t - at < 4.6) s = creak(s, t - at, .075);
      }
    } else if (trackId === 'listeningFloor') {
      // Pump motor, electrical mains, and water travelling through pipework.
      s += Math.sin(TAU * 55 * t) * .095;
      s += Math.sin(TAU * 110 * t + .2) * .042;
      s += Math.sin(TAU * 165 * t + 1.1) * .018;
      const pumpPulse = Math.max(0, Math.sin(TAU * .83 * t)) ** 8;
      s += (Math.sin(TAU * 36.7 * t) * .07 + low * .18) * (.4 + pumpPulse * .6);
      s += band * .025 * (Math.random() < .002 ? 2.2 : .5);
      s += brown * .17;
      for (const at of dripTimes) {
        if (t >= at + .35 && t - at - .35 < 1.3) s = drip(s, t - at - .35, .075);
      }
      if (t > 6 && t < 6.14) s += n * .13;
      if (t > 18 && t < 18.09) s += n * .1;
    } else if (trackId === 'skinnyWalls') {
      s += Math.sin(TAU * 27.5 * t) * .10;
      s += Math.sin(TAU * 41.6 * t + Math.sin(t * .11) * 1.4) * .045;
      s += low * .36 + brown * .15;
      const breath = Math.max(0, Math.sin(TAU * .19 * t - 1.1)) ** 3;
      s += band * .028 * (.25 + breath);
      for (const at of stepTimes) {
        const tt = t - at;
        if (tt >= 0 && tt < .55) {
          s += Math.sin(TAU * 63 * tt) * Math.exp(-tt * 21) * .11;
          s += n * Math.exp(-tt * 35) * .045;
        }
      }
      for (const at of [2.2, 12.3, 22.1]) {
        const tt = t - at;
        if (tt >= 0 && tt < .8) s += Math.sin(TAU * 620 * tt) * Math.exp(-tt * 12) * .018;
      }
      for (const at of creakTimes) {
        if (t >= at + 1.1 && t - at - 1.1 < 3.8) s = creak(s, t - at - 1.1, .038);
      }
    } else {
      // 'hollow': a chord that is almost a voice, plus a broken carrier.
      const bloom = .45 + .55 * Math.sin(t * .16 + 1.2) ** 2;
      s += Math.sin(TAU * 36.7 * t) * .085;
      s += Math.sin(TAU * 72.1 * t + Math.sin(t * .27) * .9) * .046 * bloom;
      s += Math.sin(TAU * 108.4 * t + .4) * .031 * bloom;
      s += Math.sin(TAU * 145.3 * t + 1.7) * .019 * bloom;
      s += Math.sin(TAU * 217.5 * t + Math.sin(t * .43) * .3) * .011;
      s += low * .19 + brown * .09;
      const carrier = (t % 7.7) < .22 ? Math.sin(TAU * 840 * t) * .012 : 0;
      s += carrier;
      if (t > 4.1 && t < 5.8) {
        const tt = t - 4.1;
        s += (Math.sin(TAU * 290 * tt + Math.sin(tt * 3.1)) + Math.sin(TAU * 410 * tt) * .4) * Math.sin(tt / 1.7 * Math.PI) * .012;
      }
      if (t > 15.3 && t < 17.4) {
        const tt = t - 15.3;
        s += band * .08 * Math.sin(tt / 2.1 * Math.PI);
      }
    }

    // Suppress the tiny discontinuity at chunk boundaries. 18 ms is below the
    // threshold at which this reads as a fade.
    const edge = Math.min(1, i / (SAMPLE_RATE * .018), (length - 1 - i) / (SAMPLE_RATE * .018));
    output[i] = Math.tanh(s * 1.16) * .52 * edge;
  }
  return output;
}

function encodeWav(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buffer;
}

async function generateAudio() {
  const defs = [
    { id: 'lowWater', seed: 11 },
    { id: 'listeningFloor', seed: 23 },
    { id: 'skinnyWalls', seed: 37 },
    { id: 'hollow', seed: 51 }
  ];
  const manifest = { sampleRate: SAMPLE_RATE, chunkSeconds: CHUNK_SECONDS, tracks: {} };
  for (const def of defs) {
    const dir = path.join(AUDIO_ROOT, def.id);
    await fs.mkdir(dir, { recursive: true });
    for (let chunk = 0; chunk < CHUNKS; chunk++) {
      const wav = encodeWav(synthChunk(def.id, chunk));
      await fs.writeFile(path.join(dir, `chunk-${String(chunk).padStart(2, '0')}.wav`), wav);
    }
    manifest.tracks[def.id] = {
      chunks: CHUNKS,
      prefix: 'chunk',
      duration: CHUNK_SECONDS,
      loop: true
    };
    console.log(`ambience: ${def.id} (${CHUNKS} x ${CHUNK_SECONDS}s)`);
  }
  await fs.writeFile(path.join(AUDIO_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

async function generateMenuImage() {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
    <defs>
      <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0c1a18"/>
        <stop offset=".42" stop-color="#07110f"/>
        <stop offset="1" stop-color="#020403"/>
      </linearGradient>
      <radialGradient id="lamp" cx="50%" cy="50%">
        <stop offset="0" stop-color="#e9d6a0" stop-opacity=".95"/>
        <stop offset=".12" stop-color="#b9a274" stop-opacity=".62"/>
        <stop offset=".48" stop-color="#566d5f" stop-opacity=".18"/>
        <stop offset="1" stop-color="#0a1411" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d7c99f" stop-opacity=".35"/>
        <stop offset=".65" stop-color="#7b9b89" stop-opacity=".06"/>
        <stop offset="1" stop-color="#7b9b89" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="corridor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#18302b"/>
        <stop offset=".6" stop-color="#07100e"/>
        <stop offset="1" stop-color="#020504"/>
      </linearGradient>
      <pattern id="tiles" width="130" height="96" patternUnits="userSpaceOnUse">
        <path d="M0 0H130M0 96H130M0 0V96" stroke="#7f948a" stroke-opacity=".1" stroke-width="2"/>
        <path d="M8 8H122M8 80H122" stroke="#bfc3a8" stroke-opacity=".035" stroke-width="1"/>
      </pattern>
      <pattern id="grate" width="46" height="46" patternUnits="userSpaceOnUse">
        <path d="M0 0H46M0 23H46" stroke="#293831" stroke-width="4" stroke-opacity=".75"/>
        <path d="M0 0V46M23 0V46" stroke="#111b17" stroke-width="3" stroke-opacity=".8"/>
      </pattern>
      <filter id="blur"><feGaussianBlur stdDeviation="26"/></filter>
      <filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter>
      <filter id="grain" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency=".82" numOctaves="4" stitchTiles="stitch" result="noise"/>
        <feColorMatrix in="noise" type="saturate" values="0" result="mono"/>
        <feComponentTransfer in="mono" result="soft">
          <feFuncA type="linear" slope=".19"/>
        </feComponentTransfer>
        <feBlend in="SourceGraphic" in2="soft" mode="screen"/>
      </filter>
      <clipPath id="frame"><rect x="0" y="0" width="1920" height="1080"/></clipPath>
    </defs>
    <g clip-path="url(#frame)">
      <rect width="1920" height="1080" fill="url(#water)"/>
      <g opacity=".72">
        <path d="M-80 160H2000M-80 420H2000M-80 760H2000" stroke="#3e5b51" stroke-width="2" opacity=".27"/>
        <path d="M170 -20V1100M560 -20V1100M1370 -20V1100M1760 -20V1100" stroke="#29463d" stroke-width="2" opacity=".22"/>
      </g>

      <!-- flooded pillared hall -->
      <g opacity=".9">
        <path d="M0 0H260L780 1080H0Z" fill="#030706"/>
        <path d="M1920 0H1660L1140 1080H1920Z" fill="#030706"/>
        <rect x="260" y="0" width="520" height="1080" fill="url(#tiles)" opacity=".2"/>
        <rect x="1140" y="0" width="520" height="1080" fill="url(#tiles)" opacity=".13"/>
        <path d="M260 0L780 1080M1660 0L1140 1080" stroke="#587668" stroke-width="7" opacity=".34"/>
        <path d="M310 0L830 1080M1610 0L1090 1080" stroke="#0b1412" stroke-width="44" opacity=".72"/>
      </g>

      <!-- thick structural ribs -->
      <g fill="#0a100e" stroke="#3b5047" stroke-width="2" opacity=".95">
        <path d="M420 0H500L880 1080H720Z"/>
        <path d="M1420 0H1500L1200 1080H1040Z"/>
        <path d="M0 286H1920V342H0Z" opacity=".9"/>
        <path d="M0 702H1920V760H0Z" opacity=".8"/>
      </g>

      <!-- distant corridor and light -->
      <g>
        <path d="M780 300L1140 300L1240 900H680Z" fill="url(#corridor)"/>
        <rect x="796" y="300" width="328" height="12" fill="#587268" opacity=".5"/>
        <path d="M850 320L830 900M1070 320L1090 900" stroke="#445c51" stroke-width="8" opacity=".36"/>
        <path d="M910 320L905 900M1010 320L1015 900" stroke="#16231e" stroke-width="28" opacity=".8"/>
        <ellipse cx="960" cy="385" rx="300" ry="240" fill="url(#lamp)" opacity=".42" filter="url(#blur)"/>
        <path d="M936 310H984L1012 384H908Z" fill="#d7c390" opacity=".88"/>
        <ellipse cx="960" cy="388" rx="52" ry="18" fill="#f0dfad" opacity=".9" filter="url(#blur8)"/>
        <path d="M900 390L790 990H1130L1020 390Z" fill="url(#beam)" opacity=".8"/>
        <rect x="946" y="388" width="28" height="250" fill="#1b2822"/>
        <circle cx="960" cy="390" r="12" fill="#d7c390" opacity=".8"/>
      </g>

      <!-- human silhouette at the far end -->
      <g fill="#020403" opacity=".94">
        <ellipse cx="966" cy="606" rx="14" ry="17"/>
        <path d="M952 622Q966 612 980 622L986 690L976 744H966L960 694L954 744H944L936 690Z"/>
        <path d="M951 628L934 700L940 704L958 646Z"/>
        <path d="M981 628L999 701L992 704L974 646Z"/>
      </g>

      <!-- foreground pipes and cables -->
      <g fill="none" stroke-linecap="round">
        <path d="M1480 -40C1510 250 1460 350 1528 560S1440 850 1490 1120" stroke="#30473d" stroke-width="34"/>
        <path d="M1510 -40C1540 250 1490 350 1558 560S1470 850 1520 1120" stroke="#0a120f" stroke-width="18"/>
        <path d="M0 860C280 820 440 884 720 854S1110 790 1340 882" stroke="#1a2a24" stroke-width="56"/>
        <path d="M0 876C280 836 440 900 720 870S1110 806 1340 898" stroke="#41564b" stroke-width="2" opacity=".38"/>
        <path d="M400 0C430 176 370 260 402 430" stroke="#2a4239" stroke-width="18"/>
        <path d="M403 0C433 176 373 260 405 430" stroke="#627a6c" stroke-width="1.4" opacity=".4"/>
      </g>

      <!-- railings and floor -->
      <g opacity=".82">
        <path d="M180 790L660 1010M1740 790L1260 1010" stroke="#1d2b25" stroke-width="12"/>
        <path d="M210 810V1080M360 884V1080M540 955V1080M1710 810V1080M1560 884V1080M1380 955V1080" stroke="#2b3c34" stroke-width="10"/>
        <path d="M190 850L600 1020M1730 850L1320 1020" stroke="#496157" stroke-width="2" opacity=".42"/>
        <path d="M0 954H1920V1080H0Z" fill="#020403"/>
        <rect x="0" y="980" width="1920" height="100" fill="url(#grate)" opacity=".32"/>
      </g>

      <!-- water caustics -->
      <g fill="none" stroke="#9dc1b0" opacity=".11" filter="url(#blur8)">
        <path d="M-40 230C230 182 366 274 592 216S990 164 1240 246S1650 278 1980 194"/>
        <path d="M-20 272C240 224 370 316 610 256S1000 206 1240 288S1660 320 1960 238"/>
        <path d="M300 845C470 810 610 864 760 828S1030 788 1180 844S1430 876 1580 840"/>
      </g>

      <!-- signal waveform -->
      <g opacity=".22" filter="url(#blur8)">
        <path d="M1040 620C1090 572 1114 654 1160 610S1228 578 1264 624S1324 674 1362 618S1418 572 1460 624S1530 664 1580 606"
          fill="none" stroke="#bcb58e" stroke-width="3"/>
        <path d="M1040 620C1090 572 1114 654 1160 610S1228 578 1264 624S1324 674 1362 618S1418 572 1460 624S1530 664 1580 606"
          fill="none" stroke="#d8d1aa" stroke-width="1" opacity=".55"/>
      </g>

      <!-- particles -->
      <g fill="#c8c5a8">
        <circle cx="412" cy="382" r="2" opacity=".45"/><circle cx="660" cy="242" r="1.4" opacity=".3"/>
        <circle cx="1120" cy="312" r="1.8" opacity=".32"/><circle cx="1276" cy="526" r="1.2" opacity=".4"/>
        <circle cx="802" cy="586" r="1.5" opacity=".36"/><circle cx="1488" cy="688" r="2" opacity=".25"/>
        <circle cx="520" cy="746" r="1.3" opacity=".3"/><circle cx="1680" cy="404" r="1.7" opacity=".28"/>
        <circle cx="880" cy="470" r="1.1" opacity=".45"/><circle cx="958" cy="548" r="1.5" opacity=".3"/>
        <circle cx="300" cy="610" r="1.8" opacity=".25"/><circle cx="1288" cy="808" r="1.4" opacity=".28"/>
      </g>

      <!-- vignette and grade -->
      <rect width="1920" height="1080" fill="none"/>
      <radialGradient id="vig" cx="50%" cy="45%" r="72%">
        <stop offset=".38" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".78"/>
      </radialGradient>
      <rect width="1920" height="1080" fill="url(#vig)"/>
      <rect width="1920" height="1080" fill="#1a2d27" opacity=".08"/>
      <rect width="1920" height="1080" filter="url(#grain)" opacity=".34" fill="transparent"/>
    </g>
  </svg>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:100%;height:100%;background:#020403;overflow:hidden}
    svg{display:block;width:100vw;height:100vh;object-fit:cover}
  </style></head><body>${svg}</body></html>`;

  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\33658\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe'
  ].filter(Boolean);
  let executablePath = null;
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      executablePath = candidate;
      break;
    } catch {
      // Try the next installed browser.
    }
  }
  if (!executablePath) throw new Error('No Chromium-based browser found. Set CHROME_PATH.');
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(150);
  await fs.mkdir(path.dirname(MENU_IMAGE), { recursive: true });
  await page.screenshot({ path: MENU_IMAGE, type: 'jpeg', quality: 88, fullPage: false });
  await browser.close();
  console.log('menu background: assets/menu-bg.jpg');
}

await fs.mkdir(AUDIO_ROOT, { recursive: true });
await generateAudio();
try {
  await generateMenuImage();
} catch (error) {
  console.warn('Menu image could not be regenerated. Keeping any existing image.', error.message);
}
