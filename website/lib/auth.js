import crypto from 'node:crypto';
import { parseCookies, safeEqual } from './util.js';

const COOKIE_NAME = 'ly_session';
const SESSION_DAYS = 7;

export async function createAuth({ users, secret, secureCookie = true, sessionDays = SESSION_DAYS }) {
  if (!secret) throw new Error('AUTH_SECRET 未配置');

  function sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return body + '.' + sig;
  }

  async function verify(token) {
    if (!token || typeof token !== 'string') return null;
    const idx = token.lastIndexOf('.');
    if (idx <= 0) return null;
    const body = token.slice(0, idx);
    const sig = token.slice(idx + 1);
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    if (!safeEqual(sig, expected)) return null;
    let payload;
    try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
    if (!payload || !payload.exp || payload.exp < Date.now()) return null;
    const user = await users.findById(payload.uid);
    if (!user || user.disabled) return null;
    if (user.role !== payload.role) return null;
    if (Number(user.passwordVersion) !== Number(payload.pv)) return null;
    return { ...payload, user };
  }

  function issue(user) {
    const csrf = crypto.randomBytes(24).toString('base64url');
    const exp = Date.now() + sessionDays * 24 * 60 * 60 * 1000;
    const token = sign({ uid: user.id, role: user.role, pv: user.passwordVersion, csrf, exp, iat: Date.now() });
    return { token, csrf, exp, user };
  }

  async function login(identifier, password) {
    const user = await users.verifyCredentials(identifier, password);
    if (!user) {
      await new Promise((r) => setTimeout(r, 260));
      return null;
    }
    return issue(user);
  }

  async function sessionFromRequest(req) {
    const cookies = parseCookies(req.headers.cookie || '');
    return verify(cookies[COOKIE_NAME]);
  }

  function setCookie(res, token) {
    const parts = [
      COOKIE_NAME + '=' + encodeURIComponent(token),
      'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + sessionDays * 24 * 60 * 60,
    ];
    if (secureCookie) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  function clearCookie(res) {
    const parts = [COOKIE_NAME + '=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
    if (secureCookie) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  async function changePassword(userId, currentPassword, nextPassword) {
    const user = await users.findById(userId);
    if (!user) return false;
    const { verifyPassword } = await import('./password.js');
    const ok = await verifyPassword(currentPassword, user);
    if (!ok) return false;
    await users.setPassword(userId, nextPassword);
    return true;
  }

  return {
    login, issue, verify, sessionFromRequest, setCookie, clearCookie, changePassword, cookieName: COOKIE_NAME,
  };
}
