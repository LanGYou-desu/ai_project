const SAVE_KEY = 'hollow-signal.save.v1';

function readRaw() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  } catch {
    return null;
  }
}

export const Save = {
  read() {
    const data = readRaw();
    if (!data || typeof data !== 'object') return null;
    if (!Number.isInteger(data.chapter) || data.chapter < 0 || data.chapter > 3) return null;
    return {
      chapter: data.chapter,
      chapterTitle: typeof data.chapterTitle === 'string' ? data.chapterTitle : '',
      records: Array.isArray(data.records) ? data.records.filter((id) => typeof id === 'string') : [],
      endings: data.endings && typeof data.endings === 'object' ? data.endings : {},
      completed: !!data.completed,
      savedAt: Number(data.savedAt) || 0
    };
  },

  write(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        chapter: data.chapter ?? 0,
        chapterTitle: data.chapterTitle ?? '',
        records: data.records ?? [],
        endings: data.endings ?? {},
        completed: !!data.completed,
        savedAt: Date.now()
      }));
    } catch {
      // Storage is a convenience, never a requirement to play.
    }
  },

  clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // Ignore private-mode storage failures.
    }
  }
};
