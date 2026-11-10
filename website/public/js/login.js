/* login */
const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');
const submit = form.querySelector('.login-submit');
const wrap = document.querySelector('.login-form-wrap');

const showError = (message) => {
  errorEl.textContent = message;
  wrap.classList.remove('shake');
  void wrap.offsetWidth;
  wrap.classList.add('shake');
};

let guestSession = null;
const guestBtn = document.getElementById('guestLogin');
const guestNote = document.querySelector('.guest-note');

function setGuestMode(session) {
  guestSession = session;
  guestBtn.querySelector('span').textContent = '退出游客模式';
  guestBtn.classList.add('is-guest');
  guestNote.textContent = '当前为游客模式：可以浏览、游玩与下载，但不能发布手记或进入工作室。';
}

(async () => {
  try {
    const res = await fetch('/api/session', { headers: { accept: 'application/json' } });
    const data = await res.json();
    if (data.authenticated && data.user?.role === 'owner') location.replace('/studio?t=' + Date.now());
    else if (data.authenticated && data.user?.role === 'guest') setGuestMode(data);
  } catch {}
})();

guestBtn.addEventListener('click', async () => {
  guestBtn.disabled = true;
  try {
    if (guestSession) {
      await fetch('/api/logout', { method: 'POST', headers: { 'x-csrf-token': guestSession.csrf } });
      location.reload();
    } else {
      const res = await fetch('/api/guest', { method: 'POST', headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error('游客入口暂时不可用');
      location.replace('/');
    }
  } catch (err) {
    showError(err.message || '游客入口暂时不可用');
    guestBtn.disabled = false;
  }
});

document.getElementById('togglePassword').addEventListener('click', (e) => {
  const input = document.getElementById('password');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  e.currentTarget.textContent = show ? '隐藏' : '显示';
  e.currentTarget.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if (!username || !password) return showError('请输入用户名和密码。');
  submit.disabled = true;
  submit.querySelector('span').textContent = '正在验证…';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '登录失败');
    submit.querySelector('span').textContent = '已进入';
    location.replace('/studio?t=' + Date.now());
  } catch (err) {
    showError(err.message || '登录失败，请稍后再试。');
    submit.disabled = false;
    submit.querySelector('span').textContent = '进入工作室';
    document.getElementById('password').focus();
    document.getElementById('password').select();
  }
});