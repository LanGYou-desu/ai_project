/* LASTBROADCAST · 末日电台 —— 仿真引擎（无随机，完全确定） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else { root.LB = root.LB || {}; root.LB.engine = factory(root.LB.data); }
})(typeof self !== 'undefined' ? self : this, function (data) {
  'use strict';

  var TURN_COUNT = data.TURNS.length; // 12

  // 局内种子随机（新闻变体用）
  function makeRng(seedStr) {
    var h = 2166136261 >>> 0;
    var s = String(seedStr);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var a = h >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v) { return Math.max(0, Math.min(100, v)); }

  function createGame(seed) {
    var chars = {};
    data.CHARACTERS.forEach(function (c) { chars[c.id] = { hope: c.state, flags: {} }; });
    var rnd = makeRng(seed || 'default');
    var variants = {};
    for (var t = 0; t < TURN_COUNT; t++) variants[t] = Math.floor(rnd() * (data.TURN_INTERLUDES[t] ? data.TURN_INTERLUDES[t].length : 1));
    return {
      seed: seed || 'default',
      variants: variants,
      turn: 0,
      hope: 50, mood: 50,
      chars: chars,
      flags: {
        lullaby: false, nostalgic: false, truthCount: 0, requestsFulfilled: 0,
        signalDecoded: false, professorMet: false,
        laozhouHonored: false, veteranHonored: false,
        militaryHandled: false, silenceCount: 0,
        answered: {}, memorialUnlocked: false
      },
      djStamina: 70,          // 你的精力 0-100
      pendingRequest: null,   // { caller, songId } 上一回合的点歌请求
      lowStaminaNoted: false, fatigueNoted: false,
      arcsShown: {},
      finalWords: null,
      log: [], finalChoice: null, done: false
    };
  }

  function char(state, id) { return state.chars[id]; }

  function log(state, text, type) {
    state.log.push({ turn: state.turn, text: text, type: type || 'info' });
  }

  function songById(id) {
    for (var i = 0; i < data.SONGS.length; i++) if (data.SONGS[i].id === id) return data.SONGS[i];
    return null;
  }

  // 歌曲对听众的影响（低精力时效果打折）
  function applySong(state, song) {
    var f = state.djStamina < 30 ? 0.6 : 1;
    if (f < 1 && !state.fatigueNoted) { state.fatigueNoted = true; log(state, '（你太累了，歌放得有些走神。）', 'silence'); }
    state.hope = clamp(state.hope + Math.round(song.hope * f));
    state.mood = clamp(state.mood + Math.round(song.mood * f));
    state.djStamina = clamp(state.djStamina - 3);
    data.CHARACTERS.forEach(function (c) {
      var st = state.chars[c.id];
      var matches = song.tags.filter(function (t) { return c.likes.indexOf(t) >= 0; }).length;
      if (matches > 0) st.hope = clamp(st.hope + Math.round((matches * 2 + (song.hope > 0 ? 1 : 0)) * f));
    });
    if (song.tags.indexOf('lullaby') >= 0) state.flags.lullaby = true;
    if (song.tags.indexOf('nostalgic') >= 0) state.flags.nostalgic = true;
    // 点歌联动：上一回合来电者点的歌，此刻放给他/她
    if (state.pendingRequest && state.pendingRequest.songId === song.id) {
      var who = state.chars[state.pendingRequest.caller];
      if (who) {
        who.hope = clamp(who.hope + 6);
        state.hope = clamp(state.hope + 2);
        state.flags.requestsFulfilled = (state.flags.requestsFulfilled || 0) + 1;
        log(state, '（' + data.charById(state.pendingRequest.caller).name + '等到了那首歌。）', 'call');
      }
      state.pendingRequest = null;
    } else if (state.pendingRequest) {
      log(state, '（你没有放' + data.charById(state.pendingRequest.caller).name + '点的那首歌。她轻轻叹了口气。）', 'call');
      state.pendingRequest = null;
    }
    // 收藏加成（D6）：播放收藏过的歌
    if (state.flags.favs && state.flags.favs.indexOf(song.id) >= 0) {
      state.hope = clamp(state.hope + 1);
      log(state, '（这是你收藏的歌——它听起来格外有力。）', 'song');
    }
    // 记录点播达成
    if (song.tags.indexOf('lullaby') >= 0 && state.flags.lullaby) { /* no-op */ }
  }

  function applyNews(state, tone) {
    var n = data.NEWS[tone];
    var f = state.djStamina < 30 ? 0.7 : 1;
    state.hope = clamp(state.hope + Math.round(n.hope * f));
    state.mood = clamp(state.mood + Math.round(n.mood * f));
    state.djStamina = clamp(state.djStamina - 5);
    if (tone === 'soothe') {
      data.CHARACTERS.forEach(function (c) {
        if (c.id === 'lin' || c.id === 'professor') state.chars[c.id].hope = clamp(state.chars[c.id].hope - 2);
        else state.chars[c.id].hope = clamp(state.chars[c.id].hope + 1);
      });
    } else if (tone === 'truth') {
      state.flags.truthCount++;
      state.chars.lin.hope = clamp(state.chars.lin.hope + 5);
      state.chars.professor.hope = clamp(state.chars.professor.hope + 5);
      state.chars.laozhou.hope = clamp(state.chars.laozhou.hope - 1);
    }
  }

  function applyCall(state, callerId) {
    var call = null;
    for (var i = 0; i < data.CALLS.length; i++) {
      if (data.CALLS[i].turn === state.turn && data.CALLS[i].caller === callerId) { call = data.CALLS[i]; break; }
    }
    if (!call) return { error: '该来电此时不可用' };
    var st = state.chars[callerId];
    var f = state.djStamina < 30 ? 0.8 : 1;
    st.hope = clamp(st.hope + Math.round(4 * f));
    state.djStamina = clamp(state.djStamina - 4);
    if (callerId === 'xiaoyu') st.hope = clamp(st.hope + (state.flags.lullaby ? 8 : 2));
    if (callerId === 'professor') state.flags.professorMet = true;
    if (callerId === 'laozhou') state.flags.laozhouHonored = true;
    if (callerId === 'veteran') state.flags.veteranHonored = true;
    state.flags.answered[callerId] = true;
    if (call.request) state.pendingRequest = { caller: callerId, songId: call.request };
    log(state, call.line + '\n你回答：' + call.reply, 'call');
    return {};
  }

  function applySignal(state, which, choice) {
    if (which === 'military') {
      var m = data.SIGNAL_MILITARY;
      state.flags.militaryHandled = true;
      var opt = null;
      m.options.forEach(function (o) { if (o.id === choice) opt = o; });
      if (!opt) return { error: '未知选择' };
      var f2 = state.djStamina < 30 ? 0.7 : 1;
      state.mood = clamp(state.mood + Math.round(opt.mood * f2));
      state.hope = clamp(state.hope + Math.round(opt.hope * f2));
      state.djStamina = clamp(state.djStamina - 6);
      log(state, m.text + '\n' + opt.result, 'signal');
      return {};
    }
    if (which === 'x') {
      var x = data.SIGNAL_X;
      if (!state.flags.professorMet) { log(state, x.locked, 'signal'); return { locked: true }; }
      var ox = null;
      x.options.forEach(function (o) { if (o.id === choice) ox = o; });
      if (!ox) return { error: '未知选择' };
      state.hope = clamp(state.hope + ox.hope);
      state.mood = clamp(state.mood + ox.mood);
      state.djStamina = clamp(state.djStamina - 6);
      if (choice === 'decode') state.flags.signalDecoded = true;
      log(state, x.text + '\n' + ox.result, 'signal');
      return {};
    }
    return { error: '未知信号' };
  }

  function applyFinal(state, action) {
    var choice = action.choice;
    var ok = false;
    data.FINAL_OPTIONS.forEach(function (o) { if (o.id === choice) ok = true; });
    if (!ok) return { error: '未知选择' };
    state.finalChoice = choice;
    if (action.words && String(action.words).trim()) {
      state.finalWords = String(action.words).trim().slice(0, 120);
      log(state, '你说：「' + state.finalWords + '」', 'final');
    }
    var texts = {
      hope: '你按下麦克风，说：「天会亮的。在那之前——请听我说完最后一首歌。」你放了一整晚的歌。',
      truth: '你按下麦克风，把你知道的一切都说了出来。电波穿过封锁，抵达每一个还醒着的耳朵。',
      companion: '你按下麦克风，只说了一句：「我在。我一直都在。」然后你念了每一个来电者的名字。',
      silence: '你放下麦克风。指示灯暗下去。你坐在这间小小的广播室里，听完了整个城市的沉默。'
    };
    log(state, texts[choice], 'final');
    state.done = true;
    return {};
  }

  // 回合结束时自动事件（第 5 回合军队接管）
  function autoEvents(state, turnJustFinished) {
    if (turnJustFinished === 5 && !state.flags.militaryHandled) {
      state.flags.militaryHandled = true;
      state.mood = clamp(state.mood + data.SIGNAL_MILITARY.autoMood);
      log(state, data.SIGNAL_MILITARY.auto, 'signal');
    }
  }

  // 应用一个动作；返回 { events, done }
  function applyAction(state, action) {
    if (state.done) return { done: true, error: '广播已结束' };
    var result = {};
    if (action.type === 'song') {
      var s = songById(action.songId);
      if (!s) return { error: '未知歌曲' };
      applySong(state, s);
      log(state, '你播放了《' + s.title.replace(/《|》/g, '') + '》：' + s.desc, 'song');
    } else if (action.type === 'news') {
      var n = data.NEWS[action.tone];
      if (!n) return { error: '未知播报' };
      applyNews(state, action.tone);
      log(state, n.text, 'news');
    } else if (action.type === 'call') {
      result = applyCall(state, action.caller);
      if (result.error) return result;
    } else if (action.type === 'signal') {
      result = applySignal(state, action.which, action.choice);
      if (result.error) return result;
    } else if (action.type === 'silence') {
      state.flags.silenceCount++;
      state.mood = clamp(state.mood - 1);
      state.hope = clamp(state.hope - 2);
      state.djStamina = clamp(state.djStamina + 10);
      log(state, '你关掉了麦克风，沉默了一夜。窗外很安静。你睡了一会儿。', 'silence');
    } else if (action.type === 'final') {
      result = applyFinal(state, action);
      return result; // 终局动作不推进回合
    } else {
      return { error: '未知动作' };
    }
    // 未接来电提示（同回合没接到的电话）
    if (action.type !== 'call') {
      data.CALLS.forEach(function (c) {
        if (c.turn === state.turn && c.missed) log(state, c.missed, 'call');
      });
    } else {
      data.CALLS.forEach(function (c) {
        if (c.turn === state.turn && c.caller !== action.caller && c.missed) log(state, c.missed, 'call');
      });
    }
    // 精力过低时的疲惫提示
    if (state.djStamina < 25 && !state.lowStaminaNoted) {
      state.lowStaminaNoted = true;
      log(state, '你的眼皮越来越重。你靠在调音台上，差点睡着。', 'silence');
    }
    // 精力归零：真的睡着了（D2）
    if (state.djStamina === 0) {
      state.hope = clamp(state.hope - 3);
      log(state, '你睡着了。城市的夜里，少了一段广播。', 'silence');
    }
    // 推进回合
    var finished = state.turn;
    state.turn++;
    if (state.turn >= TURN_COUNT) { state.done = true; }
    autoEvents(state, finished);
    // 新回合的意外插曲（按局变体）
    if (state.turn > 0 && state.turn < TURN_COUNT) {
      var pool = data.TURN_INTERLUDES[state.turn];
      var interlude = pool ? pool[state.variants[state.turn] % pool.length] : '';
      if (interlude) log(state, '（' + interlude + '）', 'interlude');
    }
    // 听众支线（A5）
    data.ARCS.forEach(function (arc, idx) {
      var key = idx;
      if (state.arcsShown[key]) return;
      if (arc.cond && arc.cond(state)) {
        state.arcsShown[key] = true;
        log(state, '💌 ' + data.charById(arc.char).name + '：' + arc.text, 'call');
      }
    });
    return { done: state.done, advanced: true };
  }

  // 当前回合可用动作（供 UI 渲染）
  function availableActions(state) {
    if (state.done) return [];
    var list = [];
    if (state.turn === TURN_COUNT - 1) {
      data.FINAL_OPTIONS.forEach(function (o) {
        list.push({ type: 'final', choice: o.id, label: o.label, hint: o.hint });
      });
      return list;
    }
    list.push({ type: 'song', label: '播放歌曲', unlockable: data.SONGS.filter(function (s) { return !s.unlockTurn || state.turn >= s.unlockTurn; }).length < data.SONGS.length });
    list.push({ type: 'news', label: '新闻播报' });
    data.CALLS.forEach(function (c) { if (c.turn === state.turn) list.push({ type: 'call', caller: c.caller, label: '接听来电 · ' + data.charById(c.caller).name }); });
    if (state.turn === data.SIGNAL_MILITARY.turn) list.push({ type: 'signal', which: 'military', label: '回应军用电台' });
    if (state.turn === data.SIGNAL_X.turn && state.flags.professorMet) list.push({ type: 'signal', which: 'x', label: '解码 FREQUENCY X' });
    list.push({ type: 'silence', label: '沉默' });
    return list;
  }

  function cityPhase(hope) {
    if (hope >= 70) return 'bright';
    if (hope >= 40) return 'dim';
    if (hope >= 20) return 'dark';
    return 'ruin';
  }

  function computeEnding(state) {
    var f = state.flags;
    if (state.finalChoice === 'silence' || state.hope < 20) return data.ENDINGS.dust;
    if (f.memorialUnlocked && state.finalChoice !== 'silence' && state.hope >= 40) return data.ENDINGS.memorial;
    if (state.finalChoice === 'hope' && f.silenceCount === 0 && state.hope >= 75) return data.ENDINGS.beacon;
    if (state.finalChoice === 'hope' && f.signalDecoded && !f.lullaby) return data.ENDINGS.lighthouse;
    if (state.finalChoice === 'hope' && f.lullaby && state.hope >= 50) return data.ENDINGS.dawn;
    if (state.finalChoice === 'truth' && f.signalDecoded && f.lullaby) return data.ENDINGS.afterglow;
    if (state.finalChoice === 'truth' && f.signalDecoded) return data.ENDINGS.signal;
    if (state.finalChoice === 'companion' && f.lullaby && f.answered && f.answered.xiaoyu && f.answered.twins) return data.ENDINGS.nightingale;
    if (state.finalChoice === 'companion' && (f.laozhouHonored || f.veteranHonored)) return data.ENDINGS.fire;
    // 兜底
    if (state.finalChoice === 'companion') {
      if (state.hope >= 50) return data.ENDINGS.fire;
      return data.ENDINGS.dust;
    }
    if (state.finalChoice === 'hope') {
      if (state.hope >= 50) return data.ENDINGS.dawn;
      return data.ENDINGS.fire;
    }
    if (state.finalChoice === 'truth') {
      if (f.signalDecoded) return data.ENDINGS.signal;
      if (state.hope >= 50) return data.ENDINGS.fire;
      return data.ENDINGS.dust;
    }
    return data.ENDINGS.dust;
  }

  function ending(state) {
    if (!state.done) return null;
    return { ending: computeEnding(state), log: state.log, finalChoice: state.finalChoice };
  }

  // 结局路线图（D1）：每条结局还差哪些条件
  function endingConditions(state) {
    var f = state.flags;
    return {
      beacon: [
        { label: '从未沉默', met: f.silenceCount === 0 },
        { label: '城市希望 ≥ 75', met: state.hope >= 75 },
        { label: '终局选择「希望」', met: state.finalChoice === 'hope' }
      ],
      dawn: [
        { label: '播放过摇篮曲', met: f.lullaby },
        { label: '城市希望 ≥ 50', met: state.hope >= 50 },
        { label: '终局选择「希望」', met: state.finalChoice === 'hope' }
      ],
      afterglow: [
        { label: '解码 FREQUENCY X', met: f.signalDecoded },
        { label: '播放过摇篮曲', met: f.lullaby },
        { label: '终局选择「真相」', met: state.finalChoice === 'truth' }
      ],
      signal: [
        { label: '解码 FREQUENCY X', met: f.signalDecoded },
        { label: '终局选择「真相」', met: state.finalChoice === 'truth' }
      ],
      fire: [
        { label: '接听老周或老兵', met: f.laozhouHonored || f.veteranHonored },
        { label: '终局选择「陪伴」', met: state.finalChoice === 'companion' }
      ],
      dust: [
        { label: '终局沉默 或 希望 < 20', met: state.finalChoice === 'silence' || state.hope < 20 }
      ],
      memorial: [
        { label: '隐藏结局：已收集全部基础结局', met: !!f.memorialUnlocked },
        { label: '终局未选择沉默', met: state.finalChoice !== 'silence' },
        { label: '城市希望 ≥ 40', met: state.hope >= 40 }
      ],
      nightingale: [
        { label: '播放过摇篮曲', met: f.lullaby },
        { label: '接听小雨', met: !!(f.answered && f.answered.xiaoyu) },
        { label: '接听双胞胎', met: !!(f.answered && f.answered.twins) },
        { label: '终局选择「陪伴」', met: state.finalChoice === 'companion' }
      ],
      lighthouse: [
        { label: '解码 FREQUENCY X', met: f.signalDecoded },
        { label: '未播放摇篮曲', met: !f.lullaby },
        { label: '终局选择「希望」', met: state.finalChoice === 'hope' }
      ]
    };
  }

  return {
    TURN_COUNT: TURN_COUNT,
    createGame: createGame, applyAction: applyAction,
    availableActions: availableActions, computeEnding: computeEnding,
    ending: ending, endingConditions: endingConditions, cityPhase: cityPhase
  };
});
