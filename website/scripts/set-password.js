import 'dotenv/config';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { createUserStore } from '../lib/users.js';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storageDir = path.resolve(process.env.DATA_DIR || path.join(appDir, 'storage'));

let password = process.argv[2] || '';
if (!password) {
  const rl = readline.createInterface({ input, output });
  password = await rl.question('输入管理员的新密码（至少 8 位）: ');
  rl.close();
}
if (!password || password.length < 8) {
  console.error('密码至少需要 8 位。');
  process.exit(1);
}

const users = await createUserStore({
  storageDir,
  adminUsername: process.env.ADMIN_USERNAME || 'LanGYou',
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
});
const admin = (await users.list()).find((u) => u.role === 'admin');
if (!admin) {
  console.error('没有找到管理员账号。');
  process.exit(1);
}
await users.setPassword(admin.id, password);
console.log('管理员密码已更新，现有登录会话已失效。');
