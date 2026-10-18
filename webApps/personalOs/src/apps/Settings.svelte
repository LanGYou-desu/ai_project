<script lang="ts">
  // 系统设置：外观 / 磁盘维护 / 关于本机
  import type { Sys } from '../kernel/kernel.ts'
  import {
    system,
    setTheme,
    setWallpaper,
    refreshUsage,
    pushToast,
    getKernelOrNull,
    scheduleSessionSave,
  } from '../state.svelte.ts'
  import { downloadImage, pickImageFile, listBackups, restoreBackup } from '../drivers/disk-http.ts'
  import { installSeed } from '../services/installer.ts'
  import { formatUptime } from '../kernel/clock.ts'
  import { fmtSize, fmtTime } from '../kernel/terminal/commands.ts'
  import { profile } from '../data/profile.ts'
  import Glyph from '../ui/Glyph.svelte'

  interface Props {
    sys: Sys | null
    arg?: string
    winId: number
  }
  let { sys }: Props = $props()

  interface Backup {
    name: string
    size: number
    mtime: number
  }

  const WALLS = [
    {
      id: 'aurora',
      label: '极光',
      css: 'radial-gradient(circle at 30% 30%, #35b4f8, transparent 62%), radial-gradient(circle at 78% 72%, #a78bfa, transparent 62%), #0a1120',
    },
    {
      id: 'dusk',
      label: '黄昏',
      css: 'radial-gradient(circle at 30% 30%, #fb923c, transparent 62%), radial-gradient(circle at 78% 72%, #f472b6, transparent 62%), #170f20',
    },
    {
      id: 'deep',
      label: '深空',
      css: 'radial-gradient(circle at 30% 30%, #22d3ee, transparent 62%), radial-gradient(circle at 78% 72%, #3b82f6, transparent 62%), #05080f',
    },
    {
      id: 'mono',
      label: '灰岩',
      css: 'radial-gradient(circle at 30% 30%, #94a3b8, transparent 62%), radial-gradient(circle at 78% 72%, #64748b, transparent 62%), #0b0e14',
    },
  ]

  let tick = $state(0)
  let syncing = $state(false)
  let fsckLines = $state<{ text: string; cls: string }[]>([])
  let backups = $state<Backup[]>([])
  let backupsLoaded = $state(false)
  let reformatArmed = $state(false)

  $effect(() => {
    const id = setInterval(() => tick++, 1000)
    return () => clearInterval(id)
  })

  const status = $derived.by(() => {
    tick
    return sys?.disk.status() ?? null
  })
  const uptime = $derived.by(() => {
    tick
    const k = getKernelOrNull()
    return k ? formatUptime(k.clock.uptimeMs()) : '-'
  })

  const modeText = (m: string): string =>
    m === 'http' ? '伙伴服务器（disk/disk.img）' : m === 'static' ? '静态降级（本地暂存）' : m === 'local' ? '浏览器暂存' : '内存盘'

  async function doSync(): Promise<void> {
    if (!sys) return
    syncing = true
    try {
      await sys.disk.sync()
      refreshUsage()
      pushToast({ title: '磁盘已同步', body: '内存盘已写回镜像文件。', kind: 'ok' })
    } finally {
      syncing = false
    }
  }

  function doFsck(repair: boolean): void {
    if (!sys) return
    const r = sys.disk.fsck(repair)
    const lines: { text: string; cls: string }[] = []
    if (repair && 'before' in r) {
      for (const f of r.fixed) lines.push({ text: f, cls: 'ok' })
      lines.push(
        r.after.ok
          ? { text: '修复完成，磁盘现在是一致的。', cls: 'ok' }
          : { text: `修复后仍有问题：${r.after.fatal ?? '存在错误'}`, cls: 'err' },
      )
      refreshUsage()
    } else if ('issues' in r) {
      if (r.fatal) lines.push({ text: `致命问题：${r.fatal}`, cls: 'err' })
      lines.push(
        r.ok
          ? { text: `检查通过：${r.stats.blocks} 块 / ${r.stats.files} 文件 / ${r.stats.dirs} 目录，无问题。`, cls: 'ok' }
          : { text: `发现 ${r.issues.filter((i) => i.severity === 'error').length} 处问题：`, cls: 'warn' },
      )
      for (const i of r.issues.slice(0, 24)) {
        lines.push({ text: `[${i.severity}] ${i.kind}: ${i.detail}`, cls: i.severity === 'error' ? 'err' : 'dim' })
      }
    }
    fsckLines = lines
  }

  function doExport(): void {
    if (!sys) return
    downloadImage(sys.disk.exportImage(), 'disk.img')
    pushToast({ title: '已导出磁盘镜像', body: 'disk.img（256 KiB，FAT-lite）', kind: 'ok' })
  }

  async function doImport(): Promise<void> {
    const k = getKernelOrNull()
    if (!k) return
    const bytes = await pickImageFile()
    if (!bytes) return
    try {
      k.mountImage(bytes)
      refreshUsage()
      pushToast({ title: '镜像已导入', body: '新的文件系统已经挂载。', kind: 'ok' })
    } catch (e) {
      pushToast({ title: '导入失败', body: e instanceof Error ? e.message : String(e), kind: 'err' })
    }
  }

  async function loadBackups(): Promise<void> {
    backups = await listBackups()
    backupsLoaded = true
  }

  async function doRestore(name: string): Promise<void> {
    const ok = await restoreBackup(name)
    if (ok) {
      pushToast({ title: '已回滚到备份', body: `${name}，刷新页面后生效。`, kind: 'ok', action: 'reload' })
    } else {
      pushToast({ title: '回滚失败', body: '仅伙伴服务器模式支持回滚。', kind: 'err' })
    }
  }

  function doReformat(): void {
    const k = getKernelOrNull()
    if (!k) return
    if (!reformatArmed) {
      reformatArmed = true
      setTimeout(() => (reformatArmed = false), 4000)
      return
    }
    reformatArmed = false
    try {
      k.reformat()
      installSeed(k.fs, Date.now())
      refreshUsage()
      void k.flush().then(() => location.reload())
    } catch (e) {
      pushToast({ title: '格式化失败', body: e instanceof Error ? e.message : String(e), kind: 'err' })
    }
  }

  function toggleAutoLogin(): void {
    system.autoLogin = !system.autoLogin
    scheduleSessionSave()
  }
</script>

<div class="page">
  <section class="card">
    <h2><Glyph name="sun" size={16} />外观</h2>
    <div class="row">
      <span class="k">主题</span>
      <div class="seg">
        <button class:on={system.theme === 'glass-dark'} onclick={() => setTheme('glass-dark')}>玻璃暗色</button>
        <button class:on={system.theme === 'glass-light'} onclick={() => setTheme('glass-light')}>玻璃亮色</button>
      </div>
    </div>
    <div class="row">
      <span class="k">壁纸</span>
      <div class="walls">
        {#each WALLS as w (w.id)}
          <button
            class="wall"
            class:on={system.wallpaper === w.id}
            style="background: {w.css}"
            onclick={() => setWallpaper(w.id)}
            title={w.label}
          >
            <span>{w.label}</span>
          </button>
        {/each}
      </div>
    </div>
    <div class="row">
      <span class="k">登录</span>
      <label class="check">
        <input type="checkbox" checked={system.autoLogin} onchange={toggleAutoLogin} />
        <span>在此设备自动登录</span>
      </label>
    </div>
  </section>

  <section class="card">
    <h2><Glyph name="database" size={16} />磁盘</h2>
    {#if status}
      <div class="grid">
        <div class="stat"><span class="sk dim">模式</span><span>{modeText(status.mode)}</span></div>
        <div class="stat"><span class="sk dim">卷标</span><span class="mono">{status.label}</span></div>
        <div class="stat"><span class="sk dim">容量</span><span>{fmtSize(status.total)}（512 块 × 512 B）</span></div>
        <div class="stat">
          <span class="sk dim">占用</span>
          <span>{fmtSize(status.used)} / {status.files} 文件 / {status.dirs} 目录</span>
        </div>
        <div class="stat"><span class="sk dim">写次数</span><span class="mono">{status.writes}</span></div>
        <div class="stat"><span class="sk dim">装机时间</span><span>{fmtTime(Math.floor(status.installTime / 1000))}</span></div>
      </div>

      <div class="ubar"><div class="ubar-in" style="width: {Math.round((status.used / status.total) * 100)}%"></div></div>

      <div class="actions">
        <button class="btn" onclick={doSync} disabled={syncing}>
          <Glyph name="save" size={13} />{syncing ? '同步中…' : '立即同步'}
        </button>
        <button class="btn" onclick={() => doFsck(false)}><Glyph name="cpu" size={13} />运行检查</button>
        <button class="btn" onclick={() => doFsck(true)}><Glyph name="warn" size={13} />检查并修复</button>
        <button class="btn" onclick={doExport}><Glyph name="save" size={13} />导出镜像</button>
        <button class="btn" onclick={doImport}><Glyph name="upload" size={13} />导入镜像</button>
      </div>

      {#if status.mode === 'static'}
        <p class="hint dim">
          静态降级模式：改动保存在浏览器本地暂存（localStorage）中，不会写回服务器。部署时带上伙伴服务器（node server.js）即可获得完整读写能力。
        </p>
      {/if}

      {#if fsckLines.length > 0}
        <div class="report mono">
          {#each fsckLines as l, i (i)}<div class={l.cls}>{l.text}</div>{/each}
        </div>
      {/if}

      {#if status.mode === 'http'}
        <div class="sub">
          <div class="sub-head">
            <span class="sub-title">备份与回滚</span>
            <button class="btn ghost" onclick={loadBackups}><Glyph name="refresh" size={13} />刷新列表</button>
          </div>
          {#if backupsLoaded}
            {#if backups.length === 0}
              <div class="dim hint">还没有备份。每次写盘前服务器都会自动轮转备份（保留最近若干份）。</div>
            {:else}
              {#each backups as b (b.name)}
                <div class="backup">
                  <span class="mono bname">{b.name}</span>
                  <span class="dim bmeta">{fmtSize(b.size)} · {fmtTime(Math.floor(b.mtime / 1000))}</span>
                  <button class="btn" onclick={() => doRestore(b.name)}>回滚</button>
                </div>
              {/each}
            {/if}
          {/if}
        </div>
      {/if}

      <div class="danger">
        <div class="danger-head"><Glyph name="warn" size={14} /> 危险区</div>
        <p class="dim hint">重新格式化会清空整块磁盘并重装发行内容（约 1 秒），然后自动重启页面。</p>
        <button class="btn danger" onclick={doReformat}>
          <Glyph name="trash" size={13} />{reformatArmed ? '再点一次，确认格式化' : '重新格式化磁盘…'}
        </button>
      </div>
    {/if}
  </section>

  <section class="card">
    <h2><Glyph name="info" size={16} />关于本机</h2>
    <div class="grid">
      <div class="stat"><span class="sk dim">主机名</span><span class="mono">{profile.hostname}</span></div>
      <div class="stat"><span class="sk dim">系统版本</span><span class="mono">personal-os {profile.version}</span></div>
      <div class="stat"><span class="sk dim">用户</span><span>{profile.owner}</span></div>
      <div class="stat"><span class="sk dim">开机时长</span><span class="mono">{uptime}</span></div>
      <div class="stat"><span class="sk dim">内核</span><span>Svelte 5 + FAT-lite（全部逻辑跑在浏览器里）</span></div>
      <div class="stat"><span class="sk dim">存储</span><span>256 KiB 虚拟磁盘 · 镜像 disk/disk.img</span></div>
    </div>

    <div class="keys">
      <div class="key"><kbd>Alt</kbd>+<kbd>Tab</kbd><span class="dim">切换窗口</span></div>
      <div class="key"><kbd>Ctrl</kbd>+<kbd>K</kbd><span class="dim">打开启动器</span></div>
      <div class="key"><kbd>Esc</kbd><span class="dim">关闭菜单 / 启动器</span></div>
      <div class="key"><kbd>Ctrl</kbd>+<kbd>L</kbd><span class="dim">终端清屏</span></div>
      <div class="key"><kbd>拖到边缘</kbd><span class="dim">贴边分屏</span></div>
      <div class="key"><kbd>双击标题栏</kbd><span class="dim">最大化 / 还原</span></div>
    </div>
  </section>
</div>

<style>
  .page {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 18px 22px 30px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .card {
    border: 1px solid var(--stroke);
    border-radius: 18px;
    background: var(--glass-soft);
    padding: 16px 18px;
  }
  h2 {
    margin: 0 0 12px;
    font-size: 14.5px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 7px 0;
  }
  .k {
    width: 52px;
    font-size: 12.5px;
    color: var(--text-dim);
    flex: none;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--stroke);
    border-radius: 10px;
    overflow: hidden;
  }
  .seg button {
    padding: 6px 14px;
    border: none;
    background: transparent;
    color: var(--text-dim);
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
  }
  .seg button.on {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .walls {
    display: flex;
    gap: 9px;
  }
  .wall {
    width: 74px;
    height: 46px;
    border-radius: 11px;
    border: 2px solid transparent;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    padding: 0;
  }
  .wall.on {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .wall span {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    font-size: 10px;
    padding: 2px 0;
    color: #fff;
    background: rgba(0, 0, 0, 0.4);
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    color: var(--text-dim);
    cursor: pointer;
  }
  .check input {
    accent-color: var(--accent);
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 18px;
    margin-bottom: 12px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12.5px;
  }
  .sk {
    font-size: 11px;
  }
  .ubar {
    height: 6px;
    border-radius: 3px;
    background: var(--stroke);
    overflow: hidden;
    margin: 4px 0 14px;
  }
  .ubar-in {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    transition: width 0.3s ease;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .hint {
    font-size: 12px;
    line-height: 1.65;
    margin: 10px 0 0;
  }
  .report {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--stroke);
    background: rgba(0, 0, 0, 0.16);
    font-size: 11.5px;
    line-height: 1.7;
    max-height: 180px;
    overflow: auto;
  }
  .sub {
    margin-top: 14px;
    border-top: 1px solid var(--stroke);
    padding-top: 12px;
  }
  .sub-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .sub-title {
    font-size: 12.5px;
    font-weight: 600;
  }
  .backup {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 2px;
    font-size: 12px;
  }
  .bname {
    flex: none;
  }
  .bmeta {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .danger {
    margin-top: 14px;
    border: 1px solid rgba(248, 113, 113, 0.35);
    border-radius: 13px;
    padding: 12px 14px;
    background: rgba(248, 113, 113, 0.06);
  }
  .danger-head {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--err);
    font-size: 12.5px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .keys {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px 18px;
    margin-top: 12px;
    border-top: 1px solid var(--stroke);
    padding-top: 12px;
  }
  .key {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  .key span {
    margin-left: 4px;
  }
</style>
