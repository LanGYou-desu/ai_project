import crypto from 'node:crypto';
import { safeEqual } from './util.js';

export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? Buffer.from(saltB64, 'base64') : crypto.randomBytes(16);
  const hash = await new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => err ? reject(err) : resolve(key));
  });
  return { salt: salt.toString('base64'), hash: hash.toString('base64') };
}

export async function verifyPassword(password, record) {
  const { hash } = await hashPassword(password, record.salt);
  return safeEqual(hash, record.hash);
}
