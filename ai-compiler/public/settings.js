let loadedPort = 3000; // 上次读取到的端口，输入留空时沿用
let hasApiKey = false; // 是否已配置密钥（输入框不回显，留空表示不修改）

function openSettings() {
  fetch('/api/config')
    .then((r) => r.json())
    .then((cfg) => {
      $('set-baseurl').value = cfg.baseUrl || '';
      $('set-model').value = cfg.model || '';
      $('set-port').value = cfg.port || '';
      loadedPort = cfg.port || 3000;
      $('set-temperature').value = cfg.temperature ?? '';
      $('set-maxtokens').value = cfg.maxTokens ?? '';
      $('set-fontsize').value = cfg.fontSize ?? '';
      $('set-apikey').value = '';
      hasApiKey = Boolean(cfg.hasApiKey);
      $('set-apikey-hint').textContent = hasApiKey ? '已配置（留空表示不修改）' : '尚未配置，请填写';
      $('settings-msg').textContent = '';
      $('settings-msg').className = 'settings-msg';
      $('settings-panel').classList.add('open');
      $('set-baseurl').focus();
    })
    .catch(() => {
      $('settings-msg').textContent = '读取配置失败，请确认后端已启动';
      $('settings-msg').className = 'settings-msg err';
      $('settings-panel').classList.add('open');
    });
}

function closeSettings() { $('settings-panel').classList.remove('open'); }

function settingsMsg(text, ok) {
  const el = $('settings-msg');
  el.textContent = text;
  el.className = 'settings-msg ' + (ok ? 'ok' : 'err');
}

function currentSettingsBody() {
  const portInput = Number($('set-port').value);
  const tempInput = $('set-temperature').value.trim();
  const tokensInput = $('set-maxtokens').value.trim();
  const fontInput = $('set-fontsize').value.trim();
  return {
    baseUrl: $('set-baseurl').value.trim(),
    apiKey: $('set-apikey').value.trim(),
    model: $('set-model').value.trim(),
    port: Number.isInteger(portInput) && portInput > 0 ? portInput : loadedPort,
    temperature: tempInput === '' ? '' : Number(tempInput),
    maxTokens: tokensInput === '' ? '' : Number(tokensInput),
    fontSize: fontInput === '' ? '' : Number(fontInput),
  };
}

async function saveSettings() {
  const body = currentSettingsBody();
  try {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { settingsMsg(`保存失败：${data.error}`, false); return; }
    settingsMsg('已保存：接口地址/密钥/模型/温度/长度/字号即时生效，端口下次启动生效', true);
    // 同步状态栏模型名与编辑器字号
    setStatusModel(body.model ? `模型：${body.model}` : '模型：未配置');
    if (typeof applyFontSize === 'function') applyFontSize(body.fontSize === '' ? 14 : body.fontSize);
  } catch (err) {
    settingsMsg(`保存失败：${err.message}`, false);
  }
}

async function testSettings() {
  const body = currentSettingsBody();
  // 密钥输入框留空时：若已配置则用已保存的密钥测试（后端回退），否则提示填写
  if (!body.apiKey && !hasApiKey) { settingsMsg('测试连接需要填写 API 密钥', false); return; }
  settingsMsg('正在测试连接…', true);
  try {
    const res = await fetch('/api/test-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    settingsMsg(data.ok ? `成功：${data.message}` : `失败：${data.error}`, data.ok);
  } catch (err) {
    settingsMsg(`测试失败：${err.message}`, false);
  }
}

$('act-settings').addEventListener('click', openSettings);
$('btn-settings-save').addEventListener('click', saveSettings);
$('btn-settings-test').addEventListener('click', testSettings);
$('btn-settings-close').addEventListener('click', closeSettings);
$('settings-panel').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSettings(); });
// 状态栏模型名点击直接打开设置
$('status-model').addEventListener('click', openSettings);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('settings-panel').classList.contains('open')) closeSettings();
});
