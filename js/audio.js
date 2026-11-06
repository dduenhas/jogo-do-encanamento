/* ============================================================
   audio.js — todos os sons são sintetizados via WebAudio
   ------------------------------------------------------------
   Cada estilo tem sua própria "assinatura":
     vidro    -> água corrente, cliques de metal, respingos
     bambu    -> golpes de madeira, borbulhas, gotejamento
     futuro   -> zumbido elétrico, descargas, servo-motores
   Nada é carregado da rede: não há arquivos de áudio.
   ============================================================ */
(function (PM) {
  'use strict';

  var A = {
    ctx: null, master: null, sfxGain: null, ambGain: null,
    noiseBuf: null, enabled: true, ready: false,
    ambNodes: [], ambStyle: null
  };
  PM.Audio = A;

  /* ---------- inicialização (precisa de gesto do usuário) ---------- */
  A.init = function () {
    if (A.ctx || A.failed) return;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) { A.failed = true; return; }
    try {
      A.ctx = new Ctor();
      A.master = A.ctx.createGain();
      A.master.gain.value = A.enabled ? 0.9 : 0;
      A.master.connect(A.ctx.destination);

      A.sfxGain = A.ctx.createGain();
      A.sfxGain.gain.value = 0.85;
      A.sfxGain.connect(A.master);

      A.ambGain = A.ctx.createGain();
      A.ambGain.gain.value = 0.0;
      A.ambGain.connect(A.master);

      // buffer de ruído branco reaproveitado
      var len = Math.floor(A.ctx.sampleRate * 2);
      A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      var data = A.noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      A.ready = true;
    } catch (e) { A.failed = true; }
  };

  A.resume = function () {
    if (!A.ctx) A.init();
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };

  A.setEnabled = function (on) {
    A.enabled = on;
    if (A.master) A.master.gain.value = on ? 0.9 : 0;
  };

  function now() { return A.ctx.currentTime; }

  /* ---------- blocos de construção ---------- */
  function gainNode(peak, attack, decay, t0) {
    var g = A.ctx.createGain();
    t0 = t0 || now();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    return g;
  }

  function tone(freq, type, dur, peak, t0, opts) {
    opts = opts || {};
    var o = A.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t0 + dur);
    if (opts.detune) o.detune.value = opts.detune;
    var g = gainNode(peak, opts.attack || 0.004, dur, t0);
    o.connect(g);
    if (opts.filter) {
      var f = A.ctx.createBiquadFilter();
      f.type = opts.filter;
      f.frequency.value = opts.filterFreq || 1200;
      f.Q.value = opts.q || 1;
      g.connect(f);
      f.connect(opts.dest || A.sfxGain);
    } else {
      g.connect(opts.dest || A.sfxGain);
    }
    o.start(t0);
    o.stop(t0 + dur + (opts.attack || 0.004) + 0.05);
    return { osc: o, gain: g };
  }

  function noise(dur, peak, t0, opts) {
    opts = opts || {};
    var src = A.ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    src.loop = true;
    var f = A.ctx.createBiquadFilter();
    f.type = opts.type || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 1000, t0);
    if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, opts.freqTo), t0 + dur);
    f.Q.value = opts.q || 1.2;
    var g = gainNode(peak, opts.attack || 0.005, dur, t0);
    src.connect(f);
    f.connect(g);
    g.connect(opts.dest || A.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + (opts.attack || 0.005) + 0.05);
    return { src: src, filter: f, gain: g };
  }

  /* ============================================================
     EFEITOS POR ESTILO
     ============================================================ */

  // giro de peça
  A.rotate = function (styleId) {
    if (!A.ready || !A.enabled) return;
    var t = now();
    if (styleId === 'future') {
      tone(320, 'sawtooth', 0.10, 0.10, t, { slideTo: 760, filter: 'lowpass', filterFreq: 2400 });
      noise(0.06, 0.05, t, { freq: 3000, q: 2 });
    } else if (styleId === 'bamboo') {
      tone(210, 'triangle', 0.09, 0.16, t, { slideTo: 150 });
      noise(0.05, 0.07, t, { freq: 900, q: 1.4, type: 'lowpass' });
    } else {
      tone(1250, 'square', 0.05, 0.055, t, { slideTo: 900 });
      noise(0.05, 0.05, t, { freq: 5200, q: 3 });
    }
  };

  // peça encaixada
  A.place = function (styleId) {
    if (!A.ready || !A.enabled) return;
    var t = now();
    if (styleId === 'future') {
      tone(90, 'sine', 0.16, 0.28, t, { slideTo: 55 });
      noise(0.10, 0.10, t, { freq: 1800, freqTo: 400, q: 1.5, type: 'lowpass' });
      tone(440, 'sine', 0.10, 0.05, t + 0.02);
    } else if (styleId === 'bamboo') {
      tone(140, 'triangle', 0.18, 0.30, t, { slideTo: 92 });
      tone(320, 'sine', 0.10, 0.08, t, { attack: 0.002 });
      noise(0.08, 0.08, t, { freq: 700, q: 1, type: 'lowpass' });
    } else {
      tone(700, 'sine', 0.13, 0.16, t, { slideTo: 420 });
      noise(0.09, 0.09, t, { freq: 4200, q: 2.5 });
      tone(1500, 'sine', 0.07, 0.06, t + 0.01);
    }
  };

  // descarte de peça
  A.skip = function (styleId) {
    if (!A.ready || !A.enabled) return;
    var t = now();
    tone(styleId === 'future' ? 500 : 380, 'triangle', 0.18, 0.10, t, { slideTo: 120 });
    noise(0.14, 0.06, t, { freq: 1200, freqTo: 300, q: 1 });
  };

  // fluido avançou uma célula
  A.flowStep = function (styleId, idx) {
    if (!A.ready || !A.enabled) return;
    var t = now();
    if (styleId === 'future') {
      tone(880 + (idx % 6) * 90, 'sawtooth', 0.06, 0.045, t,
        { filter: 'bandpass', filterFreq: 1800, q: 6 });
      noise(0.05, 0.035, t, { freq: 6000, q: 4 });
    } else if (styleId === 'bamboo') {
      tone(180 + (idx % 5) * 26, 'sine', 0.14, 0.10, t, { slideTo: 300 + (idx % 5) * 40, attack: 0.02 });
      noise(0.10, 0.03, t, { freq: 500, q: 1.2, type: 'lowpass' });
    } else {
      noise(0.09, 0.05, t, { freq: 1600, freqTo: 500, q: 0.7, type: 'lowpass' });
      tone(180 + (idx % 5) * 24, 'sine', 0.07, 0.03, t, { slideTo: 120, attack: 0.012 });
    }
  };

  /* Jorro contínuo enquanto a água corre. No vidro é um ruído grave
     com gorgolejo; nos outros estilos o ambiente só ganha presença. */
  A.startFlow = function (styleId) {
    if (!A.ready || !A.enabled) return;
    if (styleId !== 'glass') {
      A.setFlowIntensity(0.45);
      return;
    }
    if (A.streamNodes && A.streamNodes.length) return;
    if (!A.ambOut) A.startAmbient(styleId);
    var t = now();
    var out = A.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.connect(A.ambOut || A.ambGain);

    var src = A.ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    src.loop = true;
    var lp = A.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 0.7;
    var body = A.ctx.createGain();
    body.gain.value = 0.62;
    src.connect(lp);
    lp.connect(body);
    body.connect(out);

    var gurgle = A.ctx.createOscillator();
    gurgle.frequency.value = 5;
    var gg = A.ctx.createGain();
    gg.gain.value = 0.2;
    gurgle.connect(gg);
    gg.connect(body.gain);

    src.start(t);
    gurgle.start(t);
    out.gain.linearRampToValueAtTime(1, t + 0.35);
    A.streamNodes = [src, gurgle, out];
    A.ambNodes = A.ambNodes.concat(A.streamNodes);
  };

  // vazamento
  A.leak = function (styleId) {
    if (!A.ready || !A.enabled) return;
    var t = now();
    if (styleId === 'future') {
      noise(0.5, 0.22, t, { freq: 7000, freqTo: 300, q: 1.2 });
      tone(1400, 'sawtooth', 0.4, 0.10, t, { slideTo: 90, filter: 'highpass', filterFreq: 300 });
      tone(70, 'square', 0.5, 0.14, t + 0.05, { slideTo: 40 });
    } else if (styleId === 'bamboo') {
      noise(0.7, 0.16, t, { freq: 900, freqTo: 250, q: 0.9, type: 'lowpass' });
      for (var i = 0; i < 5; i++) {
        tone(240 - i * 25, 'sine', 0.16, 0.12, t + i * 0.09, { slideTo: 120, attack: 0.01 });
      }
    } else {
      noise(0.8, 0.20, t, { freq: 3000, freqTo: 600, q: 0.8 });
      tone(900, 'sine', 0.35, 0.08, t, { slideTo: 200 });
      for (var j = 0; j < 4; j++) tone(1400 - j * 120, 'sine', 0.10, 0.06, t + j * 0.07);
    }
  };

  /* Alagamento da derrota: jorro que cresce e um intervalo descendente,
     desafinado de propósito, para deixar claro que a fase falhou. */
  A.floodNodes = [];
  A.floodOut = null;

  A.stopFlood = function () {
    if (!A.ctx) { A.floodNodes = []; A.floodOut = null; return; }
    var t = now();
    if (A.floodOut) {
      try {
        A.floodOut.gain.cancelScheduledValues(t);
        A.floodOut.gain.setValueAtTime(Math.max(0.0001, A.floodOut.gain.value || 0.0001), t);
        A.floodOut.gain.linearRampToValueAtTime(0.0001, t + 0.12);
      } catch (e) { /* ignore */ }
    }
    var nodes = A.floodNodes;
    A.floodNodes = [];
    A.floodOut = null;
    setTimeout(function () {
      for (var i = 0; i < nodes.length; i++) {
        try { if (nodes[i].stop) nodes[i].stop(); } catch (e) { /* já parado */ }
        try { nodes[i].disconnect(); } catch (e) { /* ignore */ }
      }
    }, 180);
  };

  A.floodFail = function (styleId, ms) {
    if (!A.ready || !A.enabled) return;
    A.stopFlood();
    var dur = Math.max(1.2, Math.min((ms || 2000) / 1000, 4.2));
    var t = now();
    var out = A.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(1, t + 0.08);
    out.gain.setValueAtTime(1, t + Math.max(0.35, dur - 0.35));
    out.gain.linearRampToValueAtTime(0.0001, t + dur);
    out.connect(A.sfxGain);
    A.floodOut = out;

    var src = A.ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    src.loop = true;
    var lp = A.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(styleId === 'future' ? 2600 : (styleId === 'bamboo' ? 780 : 1600), t);
    lp.frequency.linearRampToValueAtTime(styleId === 'future' ? 380 : 260, t + dur);
    var ng = A.ctx.createGain();
    ng.gain.setValueAtTime(0.04, t);
    ng.gain.linearRampToValueAtTime(styleId === 'glass' ? 0.36 : 0.24, t + dur * 0.65);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(out);
    src.start(t);
    src.stop(t + dur + 0.05);

    var base = styleId === 'future' ? 246 : (styleId === 'bamboo' ? 294 : 330);
    var o1 = A.ctx.createOscillator();
    o1.type = styleId === 'future' ? 'sawtooth' : 'triangle';
    o1.frequency.setValueAtTime(base, t);
    o1.frequency.exponentialRampToValueAtTime(52, t + dur);
    var g1 = A.ctx.createGain();
    g1.gain.value = styleId === 'future' ? 0.06 : 0.10;
    o1.connect(g1);
    g1.connect(out);
    o1.start(t);
    o1.stop(t + dur + 0.02);

    var o2 = A.ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(base * Math.SQRT2, t);
    o2.frequency.exponentialRampToValueAtTime(74, t + dur);
    var g2 = A.ctx.createGain();
    g2.gain.value = 0.07;
    o2.connect(g2);
    g2.connect(out);
    o2.start(t);
    o2.stop(t + dur + 0.02);

    A.floodNodes = [src, o1, o2, out];

    if (styleId === 'glass' || styleId === 'bamboo') {
      var bubbles = 6;
      for (var b = 0; b < bubbles; b++) {
        var bt = t + 0.12 + b * ((dur - 0.3) / bubbles);
        var bsrc = A.ctx.createBufferSource();
        bsrc.buffer = A.noiseBuf;
        var bp = A.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 420 + b * 160;
        bp.Q.value = 5;
        var bg = A.ctx.createGain();
        bg.gain.setValueAtTime(0.0001, bt);
        bg.gain.linearRampToValueAtTime(0.14, bt + 0.015);
        bg.gain.exponentialRampToValueAtTime(0.0001, bt + 0.11);
        bsrc.connect(bp);
        bp.connect(bg);
        bg.connect(out);
        bsrc.start(bt);
        bsrc.stop(bt + 0.13);
        A.floodNodes.push(bsrc);
      }
    }
  };

  // fase vencida
  A.win = function (styleId) {
    if (!A.ready || !A.enabled) return;
    var t = now();
    var scale = styleId === 'future' ? [220, 293, 440, 587, 880]
      : (styleId === 'bamboo' ? [262, 330, 392, 523, 659] : [392, 494, 587, 784, 988]);
    for (var i = 0; i < scale.length; i++) {
      var o = tone(scale[i], styleId === 'future' ? 'triangle' : 'sine', 0.42, 0.16, t + i * 0.09,
        { attack: 0.01 });
      if (styleId === 'glass') tone(scale[i] * 2, 'sine', 0.26, 0.05, t + i * 0.09 + 0.02);
    }
    if (styleId !== 'future') noise(0.5, 0.05, t, { freq: 5000, q: 1.5, attack: 0.05 });
    else tone(110, 'sawtooth', 0.6, 0.10, t + 0.3, { slideTo: 440, filter: 'lowpass', filterFreq: 2000 });
  };

  // fase perdida
  A.lose = function (styleId) {
    if (!A.ready || !A.enabled) return;
    var t = now();
    tone(300, styleId === 'future' ? 'sawtooth' : 'triangle', 0.9, 0.18, t,
      { slideTo: 60, attack: 0.02, filter: 'lowpass', filterFreq: 1400 });
    tone(302, 'sine', 0.9, 0.10, t + 0.04, { slideTo: 58 });
    noise(0.6, 0.08, t, { freq: 800, freqTo: 120, q: 0.7, type: 'lowpass' });
  };

  // clique de interface
  A.ui = function (up) {
    if (!A.ready || !A.enabled) return;
    var t = now();
    tone(up ? 760 : 520, 'sine', 0.06, 0.07, t, { attack: 0.002 });
  };

  // contagem regressiva / aviso
  A.alert = function () {
    if (!A.ready || !A.enabled) return;
    var t = now();
    tone(880, 'square', 0.09, 0.06, t);
    tone(880, 'square', 0.09, 0.06, t + 0.14);
  };

  /* ============================================================
     AMBIENTE CONTÍNUO (ligado enquanto a fase está rodando)
     ============================================================ */
  A.startAmbient = function (styleId) {
    if (!A.ready || !A.enabled) return;
    if (A.ambStyle === styleId && A.ambNodes.length) return;
    A.stopAmbient();
    A.ambStyle = styleId;

    var t = now();
    var out = A.ctx.createGain();
    out.gain.value = 0;
    out.connect(A.ambGain);
    A.ambGain.gain.value = 0.55;

    if (styleId === 'future') {
      // zumbido de rede elétrica: duas serras desafinadas + pulso
      var lp = A.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 3;
      lp.connect(out);
      [58, 61.5, 116].forEach(function (f, i) {
        var o = A.ctx.createOscillator();
        o.type = i === 2 ? 'triangle' : 'sawtooth';
        o.frequency.value = f;
        var g = A.ctx.createGain();
        g.gain.value = i === 2 ? 0.035 : 0.07;
        o.connect(g); g.connect(lp);
        o.start(t);
        A.ambNodes.push(o);
      });
      var lfo = A.ctx.createOscillator();
      lfo.frequency.value = 0.25;
      var lg = A.ctx.createGain();
      lg.gain.value = 120;
      lfo.connect(lg); lg.connect(lp.frequency);
      lfo.start(t);
      A.ambNodes.push(lfo);
    } else if (styleId === 'bamboo') {
      // riacho abafado + gotas esporádicas
      var src = A.ctx.createBufferSource();
      src.buffer = A.noiseBuf; src.loop = true;
      var bp = A.ctx.createBiquadFilter();
      bp.type = 'lowpass'; bp.frequency.value = 620; bp.Q.value = 0.7;
      var ng = A.ctx.createGain();
      ng.gain.value = 0.16;
      src.connect(bp); bp.connect(ng); ng.connect(out);
      src.start(t);
      A.ambNodes.push(src);
      var lfo2 = A.ctx.createOscillator();
      lfo2.frequency.value = 0.18;
      var lg2 = A.ctx.createGain();
      lg2.gain.value = 0.06;
      lfo2.connect(lg2); lg2.connect(ng.gain);
      lfo2.start(t);
      A.ambNodes.push(lfo2);
    } else {
      // água corrente: ruído passa-faixa com modulação lenta
      var src2 = A.ctx.createBufferSource();
      src2.buffer = A.noiseBuf; src2.loop = true;
      var bp2 = A.ctx.createBiquadFilter();
      bp2.type = 'bandpass'; bp2.frequency.value = 900; bp2.Q.value = 0.8;
      var hp = A.ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 300;
      var ng2 = A.ctx.createGain();
      ng2.gain.value = 0.045;
      src2.connect(bp2); bp2.connect(hp); hp.connect(ng2); ng2.connect(out);
      src2.start(t);
      A.ambNodes.push(src2);
      var lfo3 = A.ctx.createOscillator();
      lfo3.frequency.value = 0.13;
      var lg3 = A.ctx.createGain();
      lg3.gain.value = 380;
      lfo3.connect(lg3); lg3.connect(bp2.frequency);
      lfo3.start(t);
      A.ambNodes.push(lfo3);
    }

    A.ambNodes.push(out);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(1, t + 1.2);
    A.ambOut = out;
  };

  A.stopAmbient = function () {
    if (!A.ctx) { A.ambNodes = []; A.ambStyle = null; return; }
    var t = now();
    if (A.ambOut) {
      try {
        A.ambOut.gain.cancelScheduledValues(t);
        A.ambOut.gain.setValueAtTime(A.ambOut.gain.value, t);
        A.ambOut.gain.linearRampToValueAtTime(0.0001, t + 0.35);
      } catch (e) { /* ignore */ }
    }
    var nodes = A.ambNodes;
    A.ambNodes = [];
    A.ambStyle = null;
    A.ambOut = null;
    A.streamNodes = [];
    setTimeout(function () {
      for (var i = 0; i < nodes.length; i++) {
        try { if (nodes[i].stop) nodes[i].stop(); } catch (e) { /* já parado */ }
        try { nodes[i].disconnect(); } catch (e) { /* ignore */ }
      }
    }, 500);
  };

  /* volume do fluido sobe conforme a quantidade de canos cheios */
  A.setFlowIntensity = function (v) {
    if (!A.ctx || !A.ambOut) return;
    var t = now();
    try {
      A.ambOut.gain.cancelScheduledValues(t);
      A.ambOut.gain.linearRampToValueAtTime(PM.clamp(0.35 + v * 1.5, 0, 1.6), t + 0.3);
    } catch (e) { /* ignore */ }
  };
})(window.PM);
