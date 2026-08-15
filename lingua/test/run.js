// LINGUA 测试运行器：node test/run.js
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const r = spawnSync(process.execPath, ['--test', 'test/*.test.js'], { cwd: root, stdio: 'inherit', shell: true });
process.exit(r.status === null ? 1 : r.status);
