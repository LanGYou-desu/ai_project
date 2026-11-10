const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const statusEl = $('#authStatus');
const wrap = $('.login-form-wrap');

function setStatus(message, ok = false) {
  statusEl.textContent = message || '';
  statusEl.classList.toggle('is-ok', Boolean(ok));
}
function shake() {
  wrap.classList.remove('shake');
  void wrap.offsetWidth;
  wrap.classList.add('shake');
}
function showPanel(name) {
  $$('.auth-tab').forEach((tab) => {
    const active = tab.dataset.authTab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  $$('.auth-panel').forEach((panel) => { panel.hidden = panel.dataset.authPanel !== name; });
  setStatus('');
}
async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败，请稍后再试');
  return data;
}
function busy(button, on, label) {
  if (!button) return;
  button.disabled = on;
  if (label) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.textContent = on ? label : button.dataset.label;
  }
}

$$('.auth-tab').forEach((tab) => tab.addEventListener('click', () => showPanel(tab.dataset.authTab)));
$$('[data-auth-go]').forEach((btn) => btn.addEventListener('click', () => showPanel(btn.dataset.authGo)));
$$('[data-password-toggle]').forEach((btn) => btn.addEventListener('click', () => {
  const input = document.getElementById(btn.dataset.passwordToggle);
  if (!input) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.textContent = showing ? '显示' : '隐藏';
}));

const CODE_LABELS = { register: '注册', reset: '重置密码' };
$$('[data-send-code]').forEach((btn) => btn.addEventListener('click', async () => {
  const purpose = btn.dataset.sendCode;
  const email = document.getElementById(btn.dataset.email)?.value.trim() || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setStatus('请先填写有效的邮箱');
    document.getElementById(btn.dataset.email)?.focus();
    return;
  }
  const original = btn.dataset.label || btn.textContent;
  btn.dataset.label = original;
  busy(btn, true, '发送中…');
  try {
    const data = await postJson('/api/auth/send-code', { email, purpose });
    setStatus(data.dev ? '验证码已生成（开发模式，请查看服务器日志）' : '验证码已发送，请检查邮箱（包括垃圾箱）', true);
    let left = 60;
    btn.textContent = left + 's 后重发';
    const timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
        btn.disabled = false;
        btn.textContent = original;
        return;
      }
      btn.textContent = left + 's 后重发';
    }, 1000);
  } catch (err) {
    busy(btn, false, original);
    setStatus(err.message || '验证码发送失败');
  }
}));

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const identifier = $('#loginIdentifier').value.trim();
  const password = $('#loginPassword').value;
  if (!identifier || !password) { setStatus('请输入用户名/邮箱和密码'); shake(); return; }
  const submit = event.currentTarget.querySelector('.login-submit');
  busy(submit, true, '登录中…');
  setStatus('');
  try {
    const data = await postJson('/api/login', { identifier, password });
    setStatus('登录成功，正在进入…', true);
    location.replace('/dashboard?t=' + Date.now());
  } catch (err) {
    busy(submit, false, '登录');
    setStatus(err.message || '登录失败');
    shake();
  }
});

$('#registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = $('#registerUsername').value.trim();
  const email = $('#registerEmail').value.trim();
  const code = $('#registerCode').value.trim();
  const password = $('#registerPassword').value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('请输入有效的邮箱'); return; }
  if (password.length < 8) { setStatus('密码至少需要 8 位'); return; }
  if (!/^\d{6}$/.test(code)) { setStatus('请输入 6 位邮箱验证码'); return; }
  const submit = event.currentTarget.querySelector('.login-submit');
  busy(submit, true, '创建中…');
  setStatus('');
  try {
    await postJson('/api/auth/register', { username, email, password, code });
    setStatus('账号已创建，正在进入…', true);
    location.replace('/dashboard?t=' + Date.now());
  } catch (err) {
    busy(submit, false, '创建账号');
    setStatus(err.message || '注册失败');
    shake();
  }
});

$('#resetForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('#resetEmail').value.trim();
  const code = $('#resetCode').value.trim();
  const password = $('#resetPassword').value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('请输入有效的邮箱'); return; }
  if (!/^\d{6}$/.test(code)) { setStatus('请输入 6 位邮箱验证码'); return; }
  if (password.length < 8) { setStatus('新密码至少需要 8 位'); return; }
  const submit = event.currentTarget.querySelector('.login-submit');
  busy(submit, true, '重置中…');
  setStatus('');
  try {
    await postJson('/api/auth/reset', { email, code, password });
    setStatus('密码已重置，正在进入…', true);
    location.replace('/dashboard?t=' + Date.now());
  } catch (err) {
    busy(submit, false, '重置密码');
    setStatus(err.message || '重置失败');
    shake();
  }
});

(async () => {
  try {
    const res = await fetch('/api/session', { headers: { accept: 'application/json' }, cache: 'no-store' });
    const data = await res.json();
    if (data.authenticated) location.replace('/dashboard?t=' + Date.now());
  } catch {}
})();
