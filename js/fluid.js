/* ============================================================
   fluid.js — animação do conteúdo dos canos
   ------------------------------------------------------------
   Sem estado por célula: cada partícula é derivada de um hash
   (célula + índice) e do tempo, então o custo é baixo e nunca
   vaza memória. O chamador fornece a REGIÃO já preenchida pelo
   fluido (retângulos dos braços do cano) e o recorte é aplicado
   antes de pintar.

   Estilos:
     water  -> água azul/verde com bolhas subindo e correntes
     bubble -> líquido espesso borbulhante e colorido (bambu)
     plasma -> descargas elétricas neon (futurista)
   ============================================================ */
(function (PM) {
  'use strict';

  /* hash determinístico [0,1) */
  function h(a, b, c) {
    var x = (a * 374761393 + b * 668265263 + (c || 0) * 2147483647) >>> 0;
    x = (x ^ (x >>> 13)) >>> 0;
    x = Math.imul(x, 1274126177) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    return x / 4294967296;
  }

  /* eixo do fluxo de um retângulo: retorna {axis, from, to, span, thick} */
  function axisOf(rect) {
    var horiz = rect.w >= rect.h;
    return {
      horiz: horiz,
      from: horiz ? rect.x : rect.y,
      span: horiz ? rect.w : rect.h,
      cross: horiz ? rect.y : rect.x,
      crossSize: horiz ? rect.h : rect.w
    };
  }

  /* ---------- ÁGUA (vidro) ---------- */
  function paintWater(ctx, rects, seed, time, colors, cfg) {
    var t = time / 1000;

    for (var i = 0; i < rects.length; i++) {
      var R = rects[i], ax = axisOf(R);
      if (ax.span < 2 || ax.crossSize < 2) continue;

      // 1) faixas de corrente que deslizam ao longo do cano
      var bands = 3;
      for (var b = 0; b < bands; b++) {
        var ph = ((t * 0.42 * cfg.speed + h(seed, b, 7)) % 1);
        var pos = ax.from + ph * ax.span;
        var wdt = Math.max(3, ax.span * 0.16);
        var grd;
        if (ax.horiz) {
          grd = ctx.createLinearGradient(pos - wdt, 0, pos + wdt, 0);
        } else {
          grd = ctx.createLinearGradient(0, pos - wdt, 0, pos + wdt);
        }
        grd.addColorStop(0, 'rgba(255,255,255,0)');
        grd.addColorStop(0.5, 'rgba(255,255,255,0.22)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        if (ax.horiz) ctx.fillRect(pos - wdt, R.y, wdt * 2, R.h);
        else ctx.fillRect(R.x, pos - wdt, R.w, wdt * 2);
      }

      // 2) ondulação da superfície (seno deslocado)
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = PM.withAlpha(colors.spark, 0.85);
      ctx.lineWidth = Math.max(1, ax.crossSize * 0.10);
      ctx.beginPath();
      var steps = 14;
      for (var s = 0; s <= steps; s++) {
        var f = s / steps;
        var along = ax.from + f * ax.span;
        var wob = Math.sin((f * 6.2 + t * 3.1 * cfg.wobble + seed) ) * ax.crossSize * 0.22;
        var cx2 = ax.horiz ? along : ax.cross + ax.crossSize / 2 + wob;
        var cy2 = ax.horiz ? ax.cross + ax.crossSize / 2 + wob : along;
        if (s === 0) ctx.moveTo(cx2, cy2); else ctx.lineTo(cx2, cy2);
      }
      ctx.stroke();
      ctx.restore();

      // 3) bolhas
      var nb = Math.max(2, Math.round(cfg.bubbles * (ax.span / 120)));
      for (var k = 0; k < nb; k++) {
        var hs1 = h(seed, k, 11), hs2 = h(seed, k, 23), hs3 = h(seed, k, 31);
        var sp = (0.10 + hs3 * 0.16) * cfg.speed;
        var along2 = ax.from + ((hs1 + t * sp) % 1) * ax.span;
        var off = (hs2 - 0.5) * ax.crossSize * 0.62;
        var rad = Math.max(0.9, ax.crossSize * (0.055 + hs3 * 0.11));
        var bx = ax.horiz ? along2 : ax.cross + ax.crossSize / 2 + off;
        var by = ax.horiz ? ax.cross + ax.crossSize / 2 + off : along2;
        ctx.beginPath();
        ctx.arc(bx, by, rad, 0, 6.2832);
        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx - rad * 0.3, by - rad * 0.3, rad * 0.42, 0, 6.2832);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fill();
      }
    }
  }

  /* ---------- LÍQUIDO BORBULHANTE (bambu) ---------- */
  function paintBubble(ctx, rects, seed, time, colors, cfg) {
    var t = time / 1000;

    for (var i = 0; i < rects.length; i++) {
      var R = rects[i], ax = axisOf(R);
      if (ax.span < 2 || ax.crossSize < 2) continue;

      // fluxo lento em faixas grossas (sensação de líquido denso)
      for (var b = 0; b < 2; b++) {
        var ph = ((t * 0.18 * cfg.speed + h(seed, b, 3)) % 1);
        var pos = ax.from + ph * ax.span;
        var wdt = Math.max(5, ax.span * 0.28);
        var grd = ax.horiz
          ? ctx.createLinearGradient(pos - wdt, 0, pos + wdt, 0)
          : ctx.createLinearGradient(0, pos - wdt, 0, pos + wdt);
        grd.addColorStop(0, 'rgba(255,255,255,0)');
        grd.addColorStop(0.5, 'rgba(255,240,170,0.20)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        if (ax.horiz) ctx.fillRect(pos - wdt, R.y, wdt * 2, R.h);
        else ctx.fillRect(R.x, pos - wdt, R.w, wdt * 2);
      }

      // bolhas grandes que crescem, estouram e reaparecem
      var nb = Math.max(2, Math.round(cfg.bubbles * 0.7 * (ax.span / 120)));
      for (var k = 0; k < nb; k++) {
        var hs1 = h(seed, k, 41), hs2 = h(seed, k, 53), cyc = h(seed, k, 61);
        var life = ((t * (0.35 + cyc * 0.4) * cfg.speed + hs1) % 1);
        var along = ax.from + (0.12 + hs2 * 0.76) * ax.span;
        var off = (hs1 - 0.5) * ax.crossSize * 0.45;
        var grow = Math.sin(life * Math.PI);
        var rad = Math.max(1.2, ax.crossSize * (0.10 + cyc * 0.20) * grow);
        var bx = ax.horiz ? along : ax.cross + ax.crossSize / 2 + off;
        var by = ax.horiz ? ax.cross + ax.crossSize / 2 + off : along;

        ctx.beginPath();
        ctx.arc(bx, by, rad, 0, 6.2832);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.16 + 0.30 * grow).toFixed(3) + ')';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx, by, rad, 0, 6.2832);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (rad > 3) {
          ctx.beginPath();
          ctx.arc(bx - rad * 0.32, by - rad * 0.34, rad * 0.3, 0, 6.2832);
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fill();
        }
      }

      // superfície ondulada e colorida
      ctx.save();
      ctx.globalAlpha = 0.30;
      ctx.strokeStyle = PM.withAlpha(colors.fluidB, 0.9);
      ctx.lineWidth = Math.max(1.2, ax.crossSize * 0.13);
      ctx.beginPath();
      var steps = 12;
      for (var s = 0; s <= steps; s++) {
        var f = s / steps;
        var along2 = ax.from + f * ax.span;
        var wob = Math.sin(f * 5.0 + t * 2.0 * cfg.wobble + seed * 0.7) * ax.crossSize * 0.26;
        var px = ax.horiz ? along2 : ax.cross + ax.crossSize / 2 + wob;
        var py = ax.horiz ? ax.cross + ax.crossSize / 2 + wob : along2;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- PLASMA (futurista) ---------- */
  function paintPlasma(ctx, rects, seed, time, colors, cfg) {
    var tq = Math.floor(time / 70);          // arco regenerado a cada 70ms

    for (var i = 0; i < rects.length; i++) {
      var R = rects[i], ax = axisOf(R);
      if (ax.span < 3 || ax.crossSize < 2) continue;

      var arcs = 2;
      for (var a = 0; a < arcs; a++) {
        var sd = h(seed, a, i) * 99999;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (var pass = 0; pass < 2; pass++) {
          // 1ª passagem: halo largo e colorido; 2ª: núcleo branco fino
          ctx.strokeStyle = pass === 0
            ? PM.withAlpha(a % 2 === 0 ? colors.fluidA : colors.fluidB, 0.55)
            : 'rgba(255,255,255,0.92)';
          ctx.lineWidth = pass === 0
            ? Math.max(2.5, ax.crossSize * 0.34)
            : Math.max(1, ax.crossSize * 0.11);
          ctx.beginPath();
          var segs = 10;
          for (var s = 0; s <= segs; s++) {
            var f = s / segs;
            var jitter = (h(Math.floor(sd + s * 13 + tq * 7 + a * 101), s, 3) - 0.5);
            var amp = (s === 0 || s === segs) ? 0 : ax.crossSize * 0.40;
            var along = ax.from + f * ax.span;
            var cross = ax.cross + ax.crossSize / 2 + jitter * amp;
            var px = ax.horiz ? along : cross;
            var py = ax.horiz ? cross : along;
            if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // faíscas pontuais
      var sparks = 3;
      for (var k = 0; k < sparks; k++) {
        var hs1 = h(seed, k, 71);
        var life = ((time / 240 + hs1) % 1);
        if (life > 0.45) continue;
        var along2 = ax.from + h(seed, k, 83) * ax.span;
        var off = (h(seed, k, 97) - 0.5) * ax.crossSize * 0.5;
        var px2 = ax.horiz ? along2 : ax.cross + ax.crossSize / 2 + off;
        var py2 = ax.horiz ? ax.cross + ax.crossSize / 2 + off : along2;
        var rr = Math.max(1, ax.crossSize * 0.16 * (1 - life / 0.45));
        var gg = ctx.createRadialGradient(px2, py2, 0, px2, py2, rr * 3);
        gg.addColorStop(0, 'rgba(255,255,255,0.95)');
        gg.addColorStop(0.4, PM.withAlpha(colors.glow, 0.5));
        gg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(px2, py2, rr * 3, 0, 6.2832);
        ctx.fill();
      }
    }
  }

  /* ----------------------------------------------------------
     API: pinta o conteúdo do fluido dentro da região informada.
     O recorte (clip) já deve estar aplicado pelo chamador.
     ---------------------------------------------------------- */
  PM.Fluid = {
    paint: function (ctx, style, rects, seed, time) {
      if (!rects || !rects.length) return;
      var cfg = PM.FLOW_ANIM[style.fluid] || PM.FLOW_ANIM.water;
      var c = style.colors;
      if (style.fluid === 'bubble') paintBubble(ctx, rects, seed, time, c, cfg);
      else if (style.fluid === 'plasma') paintPlasma(ctx, rects, seed, time, c, cfg);
      else paintWater(ctx, rects, seed, time, c, cfg);
    },

    /* gradiente base do fluido (usado sob as partículas) */
    bodyGradient: function (ctx, style, x0, y0, x1, y1) {
      var g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, PM.withAlpha(style.colors.fluidA, 0.95));
      g.addColorStop(0.5, PM.withAlpha(style.colors.fluidB, 0.95));
      g.addColorStop(1, PM.withAlpha(style.colors.fluidA, 0.95));
      return g;
    },

    /* jato de fluido vazando (usado no vazamento) */
    spray: function (ctx, style, x, y, dir, time, amount) {
      var c = style.colors;
      var t = time / 1000;
      ctx.save();
      if (style.fluid === 'plasma') {
        for (var i = 0; i < 7; i++) {
          var a = (h(i, Math.floor(t * 20), 5) - 0.5) * 1.5;
          var len = 8 + h(i, Math.floor(t * 20), 9) * 26 * amount;
          ctx.strokeStyle = i % 2 ? PM.withAlpha(c.fluidA, 0.85) : 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
          ctx.stroke();
        }
      } else {
        for (var j = 0; j < 14; j++) {
          var ph = (t * 1.6 + h(j, 1, 2)) % 1;
          var spread = (h(j, 3, 4) - 0.5) * 0.9;
          var dist = ph * 34 * amount;
          var px = x + Math.cos(spread) * dist;
          var py = y + Math.sin(spread) * dist + ph * ph * 20;   // gravidade
          var rad = Math.max(0.8, (1 - ph) * 3.4);
          ctx.fillStyle = PM.withAlpha(j % 3 ? c.fluidA : c.fluidB, (1 - ph) * 0.9);
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, 6.2832);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  };
})(window.PM);
