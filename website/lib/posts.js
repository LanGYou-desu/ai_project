import path from 'node:path';
import { ensureDir, readJson, writeJsonAtomic, randomId } from './util.js';

export async function createPostStore(storageDir) {
  const file = path.join(storageDir, 'posts.json');
  await ensureDir(storageDir);
  await readJson(file, { posts: [] });
  let queue = Promise.resolve();

  function mutate(fn) {
    const run = queue.then(async () => {
      const data = await readJson(file, { posts: [] });
      if (!Array.isArray(data.posts)) data.posts = [];
      const result = await fn(data);
      await writeJsonAtomic(file, data);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  async function list() {
    const data = await readJson(file, { posts: [] });
    return Array.isArray(data.posts) ? data.posts : [];
  }

  async function add(post) {
    return mutate((data) => {
      const entry = { ...post, id: randomId('p'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      data.posts.push(entry);
      return entry;
    });
  }

  async function update(id, patch) {
    return mutate((data) => {
      const idx = data.posts.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      data.posts[idx] = { ...data.posts[idx], ...patch, id, updatedAt: new Date().toISOString() };
      return data.posts[idx];
    });
  }

  async function remove(id) {
    return mutate((data) => {
      const idx = data.posts.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      const [removed] = data.posts.splice(idx, 1);
      return removed;
    });
  }

  return { file, list, add, update, remove };
}
