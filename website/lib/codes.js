import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDir, readJson, writeJsonAtomic } from './util.js';

const TTL_MS = 10 * 60 * 1000;
const RESEND_MS = 60 * 1000;
const MAX_ATTEMPTS = 6;

function hashCode(email, purpose, code, secret) {
  return crypto.createHmac('sha256', secret).update([email, purpose, code].join(':')).digest('hex');
}

export async function createCodeStore({ storageDir, secret }) {
  const file = path.join(storageDir, 'codes.json');
  await ensureDir(storageDir);
  let queue = Promise.resolve();

  function mutate(fn) {
    const run = queue.then(async () => {
      const data = await readJson(file, { codes: [] });
      if (!Array.isArray(data.codes)) data.codes = [];
      const now = Date.now();
      data.codes = data.codes.filter((c) => c.expiresAt > now);
      const result = await fn(data);
      await writeJsonAtomic(file, data);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  async function issue(email, purpose) {
    const normalized = String(email).trim().toLowerCase();
    return mutate(async (data) => {
      const last = data.codes.filter((c) => c.email === normalized && c.purpose === purpose).sort((a,b)=>b.createdAt-a.createdAt)[0];
      if (last && Date.now() - last.createdAt < RESEND_MS) {
        const wait = Math.ceil((RESEND_MS - (Date.now() - last.createdAt)) / 1000);
        const err = new Error('请 ' + wait + ' 秒后再获取验证码');
        err.status = 429;
        throw err;
      }
      data.codes = data.codes.filter((c) => !(c.email === normalized && c.purpose === purpose));
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      data.codes.push({
        email: normalized, purpose, hash: hashCode(normalized, purpose, code, secret),
        attempts: 0, createdAt: Date.now(), expiresAt: Date.now() + TTL_MS,
      });
      return code;
    });
  }

  async function consume(email, purpose, code) {
    const normalized = String(email).trim().toLowerCase();
    const value = String(code || '').trim();
    return mutate(async (data) => {
      const record = data.codes.find((c) => c.email === normalized && c.purpose === purpose);
      if (!record) return false;
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts > MAX_ATTEMPTS || record.expiresAt < Date.now()) {
        data.codes = data.codes.filter((c) => c !== record);
        return false;
      }
      if (record.hash !== hashCode(normalized, purpose, value, secret)) return false;
      data.codes = data.codes.filter((c) => c !== record);
      return true;
    });
  }

  return { issue, consume };
}
