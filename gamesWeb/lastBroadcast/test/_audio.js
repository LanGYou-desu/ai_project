/* 测试用假 Web Audio 环境（零依赖）：记录每个节点的创建/连接/断开，便于断言"节点是否被回收" */
'use strict';

function makeFakeAudio() {
  var log = { created: [], disconnected: [], started: [], stopped: [], buffers: [], resumed: 0, suspended: 0, ctx: null };
  var now = 0;

  function param(initial) {
    return {
      value: initial,
      setValueAtTime: function (v) { this.value = v; return this; },
      linearRampToValueAtTime: function (v) { this.value = v; return this; },
      exponentialRampToValueAtTime: function (v) {
        if (!(v > 0)) throw new Error('exponentialRampToValueAtTime 目标值必须 > 0，收到 ' + v);
        this.value = v; return this;
      },
      cancelScheduledValues: function () { return this; },
      setTargetAtTime: function (v) { this.value = v; return this; }
    };
  }

  function node(kind, extra) {
    var n = {
      kind: kind, connections: [], disconnected: false,
      connect: function (dst) { this.connections.push(dst); return dst; },
      disconnect: function () { this.disconnected = true; log.disconnected.push(this); }
    };
    Object.keys(extra || {}).forEach(function (k) { n[k] = extra[k]; });
    log.created.push(n);
    return n;
  }

  function FakeAudioContext() {
    var self = this;
    this.sampleRate = 48000;
    this.state = 'running';
    this.destination = node('destination');
    log.ctx = this;
    Object.defineProperty(this, 'currentTime', { get: function () { return now; } });
    this.createGain = function () { return node('gain', { gain: param(1) }); };
    this.createOscillator = function () {
      return node('oscillator', {
        type: 'sine', frequency: param(440),
        start: function () { log.started.push(this); },
        stop: function () { this._stopped = true; log.stopped.push(this); }
      });
    };
    this.createBiquadFilter = function () { return node('filter', { type: 'lowpass', frequency: param(350), Q: param(1) }); };
    this.createBufferSource = function () {
      return node('bufferSource', {
        buffer: null, loop: false,
        start: function () { log.started.push(this); },
        stop: function () { this._stopped = true; log.stopped.push(this); }
      });
    };
    this.createBuffer = function (ch, len, rate) {
      var data = new Float32Array(len);
      var b = { length: len, sampleRate: rate, numberOfChannels: ch, getChannelData: function () { return data; } };
      log.buffers.push(b);
      return b;
    };
    this.createAnalyser = function () {
      return node('analyser', { fftSize: 512, getByteTimeDomainData: function (arr) { arr.fill(128); } });
    };
    this.resume = function () { self.state = 'running'; log.resumed++; return Promise.resolve(); };
    this.suspend = function () { self.state = 'suspended'; log.suspended++; return Promise.resolve(); };
  }

  return {
    FakeAudioContext: FakeAudioContext,
    log: log,
    advance: function (dt) { now += dt; },
    get now() { return now; }
  };
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

module.exports = { makeFakeAudio: makeFakeAudio, sleep: sleep };
