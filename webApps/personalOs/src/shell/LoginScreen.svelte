<script lang="ts">
  // 登录屏：头像 + 进入桌面的仪式感
  import { system, enterDesktop } from '../state.svelte.ts'
  import { profile } from '../data/profile.ts'
  import { seededColors } from '../kernel/rng.ts'

  const [c1, c2] = seededColors(profile.owner)
</script>

<svelte:window onkeydown={(e) => e.key === 'Enter' && enterDesktop()} />

<div class="login">
  <div class="card glass-strong fade-up">
    <div class="avatar" style="background: linear-gradient(135deg, {c1}, {c2})">{profile.owner.slice(0, 1)}</div>
    <div class="name">{profile.owner}</div>
    <div class="sub dim">{profile.hostname} · {profile.version}</div>

    <button class="btn primary enter" onclick={enterDesktop}>{system.locked ? '解锁' : '进入桌面'}</button>

    <label class="auto">
      <input type="checkbox" bind:checked={system.autoLogin} />
      <span>在此设备自动登录</span>
    </label>
  </div>
  <div class="foot dim">{system.locked ? '屏幕已锁定 · 按 Enter 解锁' : '按 Enter 直接进入 · 这是一个可以「用」的个人网站'}</div>
</div>

<style>
  .login {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 22px;
    z-index: 950;
    background:
      radial-gradient(680px 440px at 20% 16%, var(--wall-1), transparent 62%),
      radial-gradient(620px 420px at 82% 84%, var(--wall-2), transparent 64%),
      var(--login-dim);
    backdrop-filter: blur(16px);
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 38px 56px 30px;
    border-radius: 26px;
  }
  .avatar {
    width: 84px;
    height: 84px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 34px;
    color: #fff;
    box-shadow:
      inset 0 2px 10px rgba(255, 255, 255, 0.28),
      0 10px 30px rgba(0, 0, 0, 0.35),
      0 0 0 4px var(--glass-soft),
      0 0 34px rgba(110, 168, 255, 0.38);
  }
  .name {
    font-size: 20px;
    font-weight: 600;
    margin-top: 6px;
  }
  .sub {
    font-size: 12px;
  }
  .enter {
    margin-top: 16px;
    padding: 10px 0;
    width: 100%;
    justify-content: center;
    font-size: 14px;
    border-radius: 12px;
  }
  .auto {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    color: var(--text-dim);
    margin-top: 6px;
    cursor: pointer;
    user-select: none;
  }
  .auto input {
    accent-color: var(--accent);
  }
  .foot {
    font-size: 12.5px;
  }
</style>
