function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function createMailer(options = {}) {
  const mode = options.mode || 'console';
  const from = options.from || options.user || '';
  let transport = null;

  async function getTransport() {
    if (transport) return transport;
    if (!options.host || !options.user || !options.pass) throw new Error('邮件服务尚未配置');
    const nodemailer = await import('nodemailer');
    transport = nodemailer.default.createTransport({
      host: options.host,
      port: Number(options.port) || 465,
      secure: options.secure !== false,
      auth: { user: options.user, pass: options.pass },
    });
    return transport;
  }

  async function sendCode({ to, code, purpose }) {
    const label = purpose === 'reset' ? '重置密码' : '注册账号';
    const subject = 'LanGYou Archive · ' + label + '验证码';
    const text = '你的' + label + '验证码是 ' + code + '，10 分钟内有效。如果不是你本人操作，请忽略这封邮件。';
    const html = '<div style="font-family:Georgia,serif;background:#f1ece2;color:#0b0b0d;padding:32px">'
      + '<p style="font:11px monospace;letter-spacing:.14em">LANGYOU ARCHIVE</p>'
      + '<h1 style="font-size:28px;margin:16px 0">' + label + '验证码</h1>'
      + '<p style="font:12px monospace;letter-spacing:.3em;background:#0b0b0d;color:#f1ece2;padding:16px 20px;display:inline-block">' + code + '</p>'
      + '<p style="font-size:13px;color:#555">10 分钟内有效。如果不是你本人操作，请忽略这封邮件。</p>'
      + '</div>';
    if (mode === 'console') {
      console.log('[mail] ' + label + ' code for ' + to + ': ' + code);
      return { dev: true };
    }
    const tx = await getTransport();
    await tx.sendMail({ from, to, subject, text, html });
    return { dev: false };
  }

  return { mode, sendCode };
}
