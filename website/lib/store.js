import path from 'node:path';
import { ensureDir, readJson, writeJsonAtomic } from './util.js';

export async function createStore(storageDir) {
  const file = path.join(storageDir, 'works.json');
  await ensureDir(storageDir);
  await readJson(file, { works: [] });

  let queue = Promise.resolve();

  function mutate(fn) {
    const run = queue.then(async () => {
      const data = await readJson(file, { works: [] });
      if (!Array.isArray(data.works)) data.works = [];
      const result = await fn(data);
      await writeJsonAtomic(file, data);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  async function list() {
    const data = await readJson(file, { works: [] });
    return Array.isArray(data.works) ? data.works : [];
  }

  async function get(id) {
    return (await list()).find((w) => w.id === id) || null;
  }

  async function add(work) {
    return mutate((data) => {
      data.works.push(work);
      return work;
    });
  }

  async function update(id, patch) {
    return mutate((data) => {
      const idx = data.works.findIndex((w) => w.id === id);
      if (idx === -1) return null;
      data.works[idx] = { ...data.works[idx], ...patch, id, updatedAt: new Date().toISOString() };
      return data.works[idx];
    });
  }

  async function remove(id) {
    return mutate((data) => {
      const idx = data.works.findIndex((w) => w.id === id);
      if (idx === -1) return null;
      const [removed] = data.works.splice(idx, 1);
      return removed;
    });
  }

  async function stats() {
    const works = await list();
    return { uploads: works.length, featured: works.filter((w) => w.featured).length };
  }

  return { file, list, get, add, update, remove, stats };
}
