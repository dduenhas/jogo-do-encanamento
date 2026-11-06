/* ============================================================
   utils.js — utilitários genéricos e estado global compartilhado
   ============================================================ */
window.PM = window.PM || {};

(function (PM) {
  'use strict';

  /* ---------- matemática ---------- */
  PM.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  PM.lerp = function (a, b, t) { return a + (b - a) * t; };
  PM.easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  PM.easeInOut = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  /* ---------- RNG determinística (mulberry32) ----------
     Cada fase usa uma semente fixa, para que o mapa seja idêntico
     em qualquer dispositivo e possa ser reproduzido. */
  PM.rng = function (seed) {
    var s = (seed >>> 0) || 1;
    var next = function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = function (n) { return Math.floor(next() * n); };
    next.pick = function (arr) { return arr[Math.floor(next() * arr.length)]; };
    next.chance = function (p) { return next() < p; };
    next.shuffle = function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(next() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    };
    next.weighted = function (pairs) {
      // pairs: [[valor, peso], ...]
      var total = 0, i;
      for (i = 0; i < pairs.length; i++) total += pairs[i][1];
      var r = next() * total;
      for (i = 0; i < pairs.length; i++) {
        r -= pairs[i][1];
        if (r <= 0) return pairs[i][0];
      }
      return pairs[pairs.length - 1][0];
    };
    return next;
  };

  PM.hashSeed = function (str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };

  /* ---------- canvas ---------- */
  PM.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // contorno de um retângulo arredondado sem fechar novo path
  PM.rr = PM.roundRect;

  /* Bitmap do canvas na resolução da tela, sem alterar o tamanho CSS.
     Mudar o CSS a partir da própria medida faz o elemento crescer todo quadro
     e acaba travando a aba. */
  PM.bitmapCanvas = function (canvas, cssW, cssH, maxDpr) {
    var dpr = Math.min(window.devicePixelRatio || 1, maxDpr || 2);
    cssW = Math.max(1, Math.round(cssW));
    cssH = Math.max(1, Math.round(cssH));
    var maxEdge = 2048;
    if (cssW > maxEdge || cssH > maxEdge) {
      var scale = maxEdge / Math.max(cssW, cssH);
      cssW = Math.max(1, Math.round(cssW * scale));
      cssH = Math.max(1, Math.round(cssH * scale));
    }
    var w = Math.max(1, Math.round(cssW * dpr));
    var h = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: cssW, h: cssH, dpr: dpr };
  };

  PM.fitCanvas = function (canvas, cssW, cssH, maxDpr) {
    var box = PM.bitmapCanvas(canvas, cssW, cssH, maxDpr);
    var sw = box.w + 'px';
    var sh = box.h + 'px';
    if (canvas.style.width !== sw) canvas.style.width = sw;
    if (canvas.style.height !== sh) canvas.style.height = sh;
    return box;
  };

  /* ---------- cor ---------- */
  PM.withAlpha = function (hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  PM.mixHex = function (a, b, t) {
    var pa = parseInt(a.replace('#', ''), 16), pb = parseInt(b.replace('#', ''), 16);
    var r = Math.round(PM.lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
    var g = Math.round(PM.lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    var c = Math.round(PM.lerp(pa & 255, pb & 255, t));
    return 'rgb(' + r + ',' + g + ',' + c + ')';
  };

  /* ---------- persistência ---------- */
  var STORE_KEY = 'pipemania.save.v1';

  PM.defaultSave = function () {
    return {
      best: 0,
      sound: true,
      skill: 0,               // 0..3 ver config.SKILLS (save novo começa em Iniciante)
      seenCoach: false,       // tutorial da primeira partida já visto
      speedScale: 1,          // multiplicador da água (ver config.WATER_SPEEDS)
      flowMode: 'auto',       // auto: a água sai no fim do preparo; manual: só no registro
      // progresso: nível máximo desbloqueado por estilo + estrelas/pontos
      styles: {
        glass: { unlocked: 0, stars: {}, score: {} },
        bamboo: { unlocked: 0, stars: {}, score: {} },
        future: { unlocked: 0, stars: {}, score: {} }
      }
    };
  };

  PM.loadSave = function () {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return PM.defaultSave();
      var obj = JSON.parse(raw);
      var base = PM.defaultSave();
      for (var k in base) if (!(k in obj)) obj[k] = base[k];
      for (var s in base.styles) {
        if (!obj.styles[s]) obj.styles[s] = base.styles[s];
      }
      return obj;
    } catch (e) { return PM.defaultSave(); }
  };

  PM.saveSave = function (data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* modo privado */ }
  };

  PM.$ = function (id) { return document.getElementById(id); };

  PM.pad2 = function (n) { return n < 10 ? '0' + n : '' + n; };

  PM.fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
})(window.PM);
