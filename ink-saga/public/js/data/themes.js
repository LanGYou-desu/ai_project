// 墨战 · 天书纪 — 章节主题（背景 / 天气 / 旋律音阶）
(function (g) {
  'use strict';

  // bg: paper 宣纸 | rain 墨雨 | bamboo 竹林 | water 泽水 | iron 铁城 | bones 甲骨 | dragon 龙巢
  // weather: null | rain 雨 | mist 雾 | petals 落花 | wind 疾风 | embers 余烬 | smoke 烟
  const SCALE_BRIGHT = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]; // C 大调五声
  const SCALE_DARK   = [220.0, 246.94, 261.63, 311.13, 349.23, 392.0, 440.0, 466.16]; // A 羽调（暗）

  const THEMES = {
    default: { name: '宣纸', bg: 'paper', weather: null, scale: SCALE_BRIGHT, dark: false },
    prologue: { name: '墨夜', bg: 'rain', weather: 'rain', scale: SCALE_DARK, dark: true },
    ch1:      { name: '失字镇', bg: 'rain', weather: 'rain', scale: SCALE_DARK, dark: true },
    ch2:      { name: '砚山书院', bg: 'bamboo', weather: 'petals', scale: SCALE_BRIGHT, dark: false },
    ch2a:     { name: '同行之路', bg: 'bamboo', weather: 'petals', scale: SCALE_BRIGHT, dark: false },
    ch2b:     { name: '独行之路', bg: 'paper', weather: 'wind', scale: SCALE_DARK, dark: true },
    ch3:      { name: '成语之泽', bg: 'water', weather: 'mist', scale: SCALE_DARK, dark: true },
    ch4:      { name: '部首林', bg: 'bamboo', weather: null, scale: SCALE_BRIGHT, dark: false },
    ch5:      { name: '废都铁城', bg: 'iron', weather: 'embers', scale: SCALE_DARK, dark: true },
    ch5a:     { name: '还笔于墨', bg: 'iron', weather: 'embers', scale: SCALE_DARK, dark: true },
    ch5b:     { name: '以铁御墨', bg: 'iron', weather: 'smoke', scale: SCALE_DARK, dark: true },
    ch6:      { name: '甲骨秘境', bg: 'bones', weather: null, scale: SCALE_DARK, dark: true },
    ch6a:     { name: '镇墨之誓', bg: 'bones', weather: 'mist', scale: SCALE_DARK, dark: true },
    ch6b:     { name: '问天', bg: 'bones', weather: 'embers', scale: SCALE_DARK, dark: true },
    ch6c:     { name: '归隐', bg: 'bones', weather: 'petals', scale: SCALE_BRIGHT, dark: false },
    finale:   { name: '墨龙巢', bg: 'dragon', weather: 'embers', scale: SCALE_DARK, dark: true },
    endless:  { name: '墨海深渊', bg: 'rain', weather: 'rain', scale: SCALE_DARK, dark: true }
  };

  function themeOf(chapterId, mode) {
    if (mode === 'endless') return THEMES.endless;
    return THEMES[chapterId] || THEMES.default;
  }

  g.INK_THEMES = { THEMES, themeOf, SCALE_BRIGHT, SCALE_DARK };
})(typeof globalThis !== 'undefined' ? globalThis : this);
