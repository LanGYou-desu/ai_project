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
    const status = w.status || 'approved';
    const demoUrl = w.demoPath ? joinUrl(playBase, w.demoPath) : null;
    const downloadUrl = w.downloadPath ? joinUrl('/downloads', w.downloadPath) : null;
    return {
      ...w,
      status,
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

  function isPublic(w) {
    if (w.status) return w.status === 'approved' && w.visible !== false;
    return w.visible !== false;
  }

  async function publicWorks() {
    const meta = await catalog();
    const uploads = (await store.list()).filter(isPublic);
    const builtins = meta.works.map((w) => decorateBuiltin(meta, w));
    const decoratedUploads = uploads.map((w) => decorateUpload(meta, w)).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return { meta, works: [...builtins, ...decoratedUploads] };
  }

  async function adminWorks() {
    const meta = await catalog();
    const uploads = await store.list();
    const builtins = meta.works.map((w) => decorateBuiltin(meta, w)).map((w) => ({ ...w, visible: true, status: 'approved' }));
    const rank = { pending: 0, rejected: 1, approved: 2 };
    const decoratedUploads = uploads.map((w) => decorateUpload(meta, w)).sort((a, b) => {
      const byStatus = (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
      return byStatus || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return { meta, works: [...builtins, ...decoratedUploads] };
  }

  async function userWorks(userId) {
    const meta = await catalog();
    const uploads = (await store.list())
      .filter((w) => w.authorId === userId)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return { meta, works: uploads.map((w) => decorateUpload(meta, w)) };
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
      pending: (await store.list()).filter((w) => w.status === 'pending').length,
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

  return { catalog, publicWorks, adminWorks, userWorks, getWork, stats, removeFiles };
}