<script lang="ts">
  // 联系：磁盘上的 contact.json + 一键复制
  import type { Sys } from '../kernel/kernel.ts'
  import { PATHS } from '../services/installer.ts'
  import { profile } from '../data/profile.ts'
  import Glyph from '../ui/Glyph.svelte'

  interface ContactData {
    name: string
    tagline: string
    email: string
    location: string
    availability: string
    links: { label: string; url: string }[]
    note?: string
  }

  interface Props {
    sys: Sys | null
    arg?: string
    winId: number
  }
  let { sys }: Props = $props()

  let data = $state<ContactData | null>(null)
  let copied = $state(false)

  $effect(() => {
    if (!sys) return
    try {
      data = JSON.parse(sys.fs.readText(PATHS.contact)) as ContactData
    } catch {
      data = {
        name: profile.contact.name,
        tagline: profile.contact.tagline,
        email: profile.contact.email,
        location: profile.contact.location,
        availability: profile.contact.availability,
        links: profile.contact.links,
        note: profile.contact.note,
      }
    }
  })

  async function copyEmail(): Promise<void> {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.email)
      copied = true
      sys?.notify('邮箱已复制', data.email, 'ok')
      setTimeout(() => (copied = false), 1800)
    } catch {
      sys?.notify('复制失败', '请手动选择邮箱地址', 'warn')
    }
  }
</script>

<div class="page">
  {#if data}
    <div class="hero">
      <div class="tagline">{data.tagline}</div>
      <div class="who">—— {data.name}</div>
    </div>

    <div class="rows">
      <div class="row">
        <span class="g"><Glyph name="bell" size={15} /></span>
        <span class="k">邮箱</span>
        <span class="v mono">{data.email}</span>
        <button class="btn" onclick={copyEmail}>
          <Glyph name={copied ? 'ok' : 'copy'} size={13} />{copied ? '已复制' : '复制'}
        </button>
      </div>
      <div class="row">
        <span class="g"><Glyph name="home" size={15} /></span>
        <span class="k">所在</span>
        <span class="v">{data.location}</span>
      </div>
      <div class="row">
        <span class="g"><Glyph name="clock" size={15} /></span>
        <span class="k">状态</span>
        <span class="v">{data.availability}</span>
      </div>
    </div>

    <div class="links">
      {#each data.links as link (link.url)}
        <a class="btn" href={link.url} target="_blank" rel="noopener noreferrer">
          <Glyph name="external" size={14} />{link.label}
        </a>
      {/each}
      <a class="btn primary" href="mailto:{data.email}">
        <Glyph name="bell" size={14} />写邮件
      </a>
    </div>

    {#if data.note}
      <div class="note dim">{data.note}</div>
    {/if}
  {:else}
    <div class="dim load">正在读取联系信息…</div>
  {/if}
</div>

<style>
  .page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 30px 34px;
    gap: 22px;
    overflow: auto;
  }
  .hero {
    padding: 22px 24px;
    border-radius: 18px;
    background: linear-gradient(140deg, var(--accent-soft), transparent 70%);
    border: 1px solid var(--stroke);
  }
  .tagline {
    font-size: 17px;
    line-height: 1.6;
  }
  .who {
    margin-top: 10px;
    color: var(--text-dim);
    font-size: 13px;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    border-radius: 12px;
  }
  .row:hover {
    background: var(--glass-soft);
  }
  .g {
    color: var(--text-dim);
    display: inline-flex;
  }
  .k {
    width: 44px;
    font-size: 12.5px;
    color: var(--text-dim);
    flex: none;
  }
  .v {
    flex: 1;
    font-size: 13.5px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .links {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
  }
  .note {
    font-size: 12px;
    line-height: 1.7;
  }
  .load {
    padding: 30px 4px;
  }
</style>
