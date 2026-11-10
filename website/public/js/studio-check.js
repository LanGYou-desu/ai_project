(function () {
  var attempted = false;
  function statsReady() {
    var el = document.getElementById('studioStats');
    return !!(el && el.textContent && el.textContent.indexOf('—') === -1);
  }
  function showNote() {
    if (document.getElementById('studioBootNote') || statsReady()) return;
    var el = document.createElement('div');
    el.id = 'studioBootNote';
    el.textContent = '正在重新连接工作室…如果长时间空白，请刷新页面。';
    el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;background:#0b0b0d;color:#f1ece2;padding:10px 16px;font:9px ui-monospace,monospace;letter-spacing:.04em;';
    document.body.appendChild(el);
  }
  function retryModule() {
    if (attempted || statsReady()) return;
    attempted = true;
    showNote();
    var s = document.createElement('script');
    s.type = 'module';
    s.src = '/js/studio.js?retry=' + Date.now();
    document.body.appendChild(s);
  }
  setTimeout(retryModule, 1400);
  window.addEventListener('load', function () { setTimeout(retryModule, 900); });
  setTimeout(function () {
    if (statsReady()) return;
    if (sessionStorage.getItem('studioBootRetry') === '1') return;
    sessionStorage.setItem('studioBootRetry', '1');
    location.replace('/studio?reload=' + Date.now());
  }, 7500);
})();
