import 'dotenv/config';
import path from 'node:path';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storageDir = path.resolve(process.env.DATA_DIR || path.join(appDir, 'storage'));
const authFile = path.join(storageDir, 'auth.json');

let password = process.argv[2] || '';
if (!password) {
  const rl = readline.createInterface({ input, output });
  password = await rl.question('输入新的站主密码（至少 10 位）: ');
  rl.close();
}
if (!password || password.length < 10) {
  console.error('密码至少需要 10 位。');
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const hash = await new Promise((resolve, reject) => {
  crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => err ? reject(err) : resolve(key));
});
let record = {};
try { record = JSON.parse(await fsp.readFile(authFile, 'utf8')); } catch {}
record = {
  ...record,
  username: process.env.ADMIN_USERNAME || record.username || 'LanGYou',
  salt: salt.toString('base64'),
  hash: hash.toString('base64'),
  version: (Number(record.version) || 0) + 1,
  updatedAt: new Date().toISOString(),
};
await fsp.mkdir(storageDir, { recursive: true });
await fsp.writeFile(authFile, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
console.log('密码已更新。现有登录会话已失效。');
