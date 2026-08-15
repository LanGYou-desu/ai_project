/* LASTBROADCAST · 31 首歌曲曲谱（程序化合成器演奏）
   每首：bpm 速度 · prog 四小节和弦进行 · melody 旋律（[音名, 拍数]，4/4 共 16 拍）
        style 音色（piano/bell/lead/pad） · drums 鼓点（none/soft） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LB = root.LB || {}; root.LB.scores = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NOTE_SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  var CHORD_QUAL = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], dim: [0, 3, 6], '6': [0, 4, 7, 9] };

  function midi(name) {
    var m = /^([A-G]#?)(-?\d)$/.exec(String(name));
    if (!m) return null;
    return (parseInt(m[2], 10) + 1) * 12 + NOTE_SEMI[m[1]];
  }
  function noteFreq(name) {
    var n = midi(name);
    return n == null ? null : 440 * Math.pow(2, (n - 69) / 12);
  }
  function chordNotes(name, octave) {
    var m = /^([A-G]#?)(.*)$/.exec(String(name));
    if (!m) return [];
    var root = (octave + 1) * 12 + NOTE_SEMI[m[1]];
    var qual = CHORD_QUAL[m[2]] || [0, 4, 7];
    return qual.map(function (i) { return 440 * Math.pow(2, (root + i - 69) / 12); });
  }
  // 旋律 -> 按 16 分音符展开的步骤表 {step: {freq, durSteps}}
  function melodyTrack(melody, bpm) {
    var map = {};
    var step = 0;
    melody.forEach(function (entry) {
      var note = entry[0], beats = entry[1];
      var steps = Math.round(beats * 4);
      if (note !== 'R') {
        var f = noteFreq(note);
        if (f != null) map[step] = { freq: f, durSteps: steps };
      }
      step += steps;
    });
    return { map: map, totalSteps: step };
  }
  function validScore(sc) {
    if (!sc) return false;
    if (typeof sc.bpm !== 'number' || sc.bpm < 40 || sc.bpm > 180) return false;
    if (!Array.isArray(sc.prog) || sc.prog.length !== 4) return false;
    for (var i = 0; i < sc.prog.length; i++) if (chordNotes(sc.prog[i], 3).length === 0) return false;
    var t = melodyTrack(sc.melody, sc.bpm);
    if (t.totalSteps !== 64) return false;
    return true;
  }

  var SCORES = {
    nightstar:     { bpm: 84,  prog: ['C', 'Am', 'F', 'G'],    style: 'piano', drums: 'none', melody: [['E5', 2], ['G5', 2], ['A5', 2], ['G5', 2], ['E5', 2], ['C5', 2], ['D5', 2], ['E5', 2]] },
    steelheart:    { bpm: 112, prog: ['Am', 'F', 'C', 'G'],    style: 'lead',  drums: 'soft', melody: [['A4', 1], ['A4', 1], ['C5', 2], ['E5', 1], ['E5', 1], ['A5', 2], ['G5', 1], ['G5', 1], ['E5', 2], ['C5', 4]] },
    rainy:         { bpm: 72,  prog: ['Am', 'Em', 'F', 'C'],   style: 'piano', drums: 'none', melody: [['A4', 2], ['C5', 2], ['E5', 3], ['D5', 1], ['C5', 2], ['B4', 2], ['A4', 4]] },
    starlet:       { bpm: 80,  prog: ['C', 'F', 'C', 'G'],     style: 'bell',  drums: 'none', melody: [['C5', 1], ['C5', 1], ['G5', 1], ['G5', 1], ['A5', 1], ['A5', 1], ['G5', 2], ['F5', 1], ['F5', 1], ['E5', 1], ['E5', 1], ['D5', 1], ['D5', 1], ['C5', 2]] },
    oldtape:       { bpm: 76,  prog: ['C', 'Am', 'F', 'G'],    style: 'piano', drums: 'none', melody: [['C5', 2], ['B4', 2], ['A4', 2], ['G4', 2], ['A4', 2], ['C5', 2], ['D5', 2], ['E5', 2]] },
    whitenoise:    { bpm: 70,  prog: ['C', 'G', 'Am', 'F'],    style: 'bell',  drums: 'none', melody: [['E5', 3], ['C5', 3], ['D5', 2], ['E5', 4], ['G5', 4]] },
    lastbus:       { bpm: 82,  prog: ['C', 'G', 'Am', 'Em'],   style: 'piano', drums: 'none', melody: [['G4', 1], ['A4', 1], ['B4', 2], ['C5', 2], ['D5', 2], ['E5', 2], ['D5', 2], ['C5', 2], ['B4', 2]] },
    sunrise:       { bpm: 96,  prog: ['C', 'G', 'Am', 'F'],    style: 'lead',  drums: 'soft', melody: [['C5', 1], ['D5', 1], ['E5', 1], ['G5', 1], ['A5', 2], ['G5', 2], ['E5', 2], ['D5', 2], ['C5', 4]] },
    loveletter:    { bpm: 80,  prog: ['C', 'E7', 'Am', 'G'],   style: 'piano', drums: 'none', melody: [['E5', 2], ['G5', 2], ['A5', 2], ['G5', 2], ['E5', 2], ['C5', 2], ['D5', 2], ['E5', 2]] },
    farewell:      { bpm: 66,  prog: ['Cm', 'Ab', 'Bb', 'G7'], style: 'bell',  drums: 'none', melody: [['C5', 3], ['Bb4', 2], ['Ab4', 2], ['G4', 2], ['F4', 2], ['G4', 2], ['C5', 3]] },
    moonboat:      { bpm: 78,  prog: ['C', 'F', 'G', 'C'],     style: 'bell',  drums: 'none', melody: [['C5', 2], ['E5', 2], ['G5', 2], ['E5', 2], ['A5', 2], ['G5', 2], ['E5', 2], ['C5', 2]] },
    prelude:       { bpm: 116, prog: ['Am', 'F', 'G', 'Am'],   style: 'lead',  drums: 'soft', melody: [['A4', 1], ['A4', 1], ['C5', 1], ['C5', 1], ['E5', 1], ['E5', 1], ['A5', 2], ['G5', 1], ['G5', 1], ['E5', 2], ['C5', 4]] },
    homelight:     { bpm: 76,  prog: ['F', 'C', 'Dm', 'Bb'],   style: 'piano', drums: 'none', melody: [['A4', 2], ['C5', 2], ['F5', 2], ['E5', 2], ['D5', 2], ['C5', 2], ['A4', 2], ['G4', 2]] },
    oldradio:      { bpm: 74,  prog: ['C', 'Am', 'F', 'G'],    style: 'piano', drums: 'none', melody: [['G4', 2], ['A4', 2], ['B4', 2], ['C5', 2], ['D5', 2], ['C5', 2], ['A4', 2], ['G4', 2]] },
    birds:         { bpm: 92,  prog: ['C', 'G', 'Am', 'F'],    style: 'lead',  drums: 'soft', melody: [['E5', 1], ['G5', 1], ['A5', 2], ['C6', 2], ['A5', 2], ['G5', 2], ['E5', 2], ['D5', 2], ['E5', 2]] },
    lastletter:    { bpm: 68,  prog: ['G', 'Em', 'C', 'D'],    style: 'bell',  drums: 'none', melody: [['B4', 3], ['A4', 2], ['G4', 2], ['D5', 2], ['E5', 2], ['D5', 2], ['C5', 3]] },
    emptyroom:     { bpm: 70,  prog: ['Am', 'Dm', 'Am', 'E7'], style: 'piano', drums: 'none', melody: [['A4', 2], ['E4', 2], ['A4', 2], ['C5', 2], ['B4', 2], ['A4', 2], ['E4', 2], ['A4', 2]] },
    keeper:        { bpm: 72,  prog: ['C', 'G', 'Am', 'Em'],   style: 'piano', drums: 'none', melody: [['C5', 2], ['G4', 2], ['A4', 2], ['E4', 2], ['F4', 2], ['G4', 2], ['A4', 2], ['C5', 2]] },
    forlily:       { bpm: 84,  prog: ['C', 'Am', 'F', 'G'],    style: 'piano', drums: 'none', melody: [['E5', 2], ['D5', 2], ['C5', 2], ['D5', 2], ['E5', 2], ['G5', 2], ['A5', 2], ['G5', 2]] },
    streetcat:     { bpm: 88,  prog: ['G', 'D', 'Em', 'C'],    style: 'piano', drums: 'soft', melody: [['D5', 1], ['D5', 1], ['E5', 2], ['B4', 2], ['D5', 2], ['G5', 2], ['F#5', 2], ['D5', 2], ['B4', 2]] },
    flagwind:      { bpm: 76,  prog: ['F', 'C', 'Dm', 'Bb'],   style: 'piano', drums: 'none', melody: [['F4', 2], ['A4', 2], ['C5', 2], ['A4', 2], ['Bb4', 2], ['F4', 2], ['G4', 2], ['A4', 2]] },
    lastferry:     { bpm: 72,  prog: ['Dm', 'Bb', 'F', 'C'],   style: 'piano', drums: 'none', melody: [['D5', 2], ['F5', 2], ['A5', 2], ['G5', 2], ['F5', 2], ['E5', 2], ['D5', 2], ['C5', 2]] },
    lighthouseletter: { bpm: 80, prog: ['C', 'F', 'G', 'C'],   style: 'bell',  drums: 'none', melody: [['E5', 2], ['G5', 2], ['C6', 2], ['A5', 2], ['G5', 2], ['E5', 2], ['D5', 2], ['C5', 2]] },
    dayend:        { bpm: 90,  prog: ['F', 'G', 'Em', 'Am'],   style: 'lead',  drums: 'soft', melody: [['C5', 1], ['D5', 1], ['E5', 1], ['F5', 1], ['G5', 2], ['A5', 2], ['G5', 2], ['F5', 2], ['E5', 4]] },
    midclock:      { bpm: 74,  prog: ['C', 'G', 'Am', 'Em'],   style: 'piano', drums: 'none', melody: [['E5', 2], ['D5', 2], ['C5', 2], ['D5', 2], ['E5', 2], ['G4', 2], ['A4', 2], ['C5', 2]] },
    dawnrain:      { bpm: 72,  prog: ['Am', 'F', 'C', 'G'],    style: 'piano', drums: 'none', melody: [['A4', 2], ['C5', 2], ['E5', 2], ['C5', 2], ['G4', 2], ['B4', 2], ['D5', 2], ['B4', 2]] },
    nightlullaby:  { bpm: 74,  prog: ['C', 'F', 'G', 'C'],     style: 'bell',  drums: 'none', melody: [['G4', 2], ['C5', 2], ['E5', 2], ['G5', 2], ['E5', 2], ['C5', 2], ['D5', 2], ['G4', 2]] },
    march:         { bpm: 120, prog: ['Am', 'F', 'G', 'Am'],   style: 'lead',  drums: 'soft', melody: [['A4', 1], ['A4', 1], ['C5', 1], ['C5', 1], ['E5', 1], ['E5', 1], ['A5', 2], ['A5', 1], ['G5', 1], ['E5', 1], ['E5', 1], ['C5', 4]] },
    powerrest:     { bpm: 70,  prog: ['C', 'G', 'Am', 'F'],    style: 'piano', drums: 'none', melody: [['C5', 3], ['A4', 2], ['G4', 2], ['A4', 3], ['C5', 3], ['E5', 3]] },
    finalwaltz:    { bpm: 72,  prog: ['C', 'Am', 'F', 'G'],    style: 'bell',  drums: 'none', melody: [['E5', 1], ['F5', 1], ['G5', 2], ['E5', 2], ['C5', 2], ['A4', 2], ['C5', 2], ['D5', 2], ['E5', 2]] },
    memorial:      { bpm: 80,  prog: ['F', 'C', 'Dm', 'Bb'],   style: 'piano', drums: 'none', melody: [['A4', 2], ['C5', 2], ['F5', 3], ['E5', 1], ['D5', 2], ['C5', 2], ['A4', 2], ['G4', 2]] }
  };

  return { SCORES: SCORES, noteFreq: noteFreq, midi: midi, chordNotes: chordNotes, melodyTrack: melodyTrack, validScore: validScore };
});
