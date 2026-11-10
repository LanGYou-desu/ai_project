import fsp from 'node:fs/promises';
import path from 'node:path';
import { formatBytes } from './util.js';

export async function createWorks({ appDir, playBase, store, playDir, packageDir, publicDir }) {
  const dataFile = path.join(appDir, 'data', 'projects.json');

  async function catalog() {
    const raw = await fsp.readFile(dataFile, 'utf8');
    return JSON.parse(raw);
  }

  function joinUrl(base, rel) {
    if (!rel) return null;
    return String(base).replace(/\/$/, '') + '/' + String(rel).replace(/^\/+/, '');
  }

  function categoryOf(meta, id) {
    return meta.categories.find((c) => c.id === id) || { id, name: String(id).toUpperCase(), cn: id, accent: '#c9c4b8' };
  }

  function decorateBuiltin(meta, w) {
    const cat = categoryOf(meta, w.category);
    return {
      ...w,
      builtin: true,
      editable: false,
      kind: w.demo ? 'web' : (w.desktop ? 'desktop' : 'download'),
      categoryName: cat.name,
      categoryCn: cat.cn,
      categoryAccent: cat.accent,
      demoUrl: w.demo ? joinUrl(playBase, w.demo) : null,
      downloadUrl: w.download ? joinUrl('/downloads', w.download) : null,
      downloads: w.download ? [{ label: '下载作品', url: joinUrl('/downloads', w.download), size: w.downloadSize || '' }] : [],
      createdAt: null,
      updatedAt: null,
    };
  }

  function decorateUpload(meta, w) {
    const cat = categoryOf(meta, w.category);
    const demoUrl = w.demoPath ? joinUrl(playBase, w.demoPath) : null;
    const downloadUrl = w.downloadPath ? joinUrl('/downloads', w.downloadPath) : null;
    return {
      ...w,
      builtin: false,
      editable: true,
      categoryName: cat.name,
      categoryCn: cat.cn,
      categoryAccent: cat.accent,
      demoUrl,
      downloadUrl,
      downloads: downloadUrl ? [{ label: w.downloadLabel || '下载作品', url: downloadUrl, size: w.downloadSize ? formatBytes(w.downloadSize) : '' }] : [],
    };
  }

  async function publicWorks() {
    const meta = await catalog();
    const uploads = (await store.list()).filter((w) => w.visible !== false);
    const builtins = meta.works.map((w) => decorateBuiltin(meta, w));
    const decoratedUploads = uploads.map((w) => decorateUpload(meta, w)).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return { meta, works: [...builtins, ...decoratedUploads] };
  }

  async function adminWorks() {
    const meta = await catalog();
    const uploads = await store.list();
    const builtins = meta.works.map((w) => decorateBuiltin(meta, w)).map((w) => ({ ...w, visible: true }));
    const decoratedUploads = uploads.map((w) => decorateUpload(meta, w)).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return { meta, works: [...builtins, ...decoratedUploads] };
  }

  async function getWork(id) {
    const { meta, works: list } = await publicWorks();
    const w = list.find((x) => x.id === id);
    if (!w) return null;
    return { meta, work: w };
  }

  async function stats() {
    const { works: list } = await publicWorks();
    const uploads = await store.stats();
    const assertions = list.reduce((sum, w) => sum + (Number(w.tests) || 0), 0);
    return {
      works: list.length,
      uploads: uploads.uploads,
      assertions,
      categories: new Set(list.map((w) => w.category)).size,
      featured: list.filter((w) => w.featured).length,
    };
  }

  async function removeFiles(work) {
    const targets = [];
    if (work.cover && String(work.cover).startsWith('/covers/uploads/')) {
      targets.push(path.join(publicDir, work.cover.replace(/^\//, '')));
    }
    if (work.demoPath && !String(work.demoPath).includes('..')) {
      targets.push(path.join(playDir, work.demoPath));
    }
    if (work.downloadPath && !String(work.downloadPath).includes('..')) {
      targets.push(path.join(packageDir, work.downloadPath));
    }
    for (const target of targets) {
      try { await fsp.rm(target, { recursive: true, force: true }); } catch {}
    }
  }

  return { catalog, publicWorks, adminWorks, getWork, stats, removeFiles };
}
