import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const builtHtmlPath = path.join(dist, 'dev.html');

async function buildStandalone() {
  let html = await readFile(builtHtmlPath, 'utf8');

  const cssPattern = /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g;
  for (const match of [...html.matchAll(cssPattern)]) {
    const css = await readFile(path.resolve(dist, match[1]), 'utf8');
    const inline = css.replace(/<\/style/gi, '<\\/style');
    html = html.replace(match[0], () => '<style>\n' + inline + '\n</style>');
  }

  const scriptPattern = /<script[^>]*src="([^"]+)"[^>]*><\/script>/g;
  for (const match of [...html.matchAll(scriptPattern)]) {
    const js = await readFile(path.resolve(dist, match[1]), 'utf8');
    const inline = js.replace(/<\/script/gi, '<\\/script');
    html = html.replace(match[0], () => '<script type="module">\n' + inline + '\n</script>');
  }

  html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>\s*/g, '');
  html = html.replace('<head>', '<head>\n  <meta name="generator" content="Aether Garden standalone build" />');

  if (/<script[^>]*src="/.test(html) || /<link[^>]*rel="stylesheet"/.test(html)) {
    throw new Error('Standalone build still contains external CSS or JS references.');
  }

  await writeFile(path.join(root, 'index.html'), html, 'utf8');
  await writeFile(path.join(dist, 'index.html'), html, 'utf8');
  console.log('Standalone index.html written (' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KiB)');
}

await buildStandalone();
