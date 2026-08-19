// 墨战 · 天书纪 — 笔迹识别引擎 v2（膨胀容差 + 长宽比特征 + 四维融合）
// 方案：轨迹归一化 → 64×64 位图（+1px 膨胀容差）→ 与候选字楷体参考图做
// IoU 像素重合 + 8 方向链码直方图 + 墨量密度 + 长宽比 四维特征加权打分。
(function (g) {
  'use strict';

  const SIZE = 64;
  const FONT = 'bold 56px KaiTi, STKaiti, "楷体", "KaiTi", serif';

  // ---------- 轨迹 → 位图 ----------
  function normalizePoints(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX, h = maxY - minY;
    if (w < 4 || h < 4) return null; // 太短，视为无效笔画
    const scale = (SIZE - 8) / Math.max(w, h);
    const ox = (SIZE - w * scale) / 2, oy = (SIZE - h * scale) / 2;
    return points.map(p => ({ x: (p.x - minX) * scale + ox, y: (p.y - minY) * scale + oy }));
  }

  function rasterize(normPoints, lineW) {
    const img = new Uint8Array(SIZE * SIZE);
    if (!normPoints) return img;
    const lw = Math.max(2, lineW || 3.5);
    const ctx = g.__inkRasterCtx;
    if (!ctx) return img;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(normPoints[0].x, normPoints[0].y);
    for (let i = 1; i < normPoints.length; i++) ctx.lineTo(normPoints[i].x, normPoints[i].y);
    ctx.stroke();
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
    for (let i = 0; i < img.length; i++) img[i] = data[i * 4 + 3] > 40 ? 1 : 0;
    return img;
  }

  // 8 邻域膨胀 1 圈：容忍手写与字形的细微偏移
  function dilate(img) {
    const out = new Uint8Array(img.length);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (img[y * SIZE + x]) { out[y * SIZE + x] = 1; continue; }
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && img[ny * SIZE + nx]) { hit = true; break; }
          }
        }
        if (hit) out[y * SIZE + x] = 1;
      }
    }
    return out;
  }

  function ensureRasterCtx() {
    if (g.__inkRasterCtx) return;
    const cv = document.createElement('canvas');
    cv.width = SIZE; cv.height = SIZE;
    g.__inkRasterCtx = cv.getContext('2d');
  }

  // ---------- 候选字 → 参考位图（缓存） ----------
  const refCache = new Map();
  function renderReference(ch) {
    ensureRasterCtx();
    if (refCache.has(ch)) return refCache.get(ch);
    const ctx = g.__inkRasterCtx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    // 先描边再填充，让细笔画有足够墨量
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.lineJoin = 'round';
    ctx.strokeText(ch, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
    const img = new Uint8Array(SIZE * SIZE);
    for (let i = 0; i < img.length; i++) img[i] = data[i * 4 + 3] > 40 ? 1 : 0;
    refCache.set(ch, img);
    return img;
  }

  // ---------- 特征 ----------
  function iou(a, b) {
    let inter = 0, union = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] && b[i]) inter++;
      if (a[i] || b[i]) union++;
    }
    return union === 0 ? 0 : inter / union;
  }

  function inkDensity(a) {
    let c = 0;
    for (let i = 0; i < a.length; i++) c += a[i];
    return c / a.length;
  }

  // 非零像素的包围盒长宽比
  function aspectRatio(img) {
    let minX = SIZE, minY = SIZE, maxX = -1, maxY = -1;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (img[y * SIZE + x]) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return 1;
    const w = maxX - minX + 1, h = maxY - minY + 1;
    return w / h;
  }

  // 8 方向链码直方图
  function chainHist(points) {
    const h = new Array(8).fill(0);
    if (!points || points.length < 2) return h;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const ang = Math.atan2(dy, dx);
      const bin = Math.round(((ang + Math.PI) / Math.PI) * 4) % 8;
      h[bin] += Math.hypot(dx, dy);
    }
    const total = h.reduce((s, v) => s + v, 0) || 1;
    return h.map(v => v / total);
  }

  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  // ---------- 主识别入口 ----------
  // 返回 [{ch, score, iou}] 降序
  function recognize(points, candidates) {
    ensureRasterCtx();
    const norm = normalizePoints(points);
    if (!norm) return [];
    const strokeImg = dilate(rasterize(norm, 3.5));
    const sHist = chainHist(norm);
    const sDensity = inkDensity(strokeImg);
    const sAspect = aspectRatio(strokeImg);
    const out = [];
    const unique = [...new Set(candidates)];
    for (const ch of unique) {
      const ref = renderReference(ch);
      const i = iou(strokeImg, ref);
      const cs = cosine(sHist, chainHistFromRef(ref, ch));
      const dd = 1 - Math.min(1, Math.abs(sDensity - inkDensity(ref)) * 1.6);
      const rAspect = aspectRatio(ref);
      const as = 1 - Math.min(1, Math.abs(Math.log(sAspect / Math.max(0.2, rAspect))) * 1.2);
      const score = i * 0.50 + cs * 0.26 + dd * 0.14 + as * 0.10;
      out.push({ ch, score, iou: i });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  const histCache = new Map();
  function chainHistFromRef(ref, ch) {
    if (histCache.has(ch)) return histCache.get(ch);
    const h = new Array(8).fill(0);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!ref[y * SIZE + x]) continue;
        for (const [dx, dy] of [[1,0],[0,1],[1,1],[1,-1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && ref[ny * SIZE + nx]) {
            const ang = Math.atan2(dy, dx);
            const bin = Math.round(((ang + Math.PI) / Math.PI) * 4) % 8;
            h[bin]++;
          }
        }
      }
    }
    const total = h.reduce((s, v) => s + v, 0) || 1;
    const norm = h.map(v => v / total);
    histCache.set(ch, norm);
    return norm;
  }

  function match(points, candidates, threshold) {
    const res = recognize(points, candidates);
    if (!res.length) return null;
    const best = res[0];
    if (best.score >= (threshold ?? 0.15)) return best;
    return null;
  }

  // 大号临摹导引字（160px，缓存）
  const guideCache = new Map();
  function getGuideCanvas(ch) {
    if (guideCache.has(ch)) return guideCache.get(ch);
    const cv = document.createElement('canvas');
    cv.width = 160; cv.height = 160;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 128px KaiTi, STKaiti, "楷体", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(42,32,24,0.85)';
    ctx.strokeText(ch, 80, 82);
    ctx.fillStyle = 'rgba(42,32,24,0.45)';
    ctx.fillText(ch, 80, 82);
    guideCache.set(ch, cv);
    return cv;
  }

  // 书写动画：沿对角线逐渐"写"出导引字（progress 0→1）
  function drawGuideAnimated(ctx, ch, x, y, w, h, progress) {
    const gcv = getGuideCanvas(ch);
    ctx.save();
    const p = Math.max(0, Math.min(1, progress));
    ctx.beginPath();
    ctx.moveTo(x, y + h * (1 - p));
    ctx.lineTo(x + w * p, y + h * (1 - p));
    ctx.lineTo(x + w * p, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(gcv, x, y, w, h);
    ctx.restore();
  }

  g.INK_RECOGNITION = { recognize, match, renderReference, getGuideCanvas, drawGuideAnimated, SIZE, normalizePoints, rasterize, dilate, iou, inkDensity, aspectRatio, chainHist, cosine, clearCache: () => { refCache.clear(); histCache.clear(); guideCache.clear(); } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
