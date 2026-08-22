'use strict';

// ── 前端逻辑 ──
// 时间段选择 → 调用 API → 渲染时间线 → 章节（打字机效果）→ 结尾

// ── 当前时间段状态 ──

let currentRange = { days: 7 }; // 默认 7 天

// ── 初始化 ──
// 脚本在 body 底部，DOM 已就绪，直接调用
setupRangePicker();
loadNarrative();
setupUpload();

// ── 时间段选择器 ──

function setupRangePicker() {
  // 预设按钮
  var presets = document.querySelectorAll('.preset');
  for (var i = 0; i < presets.length; i++) {
    presets[i].addEventListener('click', function() {
      // 移除所有 active
      for (var j = 0; j < presets.length; j++) {
        presets[j].classList.remove('active');
      }
      this.classList.add('active');

      var days = parseInt(this.getAttribute('data-days'), 10);
      currentRange = { days: days };

      // 清除自定义日期
      document.getElementById('customStart').value = '';
      document.getElementById('customEnd').value = '';

      loadNarrative();
    });
  }

  // 自定义日期范围
  var btnRange = document.getElementById('btnRange');
  btnRange.addEventListener('click', function() {
    var start = document.getElementById('customStart').value;
    var end = document.getElementById('customEnd').value;

    if (!start || !end) {
      alert('请选择起止日期');
      return;
    }

    if (new Date(start) > new Date(end)) {
      alert('开始日期不能晚于结束日期');
      return;
    }

    // 移除预设 active
    for (var j = 0; j < presets.length; j++) {
      presets[j].classList.remove('active');
    }

    currentRange = { startDate: start, endDate: end };
    loadNarrative();
  });
}

// ── 加载叙事 ──

async function loadNarrative() {
  var container = document.getElementById('chapters');
  container.innerHTML = '<div class="loading">正在翻阅你的历史……</div>';
  document.getElementById('ending').style.display = 'none';

  try {
    var url = '/api/history';
    if (currentRange.days) {
      url += '?days=' + currentRange.days;
    } else if (currentRange.startDate) {
      url += '?start=' + encodeURIComponent(currentRange.startDate) +
             '&end=' + encodeURIComponent(currentRange.endDate);
    }

    var res = await fetch(url);
    if (!res.ok) throw new Error('服务器返回错误: ' + res.status);
    var data = await res.json();

    if (data.error) throw new Error(data.error);

    document.getElementById('date').textContent = data.date;
    document.getElementById('summary').textContent = data.summary;

    renderTimeline(data.chapters);
    renderChapters(data.chapters);
    renderEnding(data.ending);
  } catch (error) {
    container.innerHTML =
      '<div class="error">无法读取历史记录：<br>' + escapeHtml(error.message) + '</div>' +
      '<div class="upload-hint"><p>试试 <a href="#" id="uploadLink">上传 JSON 文件</a></p></div>';
    setupUpload();
  }
}

// ── 渲染时间线 ──

function renderTimeline(chapters) {
  var timeline = document.getElementById('timeline');
  timeline.innerHTML = '';

  if (chapters.length === 0) {
    timeline.style.display = 'none';
    return;
  }

  chapters.forEach(function(chapter) {
    var marker = document.createElement('div');
    marker.className = 'time-marker';
    var timeStart = chapter.time.split('—')[0].trim();
    marker.innerHTML =
      '<div class="dot"></div>' +
      '<div class="label">' + escapeHtml(timeStart) + '</div>';
    timeline.appendChild(marker);
  });
}

// ── 渲染章节 ──

function renderChapters(chapters) {
  var container = document.getElementById('chapters');
  container.innerHTML = '';

  if (chapters.length === 0) {
    container.innerHTML = '<div class="loading">这个时间段没有记录到任何访问。</div>';
    return;
  }

  chapters.forEach(function(chapter) {
    var el = document.createElement('article');
    el.className = 'chapter';
    el.innerHTML =
      '<div class="chapter-header">' +
        '<span class="chapter-time">' + escapeHtml(chapter.time) + '</span>' +
        '<span class="chapter-stats">' + chapter.visits + ' 次访问 · ' + chapter.domains + ' 个网站</span>' +
      '</div>' +
      '<div class="chapter-narrative" data-text="' + escapeHtml(chapter.narrative) + '"></div>';
    container.appendChild(el);
  });

  // 滚动渐显 + 打字机效果
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        var narrative = entry.target.querySelector('.chapter-narrative');
        if (narrative) typewriterEffect(narrative);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.chapter').forEach(function(el) {
    observer.observe(el);
  });
}

// ── 打字机效果 ──

function typewriterEffect(el) {
  var text = el.getAttribute('data-text');
  var i = 0;
  var speed = 25;

  function type() {
    if (i >= text.length) return;

    var nextSpace = text.indexOf(' ', i);
    var nextChunk = nextSpace === -1 ? text.length : nextSpace + 1;
    el.textContent += text.slice(i, nextChunk);
    i = nextChunk;

    var chunk = text.slice(i - 1, i);
    var delay = speed;
    if (chunk === '。' || chunk === '！' || chunk === '？') delay = 250;
    if (chunk === '\n') delay = 400;

    setTimeout(type, delay);
  }

  type();
}

// ── 渲染结尾 ──

function renderEnding(text) {
  var ending = document.getElementById('ending');
  ending.style.display = 'block';
  ending.innerHTML = '<p>' + escapeHtml(text) + '</p>';
}

// ── 上传功能 ──

function setupUpload() {
  var link = document.getElementById('uploadLink');
  var input = document.getElementById('uploadInput');

  if (!link) return;

  link.addEventListener('click', function(e) {
    e.preventDefault();
    if (input) input.click();
  });

  if (input) {
    input.addEventListener('change', async function(e) {
      var file = e.target.files[0];
      if (!file) return;

      try {
        var text = await file.text();
        var data = JSON.parse(text);
        var body = JSON.stringify(data);
        var res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body
        });
        var result = await res.json();

        if (result.error) throw new Error(result.error);

        document.getElementById('date').textContent = result.date;
        document.getElementById('summary').textContent = result.summary;
        document.getElementById('chapters').innerHTML = '';
        document.getElementById('ending').style.display = 'none';

        renderTimeline(result.chapters);
        renderChapters(result.chapters);
        renderEnding(result.ending);
      } catch (err) {
        alert('上传失败：' + err.message);
      }
    });
  }
}

// ── 工具 ──

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}