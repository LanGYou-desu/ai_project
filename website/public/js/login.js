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

(async () => {
  try {
    const res = await fetch('/api/session', { headers: { accept: 'application/json' } });
    const data = await res.json();
    if (data.authenticated) location.replace('/studio');
  } catch {}
})();

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
    location.replace('/studio');
  } catch (err) {
    showError(err.message || '登录失败，请稍后再试。');
    submit.disabled = false;
    submit.querySelector('span').textContent = '进入工作室';
    document.getElementById('password').focus();
    document.getElementById('password').select();
  }
});
