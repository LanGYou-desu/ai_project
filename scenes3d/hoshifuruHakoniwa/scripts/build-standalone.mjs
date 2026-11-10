import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const builtHtmlPath = path.join(dist, 'dev.html');

async function inlineStandalone() {
  let html = await readFile(builtHtmlPath, 'utf8');

  const cssPattern = /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g;
  const cssMatches = [...html.matchAll(cssPattern)];
  for (const match of cssMatches) {
    const cssPath = path.resolve(dist, match[1]);
    const css = await readFile(cssPath, 'utf8');
    const inlineCss = css.replace(/<\/style/gi, '<\\/style');
    html = html.replace(match[0], () => '<style>\n' + inlineCss + '\n</style>');
  }

  const scriptPattern = /<script[^>]*src="([^"]+)"[^>]*><\/script>/g;
  const scriptMatches = [...html.matchAll(scriptPattern)];
  for (const match of scriptMatches) {
    const scriptPath = path.resolve(dist, match[1]);
    const js = await readFile(scriptPath, 'utf8');
    const inlineJs = js.replace(/<\/script/gi, '<\\/script');
    html = html.replace(match[0], () => '<script type="module">\n' + inlineJs + '\n</script>');
  }

  html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>\s*/g, '');
  html = html.replace(
    '<head>',
    '<head>\n  <meta name="generator" content="Hoshifuru Hakoniwa standalone build" />'
  );

  if (/<script[^>]*src="/.test(html) || /<link[^>]*rel="stylesheet"/.test(html)) {
    throw new Error('Standalone build still contains external CSS or JS references.');
  }

  await writeFile(path.join(root, 'index.html'), html, 'utf8');
  await writeFile(path.join(dist, 'index.html'), html, 'utf8');
  console.log('Standalone index.html written (' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KiB)');
}

await inlineStandalone();
