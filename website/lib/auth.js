import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDir, readJson, writeJsonAtomic, parseCookies, safeEqual } from './util.js';

const COOKIE_NAME = 'ly_session';
const SESSION_DAYS = 7;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

async function hashPassword(password, saltB64) {
  const salt = saltB64 ? Buffer.from(saltB64, 'base64') : crypto.randomBytes(16);
  const hash = await new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => err ? reject(err) : resolve(key));
  });
  return { salt: salt.toString('base64'), hash: hash.toString('base64') };
}

async function verifyHash(password, record) {
  const { hash } = await hashPassword(password, record.salt);
  return safeEqual(hash, record.hash);
}

export async function createAuth(options) {
  const {
    storageDir,
    username = 'LanGYou',
    initialPassword = '',
    secret,
    secureCookie = true,
    sessionDays = SESSION_DAYS,
  } = options;

  const authFile = path.join(storageDir, 'auth.json');
  await ensureDir(storageDir);

  let record = await readJson(authFile, null);
  if (!record) {
    if (!initialPassword || initialPassword.length < 10) {
      throw new Error('首次启动需要设置 ADMIN_PASSWORD（至少 10 位），用于创建站主账号。');
    }
    const { salt, hash } = await hashPassword(initialPassword);
    record = { username, salt, hash, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await writeJsonAtomic(authFile, record);
    try { await fsp.chmod(authFile, 0o600); } catch {}
  }
  if (record.username !== username) {
    record.username = username;
    await writeJsonAtomic(authFile, record);
  }

  function sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return body + '.' + sig;
  }

  function verify(token) {
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
    if (payload.role === 'guest') {
      if (payload.u !== 'Guest') return null;
      return payload;
    }
    if (payload.u !== record.username) return null;
    if (payload.v !== record.version) return null;
    return payload;
  }

  function issue() {
    const csrf = crypto.randomBytes(24).toString('base64url');
    const exp = Date.now() + sessionDays * 24 * 60 * 60 * 1000;
    const token = sign({ u: record.username, role: 'owner', v: record.version, csrf, exp, iat: Date.now() });
    return { token, csrf, exp };
  }

  function issueGuest() {
    const csrf = crypto.randomBytes(24).toString('base64url');
    const exp = Date.now() + sessionDays * 24 * 60 * 60 * 1000;
    const token = sign({ u: 'Guest', role: 'guest', csrf, exp, iat: Date.now() });
    return { token, csrf, exp };
  }

  async function login(user, password) {
    if (!safeEqual(user, record.username)) {
      await new Promise((r) => setTimeout(r, 260));
      return null;
    }
    const ok = await verifyHash(password, record);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 260));
      return null;
    }
    return issue();
  }

  function sessionFromRequest(req) {
    const cookies = parseCookies(req.headers.cookie || '');
    return verify(cookies[COOKIE_NAME]);
  }

  function setCookie(res, token) {
    const parts = [
      COOKIE_NAME + '=' + encodeURIComponent(token),
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=' + sessionDays * 24 * 60 * 60,
    ];
    if (secureCookie) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  function clearCookie(res) {
    const parts = [COOKIE_NAME + '=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
    if (secureCookie) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  async function changePassword(currentPassword, nextPassword) {
    const ok = await verifyHash(currentPassword, record);
    if (!ok) return false;
    if (!nextPassword || nextPassword.length < 10) throw new Error('新密码至少需要 10 位。');
    const { salt, hash } = await hashPassword(nextPassword);
    record = { ...record, salt, hash, version: record.version + 1, updatedAt: new Date().toISOString() };
    await writeJsonAtomic(authFile, record);
    try { await fsp.chmod(authFile, 0o600); } catch {}
    return true;
  }

  return {
    username: record.username,
    login,
    issue,
    issueGuest,
    verify,
    sessionFromRequest,
    setCookie,
    clearCookie,
    changePassword,
    get version() { return record.version; },
    cookieName: COOKIE_NAME,
  };
}
