<script lang="ts">
  // 音乐：WebAudio 程序化 chiptune + 频谱可视化；也支持播放 public/music 下的音频文件
  import type { Sys } from '../kernel/kernel.ts'
  import type { WebAudioDriver } from '../drivers/audio.ts'
  import { BUILTIN_TRACKS } from '../data/tracks.ts'
  import { PATHS } from '../services/installer.ts'
  import { pushToast, system } from '../state.svelte.ts'
  import Glyph from '../ui/Glyph.svelte'

  interface Props {
    sys: Sys | null
    arg?: string
    winId: number
  }
  let { sys, winId }: Props = $props()

  interface TrackItem {
    id: string
    name: string
    note?: string
    builtin: boolean
  }

  let items = $state<TrackItem[]>([])
  let current = $state<string | null>(null)
  let playing = $state(false)
  let position = $state(0)
  let duration = $state(0)
  let volume = $state(0.7)
  let urlInput = $state('')
  let canvasEl: HTMLCanvasElement | null = $state(null)

  const driver = $derived((sys?.audio ?? null) as WebAudioDriver | null)

  const currentItem = $derived(items.find((i) => i.id === current) ?? null)

  const fmtClock = (s: number): string => {
    if (!Number.isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  async function loadPlaylist(): Promise<void> {
    const d = driver
    if (!d || !sys) return
    const list: TrackItem[] = []
    try {
      const data = JSON.parse(sys.fs.readText(PATHS.playlist)) as {
        entries: { kind: string; id?: string; url?: string; name: string }[]
      }
      for (const e of data.entries) {
        if (e.kind === 'builtin' && e.id) {
          const meta = BUILTIN_TRACKS.find((t) => t.id === e.id)
          list.push({ id: e.id, name: e.name, note: meta?.note, builtin: true })
        } else if (e.url) {
          const id = await d.loadFile(e.url, e.name)
          list.push({ id, name: e.name, builtin: false })
        }
      }
    } catch {
      /* 播放列表损坏：回退到内置曲目 */
    }
    if (list.length === 0) {
      for (const t of BUILTIN_TRACKS) list.push({ id: t.id, name: t.name, note: t.note, builtin: true })
    }
    items = list
    d.setQueue(list.map((i) => ({ id: i.id, name: i.name })))
  }

  function drawSpectrum(): void {
    const c = canvasEl
    const d = driver
    if (!c || !d) return
    const ratio = window.devicePixelRatio || 1
    const w = Math.round(c.clientWidth * ratio)
    const h = Math.round(c.clientHeight * ratio)
    if (c.width !== w || c.height !== h) {
      c.width = w
      c.height = h
    }
    const g = c.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, w, h)
    const bins = d.spectrum()
    const bars = 42
    const gap = 3 * ratio
    const bw = (w - gap * (bars - 1)) / bars
    const t = Date.now()
    for (let i = 0; i < bars; i++) {
      let v: number
      if (bins) {
        v = bins[Math.floor((i / bars) * bins.length * 0.72)] / 255
      } else {
        v = 0.04 + 0.03 * Math.sin(i * 0.7 + t / 600)
      }
      const bh = Math.max(2 * ratio, v * h * 0.92)
      const grad = g.createLinearGradient(0, h, 0, h - bh)
      grad.addColorStop(0, 'rgba(110,168,255,.92)')
      grad.addColorStop(1, 'rgba(167,139,250,.92)')
      g.fillStyle = grad
      g.fillRect(i * (bw + gap), h - bh, bw, bh)
    }
  }

  $effect(() => {
    const d = driver
    if (!sys || !d) return
    void loadPlaylist()
    volume = d.getVolume()
    const poll = setInterval(() => {
      const s = d.state()
      current = s.trackId
      playing = s.playing
      position = s.position
      duration = s.duration
    }, 300)
    return () => clearInterval(poll)
  })

  // 频谱只在播放时跑动画帧；暂停时停在静止一帧，省电
  $effect(() => {
    if (!playing) {
      drawSpectrum()
      return
    }
    let raf = 0
    const loop = () => {
      drawSpectrum()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  })

  async function playTrack(id: string): Promise<void> {
    await driver?.playTrack(id)
  }

  async function onPrev(): Promise<void> {
    await driver?.prev()
  }

  async function onNext(): Promise<void> {
    await driver?.next()
  }

  async function onToggle(): Promise<void> {
    const d = driver
    if (!d) return
    if (!current && items.length > 0) {
      await playTrack(items[0].id)
      return
    }
    await d.toggle()
  }

  async function addFromUrl(): Promise<void> {
    const d = driver
    if (!d) return
    const u = urlInput.trim()
    if (!u) return
    const name = u.split('/').pop() ?? u
    try {
      const id = await d.loadFile(u, name)
      items = [...items.filter((i) => i.id !== id), { id, name, note: '外部文件', builtin: false }]
      d.setQueue(items.map((i) => ({ id: i.id, name: i.name })))
      urlInput = ''
      await playTrack(id)
    } catch {
      pushToast({ title: '无法加载音频', body: `检查路径是否正确：${u}`, kind: 'err' })
    }
  }

  function setVol(v: number): void {
    volume = v
    driver?.setVolume(v)
  }

  // 媒体播放器习惯：本窗口聚焦时空格 = 播放/暂停（输入控件上不抢键）
  function onKeydown(e: KeyboardEvent): void {
    if (system.wm.focusId !== winId || e.key !== ' ') return
    const t = e.target as HTMLElement | null
    if (t && ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(t.tagName)) return
    if (t?.isContentEditable) return
    e.preventDefault()
    void onToggle()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="page">
  <div class="now">
    <div class="np-head">
      <div class="meta">
        <div class="np-name">{currentItem ? currentItem.name : '还没有播放'}</div>
        <div class="np-note dim">{currentItem?.note ?? '点击下面的曲目开始播放'}</div>
      </div>
      {#if currentItem}<span class="chip">{currentItem.builtin ? '内置合成' : '文件'}</span>{/if}
    </div>

    <canvas class="spectrum" bind:this={canvasEl}></canvas>

    <div class="progress">
      <span class="t mono">{fmtClock(position)}</span>
      <div class="bar">
        <div class="bar-in" style="width: {duration > 0 ? Math.min(100, (position / duration) * 100) : 0}%"></div>
      </div>
      <span class="t mono">{fmtClock(duration)}</span>
    </div>

    <div class="controls">
      <button class="btn-ico big" onclick={onPrev} aria-label="上一首"><Glyph name="prev" size={19} /></button>
      <button class="play" onclick={onToggle} aria-label={playing ? '暂停' : '播放'}>
        <Glyph name={playing ? 'pause' : 'play'} size={21} stroke={2} />
      </button>
      <button class="btn-ico big" onclick={onNext} aria-label="下一首"><Glyph name="next" size={19} /></button>
      <div class="vol">
        <Glyph name="volume" size={15} />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          oninput={(e) => setVol(Number((e.currentTarget as HTMLInputElement).value))}
          aria-label="音量"
        />
      </div>
    </div>
  </div>

  <div class="list">
    {#each items as item (item.id)}
      <button class="row" class:on={current === item.id} onclick={() => playTrack(item.id)}>
        <span class="ic">
          {#if current === item.id && playing}
            <Glyph name="volume" size={14} />
          {:else}
            <Glyph name="play" size={14} />
          {/if}
        </span>
        <span class="name">{item.name}</span>
        <span class="note dim">{item.note ?? ''}</span>
      </button>
    {/each}
  </div>

  <div class="add">
    <input
      class="field"
      bind:value={urlInput}
      placeholder="music/某首歌.mp3 —— 把文件放进 public/music 后填路径"
      onkeydown={(e) => e.key === 'Enter' && addFromUrl()}
    />
    <button class="btn" onclick={addFromUrl}><Glyph name="plus" size={13} />加入并播放</button>
  </div>
</div>

<style>
  .page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 16px 18px 14px;
    gap: 12px;
  }
  .now {
    flex: none;
    border-radius: 18px;
    border: 1px solid var(--stroke);
    background: var(--glass-soft);
    padding: 14px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .np-head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .meta {
    flex: 1;
    min-width: 0;
  }
  .np-name {
    font-size: 15.5px;
    font-weight: 650;
  }
  .np-note {
    font-size: 12px;
    margin-top: 2px;
  }
  .spectrum {
    width: 100%;
    height: 92px;
    display: block;
  }
  .progress {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .t {
    font-size: 11px;
    color: var(--text-dim);
    width: 36px;
    text-align: center;
    flex: none;
  }
  .bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--stroke);
    overflow: hidden;
  }
  .bar-in {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    transition: width 0.25s linear;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .big {
    width: 38px;
    height: 38px;
  }
  .play {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 1px solid var(--stroke-strong);
    background: linear-gradient(160deg, var(--accent), var(--accent-2));
    color: #fff;
    display: grid;
    place-items: center;
    cursor: pointer;
    box-shadow: 0 8px 22px rgba(80, 120, 255, 0.32);
    transition: transform var(--dur-fast) ease;
  }
  .play:active {
    transform: scale(0.94);
  }
  .vol {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--text-dim);
  }
  .vol input {
    width: 110px;
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 11px;
    border: none;
    background: transparent;
    border-radius: 11px;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
  }
  .row:hover {
    background: var(--glass-soft);
  }
  .row.on {
    background: var(--accent-soft);
  }
  .row .ic {
    width: 22px;
    display: inline-flex;
    justify-content: center;
    color: var(--text-dim);
    flex: none;
  }
  .row.on .ic {
    color: var(--accent);
  }
  .name {
    flex: none;
    font-weight: 550;
  }
  .note {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11.5px;
    text-align: right;
  }
  .add {
    flex: none;
    display: flex;
    gap: 8px;
  }
</style>
