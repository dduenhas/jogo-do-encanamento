/* ============================================================
   renderer.js — desenho do tabuleiro e dos canos nos 3 estilos
   ------------------------------------------------------------
   Cada cano é desenhado em passadas (sombra -> parede -> canal
   -> fluido -> anéis -> brilho), o que permite sombreamento
   cilíndrico por braço e recorte exato do fluido.
   ============================================================ */
(function (PM) {
  'use strict';

  function hash(a, b, c) {
    var x = (a * 2654435761 + b * 40503 + (c || 0) * 97) >>> 0;
    x = (x ^ (x >>> 15)) >>> 0;
    x = Math.imul(x, 2246822519) >>> 0;
    x = (x ^ (x >>> 13)) >>> 0;
    return x / 4294967296;
  }

  /* ---------- geometria ---------- */
  // braço na direção d, de t0 (centro) a t1 (borda), com largura w
  function armRect(cx, cy, cs, d, w, t0, t1) {
    var half = cs / 2;
    var a = half * t0, b = half * t1;
    switch (d) {
      case 0: return { x: cx - w / 2, y: cy - b, w: w, h: b - a };              // N
      case 1: return { x: cx + a, y: cy - w / 2, w: b - a, h: w };              // E
      case 2: return { x: cx - w / 2, y: cy + a, w: w, h: b - a };              // S
      default: return { x: cx - b, y: cy - w / 2, w: b - a, h: w };             // W
    }
  }
  function centerRect(cx, cy, w) {
    return { x: cx - w / 2, y: cy - w / 2, w: w, h: w };
  }
  function rectsFor(mask, cx, cy, cs, w, t1) {
    var out = [centerRect(cx, cy, w)];
    for (var d = 0; d < 4; d++) {
      if (mask & (1 << d)) out.push(armRect(cx, cy, cs, d, w, 0, t1 === undefined ? 1 : t1));
    }
    return out;
  }
  function pathRects(ctx, rects) {
    ctx.beginPath();
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (r.w > 0.2 && r.h > 0.2) ctx.rect(r.x, r.y, r.w, r.h);
    }
  }

  /* Braços com ponta em semicírculo, para o cano não terminar em corte reto.
     Ângulo 0 do canvas é leste; o sentido positivo desce na tela. */
  var CAP_A0 = [Math.PI, -Math.PI / 2, 0, Math.PI / 2];
  function pathPipe(ctx, cx, cy, cs, mask, w) {
    ctx.beginPath();
    var hub = centerRect(cx, cy, w);
    if (hub.w > 0.2) ctx.rect(hub.x, hub.y, hub.w, hub.h);
    var r = w / 2;
    var half = cs / 2;
    var reach = Math.max(0, half - r);
    var t1 = half > 0 ? reach / half : 0;
    for (var d = 0; d < 4; d++) {
      if (!(mask & (1 << d))) continue;
      var arm = armRect(cx, cy, cs, d, w, 0, t1);
      if (arm.w > 0.2 && arm.h > 0.2) ctx.rect(arm.x, arm.y, arm.w, arm.h);
      var ex = cx + PM.DX[d] * reach;
      var ey = cy + PM.DY[d] * reach;
      var a0 = CAP_A0[d];
      ctx.moveTo(ex + Math.cos(a0) * r, ey + Math.sin(a0) * r);
      ctx.arc(ex, ey, Math.max(0.6, r), a0, a0 + Math.PI);
    }
  }

  /* fluido: retângulos já "crescidos" conforme o progresso */
  function fluidRects(cx, cy, cs, mask, entry, p, w) {
    if (p <= 0) return [];
    if (entry === PM.SOURCE_ENTRY) {          // fonte: o fluido nasce no centro
      if (p >= 0.999) return rectsFor(mask, cx, cy, cs, w, 1);
      var src = [centerRect(cx, cy, w)];
      for (var s = 0; s < 4; s++) {
        if (mask & (1 << s)) src.push(armRect(cx, cy, cs, s, w, 0, PM.clamp(p * 1.25, 0, 1)));
      }
      return src;
    }
    if (p >= 0.999 || entry < 0) return rectsFor(mask, cx, cy, cs, w, 1);
    var out = [];
    if (entry >= 0 && (mask & (1 << entry))) {
      out.push(armRect(cx, cy, cs, entry, w, Math.max(0, 1 - 2 * p), 1));
    } else {
      out.push(centerRect(cx, cy, w));
    }
    if (p > 0.5) {
      var q = Math.min(1, (p - 0.5) * 2);
      out.push(centerRect(cx, cy, w));
      for (var d = 0; d < 4; d++) {
        if (!(mask & (1 << d)) || d === entry) continue;
        out.push(armRect(cx, cy, cs, d, w, 0, q));
      }
    }
    return out;
  }

  /* ---------- fundo do tabuleiro ---------- */
  function drawBackground(ctx, geom, game, time) {
    var st = game.style, c = st.colors;
    var cs = geom.cell;

    ctx.fillStyle = c.page;
    ctx.fillRect(0, 0, geom.W, geom.H);

    for (var r = 0; r < game.rows; r++) {
      for (var col = 0; col < game.cols; col++) {
        var x = geom.ox + col * cs, y = geom.oy + r * cs;
        var hv = hash(col, r, 1);

        if (st.id === 'bamboo') {
          // pedras irregulares musgosas
          var pal = hv < 0.34 ? c.tileA : (hv < 0.68 ? c.tileB : c.tileHi);
          ctx.fillStyle = PM.withAlpha('#000000', 0.35);
          PM.roundRect(ctx, x + 1.5, y + 1.5, cs - 3, cs - 3, cs * 0.22); ctx.fill();
          ctx.fillStyle = pal;
          PM.roundRect(ctx, x + 2, y + 2, cs - 4, cs - 4, cs * 0.22); ctx.fill();
          ctx.save();
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = hv > 0.5 ? '#2f4a1c' : '#5c4a2c';
          PM.roundRect(ctx, x + 4, y + 4, cs - 8, cs - 8, cs * 0.18); ctx.fill();
          ctx.restore();
          // musgo
          if (hv > 0.86) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#4d7a2a';
            for (var m = 0; m < 4; m++) {
              var hx = x + cs * (0.15 + hash(col, r, 20 + m) * 0.7);
              var hy = y + cs * (0.15 + hash(col, r, 40 + m) * 0.7);
              ctx.beginPath();
              ctx.arc(hx, hy, cs * 0.045, 0, 6.2832);
              ctx.fill();
            }
            ctx.restore();
          }
        } else if (st.id === 'future') {
          // placas metálicas chanfradas
          ctx.fillStyle = hv < 0.5 ? c.tileA : c.tileB;
          PM.roundRect(ctx, x + 1, y + 1, cs - 2, cs - 2, cs * 0.14); ctx.fill();
          ctx.strokeStyle = PM.withAlpha(c.tileHi, 0.55);
          ctx.lineWidth = 1;
          PM.roundRect(ctx, x + 1.5, y + 1.5, cs - 3, cs - 3, cs * 0.14); ctx.stroke();
          ctx.fillStyle = PM.withAlpha('#000000', 0.45);
          ctx.fillRect(x + cs * 0.18, y + cs * 0.82, cs * 0.64, cs * 0.06);
          // filete de neon alternado
          var neon = hash(col, r, 7);
          if (neon > 0.72) {
            var pulse = 0.45 + 0.35 * Math.sin(time / 620 + col * 1.3 + r);
            ctx.fillStyle = PM.withAlpha(neon > 0.9 ? '#ff4d6a' : c.frame, pulse * 0.8);
            ctx.fillRect(x + cs * 0.3, y + cs - 3.5, cs * 0.4, 2);
          }
          // parafusos
          ctx.fillStyle = PM.withAlpha('#ffffff', 0.10);
          ctx.beginPath(); ctx.arc(x + cs * 0.13, y + cs * 0.13, cs * 0.035, 0, 6.2832); ctx.fill();
          ctx.beginPath(); ctx.arc(x + cs * 0.87, y + cs * 0.87, cs * 0.035, 0, 6.2832); ctx.fill();
        } else {
          // azulejos técnicos azulados (vidro)
          ctx.fillStyle = hv < 0.5 ? c.tileA : c.tileB;
          ctx.fillRect(x, y, cs, cs);
          var g = ctx.createLinearGradient(x, y, x, y + cs);
          g.addColorStop(0, PM.withAlpha(c.tileHi, 0.35));
          g.addColorStop(0.5, 'rgba(0,0,0,0)');
          g.addColorStop(1, PM.withAlpha('#000000', 0.28));
          ctx.fillStyle = g;
          ctx.fillRect(x, y, cs, cs);
          ctx.strokeStyle = PM.withAlpha(c.tileEdge, 0.85);
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
          if (hash(col, r, 9) > 0.82) {
            ctx.strokeStyle = PM.withAlpha(c.tileHi, 0.30);
            ctx.beginPath();
            ctx.moveTo(x + cs * 0.2, y + cs * 0.5);
            ctx.lineTo(x + cs * 0.8, y + cs * 0.5);
            ctx.stroke();
          }
        }
      }
    }

    // moldura interna do tabuleiro
    ctx.strokeStyle = PM.withAlpha('#000000', 0.5);
    ctx.lineWidth = 2;
    ctx.strokeRect(geom.ox - 1, geom.oy - 1, game.cols * cs + 2, game.rows * cs + 2);
  }

  /* ---------- terreno bloqueado ---------- */
  function drawTerrain(ctx, geom, game) {
    var st = game.style, c = st.colors, cs = geom.cell;
    for (var r = 0; r < game.rows; r++) {
      for (var col = 0; col < game.cols; col++) {
        if (!game.level.blocked[r * game.cols + col]) continue;
        var x = geom.ox + col * cs, y = geom.oy + r * cs;

        if (st.id === 'bamboo') {
          ctx.fillStyle = '#3a3630';
          PM.roundRect(ctx, x + 1, y + 1, cs - 2, cs - 2, cs * 0.20); ctx.fill();
          ctx.fillStyle = '#57503f';
          PM.roundRect(ctx, x + 3, y + 3, cs - 6, cs - 6, cs * 0.18); ctx.fill();
          ctx.fillStyle = PM.withAlpha('#8d8470', 0.55);
          PM.roundRect(ctx, x + 5, y + 5, cs * 0.5, cs * 0.32, cs * 0.12); ctx.fill();
          ctx.fillStyle = PM.withAlpha('#241f18', 0.5);
          PM.roundRect(ctx, x + cs * 0.45, y + cs * 0.55, cs * 0.42, cs * 0.3, cs * 0.1); ctx.fill();
        } else if (st.id === 'future') {
          ctx.fillStyle = '#0a0d14';
          PM.roundRect(ctx, x + 1, y + 1, cs - 2, cs - 2, cs * 0.10); ctx.fill();
          ctx.strokeStyle = PM.withAlpha('#2b3446', 1);
          ctx.lineWidth = 1;
          PM.roundRect(ctx, x + 2.5, y + 2.5, cs - 5, cs - 5, cs * 0.10); ctx.stroke();
          ctx.fillStyle = PM.withAlpha('#12e0ff', 0.18);
          ctx.fillRect(x + cs * 0.22, y + cs * 0.44, cs * 0.56, cs * 0.12);
        } else {
          ctx.fillStyle = '#1a2636';
          PM.roundRect(ctx, x + 1, y + 1, cs - 2, cs - 2, 4); ctx.fill();
          ctx.fillStyle = PM.withAlpha('#4a6d92', 0.25);
          PM.roundRect(ctx, x + 3, y + 3, cs - 6, cs * 0.4, 3); ctx.fill();
          ctx.fillStyle = PM.withAlpha('#0a1018', 0.8);
          for (var rv = 0; rv < 2; rv++) {
            ctx.beginPath();
            ctx.arc(x + cs * (rv ? 0.78 : 0.22), y + cs * 0.78, cs * 0.05, 0, 6.2832);
            ctx.fill();
          }
        }
      }
    }
  }

  /* ---------- detalhes por estilo (anéis, cordas, neon) ---------- */
  function drawStyleDetails(ctx, cx, cy, cs, mask, st, seed, alpha) {
    var c = st.colors;
    var innerW = cs * 0.42;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;

    for (var d = 0; d < 4; d++) {
      if (!(mask & (1 << d))) continue;

      if (st.id === 'glass') {
        // anel cromado perto da borda
        var t = 0.80;
        var rr = armRect(cx, cy, cs, d, innerW * 1.42, t - 0.10, t + 0.06);
        var g = ctx.createLinearGradient(rr.x, rr.y, rr.x + rr.w, rr.y + rr.h);
        if (d % 2) { g = ctx.createLinearGradient(rr.x, rr.y, rr.x, rr.y + rr.h); }
        g.addColorStop(0, c.rimDark);
        g.addColorStop(0.35, '#ffffff');
        g.addColorStop(0.62, c.rim);
        g.addColorStop(1, c.rimDark);
        ctx.fillStyle = g;
        ctx.fillRect(rr.x, rr.y, rr.w, rr.h);
        ctx.strokeStyle = PM.withAlpha('#0a1420', 0.55);
        ctx.lineWidth = 0.8;
        ctx.strokeRect(rr.x, rr.y, rr.w, rr.h);

      } else if (st.id === 'bamboo') {
        // volta de corda de sisal
        var t2 = 0.62;
        var rc = armRect(cx, cy, cs, d, innerW * 1.5, t2 - 0.09, t2 + 0.09);
        ctx.fillStyle = '#a9762f';
        ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
        ctx.strokeStyle = '#6d4a16';
        ctx.lineWidth = 1;
        var horiz = (d === 1 || d === 3);
        var nLines = 3;
        for (var i = 0; i < nLines; i++) {
          var f = (i + 0.5) / nLines;
          ctx.beginPath();
          if (horiz) {
            var lx = rc.x + rc.w * f;
            ctx.moveTo(lx, rc.y); ctx.lineTo(lx, rc.y + rc.h);
          } else {
            var ly = rc.y + rc.h * f;
            ctx.moveTo(rc.x, ly); ctx.lineTo(rc.x + rc.w, ly);
          }
          ctx.stroke();
        }
        ctx.strokeStyle = PM.withAlpha('#e0b872', 0.7);
        ctx.beginPath();
        if (horiz) { ctx.moveTo(rc.x, rc.y + rc.h * 0.25); ctx.lineTo(rc.x + rc.w, rc.y + rc.h * 0.25); }
        else { ctx.moveTo(rc.x + rc.w * 0.25, rc.y); ctx.lineTo(rc.x + rc.w * 0.25, rc.y + rc.h); }
        ctx.stroke();

      } else {
        // abraçadeira metálica + filete de neon
        var t3 = 0.78;
        var rm = armRect(cx, cy, cs, d, innerW * 1.55, t3 - 0.08, t3 + 0.08);
        var gm = ctx.createLinearGradient(rm.x, rm.y, rm.x + rm.w, rm.y + rm.h);
        gm.addColorStop(0, c.rimDark);
        gm.addColorStop(0.4, '#e6edf5');
        gm.addColorStop(0.7, c.rim);
        gm.addColorStop(1, '#20262e');
        ctx.fillStyle = gm;
        ctx.fillRect(rm.x, rm.y, rm.w, rm.h);
        ctx.strokeStyle = PM.withAlpha('#05080d', 0.8);
        ctx.lineWidth = 0.8;
        ctx.strokeRect(rm.x, rm.y, rm.w, rm.h);
        // led na abraçadeira
        ctx.fillStyle = PM.withAlpha(hash(seed, d, 3) > 0.5 ? '#ff4d6a' : '#12e0ff', 0.95);
        ctx.fillRect(rm.x + rm.w * 0.32, rm.y + rm.h * 0.32, rm.w * 0.36, rm.h * 0.36);
      }
    }

    /* Aro em volta do furo, sem tampa: o líquido passa no meio. */
    var hub = centerRect(cx, cy, innerW * 1.22);
    var thick = Math.max(1.6, innerW * 0.18);
    ctx.lineWidth = thick;
    if (st.id === 'glass') {
      ctx.strokeStyle = c.rim;
      PM.roundRect(ctx, hub.x, hub.y, hub.w, hub.h, hub.w * 0.28); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = Math.max(1, thick * 0.35);
      PM.roundRect(ctx, hub.x + 1, hub.y + 1, hub.w - 2, hub.h - 2, hub.w * 0.26); ctx.stroke();
    } else if (st.id === 'bamboo') {
      ctx.strokeStyle = '#3d5c18';
      PM.roundRect(ctx, hub.x, hub.y, hub.w, hub.h, hub.w * 0.3); ctx.stroke();
      ctx.strokeStyle = '#d4f08a';
      ctx.lineWidth = Math.max(1, thick * 0.35);
      PM.roundRect(ctx, hub.x + 1.2, hub.y + 1.2, hub.w - 2.4, hub.h - 2.4, hub.w * 0.28); ctx.stroke();
    } else {
      ctx.strokeStyle = '#d5dee8';
      PM.roundRect(ctx, hub.x, hub.y, hub.w, hub.h, hub.w * 0.22); ctx.stroke();
      ctx.strokeStyle = '#12e0ff';
      ctx.lineWidth = Math.max(1, thick * 0.28);
      PM.roundRect(ctx, hub.x + 1.4, hub.y + 1.4, hub.w - 2.8, hub.h - 2.8, hub.w * 0.18); ctx.stroke();
    }

    ctx.restore();
  }

  /* textura de fibra de carbono / bambu no corpo do cano */
  function paintBody(ctx, cx, cy, cs, mask, st, seed) {
    var c = st.colors;
    var innerW = cs * 0.42;
    var rects = rectsFor(mask, cx, cy, cs, innerW, 1);
    pathPipe(ctx, cx, cy, cs, mask, innerW);
    ctx.save();
    ctx.clip();

    if (st.id === 'glass') {
      ctx.fillStyle = PM.withAlpha('#bfe6ff', 0.30);
      ctx.fill();
      // reflexos verticais
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        var horiz = r.w >= r.h;
        var g = horiz
          ? ctx.createLinearGradient(0, r.y, 0, r.y + r.h)
          : ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.55)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.05)');
        g.addColorStop(0.75, 'rgba(255,255,255,0.18)');
        g.addColorStop(1, 'rgba(255,255,255,0.60)');
        ctx.fillStyle = g;
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
    } else if (st.id === 'bamboo') {
      for (var j = 0; j < rects.length; j++) {
        var rr = rects[j];
        var horiz2 = rr.w >= rr.h;
        var g2 = horiz2
          ? ctx.createLinearGradient(0, rr.y, 0, rr.y + rr.h)
          : ctx.createLinearGradient(rr.x, 0, rr.x + rr.w, 0);
        g2.addColorStop(0, '#4e7a22');
        g2.addColorStop(0.30, '#a8d451');
        g2.addColorStop(0.52, '#7fb838');
        g2.addColorStop(1, '#33591a');
        ctx.fillStyle = g2;
        ctx.fillRect(rr.x, rr.y, rr.w, rr.h);
      }
      // nós do bambu
      ctx.fillStyle = PM.withAlpha('#2f4a12', 0.55);
      for (var k = 0; k < rects.length; k++) {
        var rk = rects[k];
        if (k === 0) continue;
        ctx.fillRect(rk.x, rk.y, rk.w, rk.h);
      }
    } else {
      ctx.fillStyle = '#22262d';
      ctx.fill();
      // trama diagonal
      ctx.strokeStyle = PM.withAlpha('#3d4550', 0.9);
      ctx.lineWidth = 1.4;
      var x0 = cx - cs / 2, y0 = cy - cs / 2, step = 6;
      for (var p = -cs; p < cs * 2; p += step) {
        ctx.beginPath();
        ctx.moveTo(x0 + p, y0);
        ctx.lineTo(x0 + p + cs, y0 + cs);
        ctx.stroke();
      }
      ctx.strokeStyle = PM.withAlpha('#161a20', 0.9);
      for (var p2 = -cs; p2 < cs * 2; p2 += step) {
        ctx.beginPath();
        ctx.moveTo(x0 + p2, y0 + cs);
        ctx.lineTo(x0 + p2 + cs, y0);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* Miolo mais claro ou mais fundo, para o cano parecer oco antes da água. */
  function paintBore(ctx, cx, cy, cs, mask, st) {
    ctx.save();
    pathPipe(ctx, cx, cy, cs, mask, cs * 0.36);
    ctx.fillStyle = st.id === 'glass' ? 'rgba(214, 238, 255, 0.62)'
      : (st.id === 'bamboo' ? 'rgba(232, 255, 170, 0.42)' : 'rgba(8, 10, 16, 0.78)');
    ctx.fill();
    ctx.restore();
  }

  /* parede externa (borda/escuridão) do cano */
  function paintWall(ctx, cx, cy, cs, mask, st) {
    var outerW = cs * 0.62;
    pathPipe(ctx, cx, cy, cs, mask, outerW);
    ctx.fillStyle = st.id === 'glass' ? PM.withAlpha('#9fc6e2', 0.55)
      : (st.id === 'bamboo' ? '#3f6419' : '#0f1319');
    ctx.fill();
    ctx.lineWidth = Math.max(1, cs * 0.03);
    ctx.strokeStyle = PM.withAlpha('#000000', st.id === 'glass' ? 0.35 : 0.55);
    ctx.stroke();
  }

  function paintShadow(ctx, cx, cy, cs, mask, st) {
    var outerW = cs * 0.66;
    ctx.save();
    ctx.translate(cs * 0.045, cs * 0.07);
    pathPipe(ctx, cx, cy, cs, mask, outerW);
    ctx.fillStyle = PM.withAlpha('#000000', 0.35);
    ctx.fill();
    ctx.restore();
  }

  /* fluido dentro do cano */
  function paintFluid(ctx, cx, cy, cs, mask, entry, p, st, seed, time) {
    var innerW = cs * 0.46;
    var rects = fluidRects(cx, cy, cs, mask, entry, p, innerW);
    if (!rects.length) return;
    ctx.save();
    pathPipe(ctx, cx, cy, cs, mask, innerW);
    ctx.clip();
    pathRects(ctx, rects);
    ctx.clip();

    var g = ctx.createLinearGradient(cx - cs / 2, cy - cs / 2, cx + cs / 2, cy + cs / 2);
    g.addColorStop(0, st.colors.fluidA);
    g.addColorStop(0.5, st.colors.fluidB);
    g.addColorStop(1, st.colors.fluidA);
    ctx.fillStyle = g;
    ctx.globalAlpha = 1;
    ctx.fillRect(cx - cs / 2, cy - cs / 2, cs, cs);
    ctx.globalAlpha = 1;

    PM.Fluid.paint(ctx, st, rects, seed, time);

    // frente do fluido brilhando
    if (p < 0.999) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      var front = rects[rects.length - 1];
      ctx.fillRect(front.x, front.y, Math.max(2, front.w), Math.max(2, front.h));
    }
    ctx.restore();

    // brilho externo do fluido
    if (st.id === 'future') {
      ctx.save();
      ctx.globalAlpha = 0.35 * p;
      ctx.shadowColor = st.colors.glow;
      ctx.shadowBlur = cs * 0.5;
      pathRects(ctx, rects);
      ctx.strokeStyle = PM.withAlpha(st.colors.glow, 0.6);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  /* Véu leve por cima do líquido, para o cano parecer oco e transparente. */
  function paintWindow(ctx, cx, cy, cs, mask, st) {
    var w = cs * 0.46;
    ctx.save();
    pathPipe(ctx, cx, cy, cs, mask, w);
    ctx.clip();
    ctx.fillStyle = st.id === 'glass' ? 'rgba(255,255,255,0.14)'
      : (st.id === 'bamboo' ? 'rgba(186, 230, 90, 0.18)' : 'rgba(8, 12, 18, 0.14)');
    ctx.fillRect(cx - cs, cy - cs, cs * 2, cs * 2);
    ctx.fillStyle = st.id === 'future' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.22)';
    for (var d = 0; d < 4; d++) {
      if (!(mask & (1 << d))) continue;
      var streak = armRect(cx, cy, cs, d, Math.max(1.5, w * 0.14), 0.02, 0.94);
      ctx.fillRect(streak.x, streak.y, streak.w, streak.h);
    }
    ctx.restore();
  }

  /* folha decorativa (bambu) */
  function drawLeaf(ctx, x, y, s, ang, col) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 0.6, -s * 0.42, s * 1.25, 0);
    ctx.quadraticCurveTo(s * 0.6, s * 0.42, 0, 0);
    ctx.fill();
    ctx.strokeStyle = PM.withAlpha('#2c4a15', 0.7);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(s * 1.2, 0);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- peça única (tabuleiro e prévia) ---------- */
  function drawPipe(ctx, opt) {
    var cx = opt.cx, cy = opt.cy, cs = opt.cs, mask = opt.mask, st = opt.style;
    var seed = opt.seed || 0;
    var ghost = opt.ghost;
    var time = opt.time || 0;

    ctx.save();
    if (ghost) ctx.globalAlpha = opt.alpha === undefined ? 0.32 : opt.alpha;

    paintShadow(ctx, cx, cy, cs, mask, st);
    paintWall(ctx, cx, cy, cs, mask, st);
    paintBody(ctx, cx, cy, cs, mask, st, seed);
    paintBore(ctx, cx, cy, cs, mask, st);
    /* Anéis e o cubo ficam atrás do líquido: o canal inteiro permanece visível. */
    drawStyleDetails(ctx, cx, cy, cs, mask, st, seed, ghost ? 0.5 : 1);

    if (opt.fluid > 0 && !ghost) {
      paintFluid(ctx, cx, cy, cs, mask, opt.entry, opt.fluid, st, seed, time);
      paintWindow(ctx, cx, cy, cs, mask, st);
    }

    // brilho superior só no vidro vazio; com água, o véu apagaria o canal
    if (st.id === 'glass' && !ghost && !(opt.fluid > 0)) {
      ctx.save();
      var innerW = cs * 0.42;
      pathRects(ctx, rectsFor(mask, cx, cy, cs, innerW, 1));
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      for (var d = 0; d < 4; d++) {
        if (!(mask & (1 << d))) continue;
        var hl = armRect(cx, cy, cs, d, innerW * 0.22, 0.05, 0.96);
        ctx.fillRect(hl.x, hl.y - innerW * 0.16, hl.w, hl.h);
      }
      ctx.restore();
    }

    // folhas e brotos (bambu)
    if (st.id === 'bamboo' && !ghost) {
      var lv = hash(seed, 5, 2);
      if (lv > 0.45) {
        drawLeaf(ctx, cx + cs * 0.30, cy - cs * 0.30, cs * 0.30, -0.7 - lv, '#5c9c2a');
      }
      if (hash(seed, 6, 3) > 0.72) {
        drawLeaf(ctx, cx - cs * 0.34, cy + cs * 0.30, cs * 0.24, 2.5, '#6fae35');
      }
    }

    ctx.restore();
  }

  /* ---------- marcadores S e E ---------- */
  function drawMarker(ctx, geom, game, cell, kind, time) {
    var cs = geom.cell;
    var x = geom.ox + cell.c * cs, y = geom.oy + cell.r * cs;
    var cx = x + cs / 2, cy = y + cs / 2;
    var st = game.style, c = st.colors;
    var col = kind === 'start' ? c.start : (kind === 'cistern' ? c.fluidB : c.end);
    var pulse = 0.6 + 0.4 * Math.sin(time / 320 + (kind === 'start' ? 0 : 1.6));

    // halo
    ctx.save();
    var g = ctx.createRadialGradient(cx, cy, cs * 0.1, cx, cy, cs * 0.72);
    g.addColorStop(0, PM.withAlpha(col, 0.45 * pulse));
    g.addColorStop(1, PM.withAlpha(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - cs * 0.3, y - cs * 0.3, cs * 1.6, cs * 1.6);
    ctx.restore();

    // corpo do marcador (tampa de 1 abertura)
    var mask = cell.mask;
    drawPipe(ctx, {
      cx: cx, cy: cy, cs: cs, mask: mask, style: st, seed: cell.r * game.cols + cell.c,
      fluid: cell.fill, entry: cell.fillDir, time: time
    });

    // placa com a letra
    var pw = cs * 0.52, ph = cs * 0.42;
    ctx.save();
    ctx.fillStyle = PM.withAlpha('#0a1018', 0.85);
    PM.roundRect(ctx, cx - pw / 2, cy - ph / 2, pw, ph, ph * 0.25); ctx.fill();
    ctx.strokeStyle = PM.withAlpha(col, 0.9);
    ctx.lineWidth = 2;
    PM.roundRect(ctx, cx - pw / 2, cy - ph / 2, pw, ph, ph * 0.25); ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = 'bold ' + Math.round(ph * 0.78) + 'px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var letter = kind === 'start' ? 'S' : (kind === 'cistern' ? 'C' : 'R');
    ctx.fillText(letter, cx, cy + ph * 0.03);
    ctx.restore();

    // jatinho saindo do S antes do fluido começar
    if (kind === 'start' && !cell.fill) {
      PM.Fluid.spray(ctx, st, cx, cy + cs * 0.1, 2, time, 0.35);
    }
  }

  /* Verde = encaixa, âmbar = casa vazia, vermelho = bloqueio ou borda. */
  function mouthStatus(game, r, c, d) {
    var nb = game.cellAt(r + PM.DY[d], c + PM.DX[d]);
    if (!nb || nb.state === 'blocked') return 'bad';
    if (nb.state === 'empty') return 'open';
    if ((nb.state === 'pipe' || nb.state === 'source' || nb.state === 'drain') &&
        (nb.mask & PM.bit(PM.opp(d)))) return 'connect';
    return 'bad';
  }

  var MOUTH_COLOR = { connect: '#3ef2a0', open: '#ffb03a', bad: '#ff4d4d' };

  function drawMouth(ctx, x, y, cs, d, status, alpha) {
    var mx = x + PM.DX[d] * cs * 0.40;
    var my = y + PM.DY[d] * cs * 0.40;
    ctx.beginPath();
    ctx.fillStyle = PM.withAlpha(MOUTH_COLOR[status] || '#ffb03a', alpha);
    ctx.arc(mx, my, Math.max(3, cs * 0.11), 0, 6.2832);
    ctx.fill();
  }

  function drawGhostMouths(ctx, geom, game, tgt) {
    var cs = geom.cell;
    var mask = game.currentMask();
    var cx = geom.ox + tgt.c * cs + cs / 2;
    var cy = geom.oy + tgt.r * cs + cs / 2;
    for (var d = 0; d < 4; d++) {
      if (!(mask & (1 << d))) continue;
      drawMouth(ctx, cx, cy, cs, d, mouthStatus(game, tgt.r, tgt.c, d), 0.95);
    }
  }

  /* A casa enche a partir do lado de onde a água chegou. */
  function spillBox(x, y, cs, p, or, oc, r, c) {
    if (r === or && c === oc) {
      var inset = (1 - p) * cs * 0.5;
      return { x: x + inset, y: y + inset, w: Math.max(1, cs * p), h: Math.max(1, cs * p) };
    }
    var dr = r - or;
    var dc = c - oc;
    if (Math.abs(dc) > Math.abs(dr)) {
      if (dc > 0) return { x: x, y: y, w: Math.max(1, cs * p), h: cs };
      return { x: x + cs * (1 - p), y: y, w: Math.max(1, cs * p), h: cs };
    }
    if (dr > 0) return { x: x, y: y, w: cs, h: Math.max(1, cs * p) };
    return { x: x, y: y + cs * (1 - p), w: cs, h: Math.max(1, cs * p) };
  }

  function drawSpill(ctx, geom, game, time) {
    var spill = game.spill;
    if (!spill) return;
    if (game.status !== 'leaking' && game.status !== 'lost') return;
    var cols = game.style.colors;
    var cs = geom.cell;
    var edge = Math.max(2, cs * 0.08);
    ctx.save();
    ctx.beginPath();
    ctx.rect(geom.ox, geom.oy, geom.bw, geom.bh);
    ctx.clip();
    for (var r = 0; r < game.rows; r++) {
      for (var c = 0; c < game.cols; c++) {
        var dist = Math.abs(r - spill.r) + Math.abs(c - spill.c);
        var p = PM.clamp((time - spill.t0 - dist * spill.stepMs) / spill.riseMs, 0, 1);
        if (p <= 0.001) continue;
        var x = geom.ox + c * cs;
        var y = geom.oy + r * cs;
        var box = spillBox(x, y, cs, p, spill.r, spill.c, r, c);
        ctx.globalAlpha = 0.58 + 0.34 * p;
        ctx.fillStyle = cols.fluidA;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.globalAlpha = 0.35 * p;
        ctx.fillStyle = cols.fluidB;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        if (p < 0.98) {
          ctx.globalAlpha = 0.92;
          ctx.fillStyle = cols.glow || cols.fluidB;
          if (box.h < cs - 1 && box.w >= box.h) {
            var fromTop = box.y <= y + 1;
            ctx.fillRect(box.x, fromTop ? box.y : box.y + box.h - edge, box.w, edge);
          } else if (box.w < cs - 1) {
            var fromLeft = box.x <= x + 1;
            ctx.fillRect(fromLeft ? box.x : box.x + box.w - edge, box.y, edge, box.h);
          } else {
            ctx.fillRect(box.x, box.y, box.w, edge);
          }
        } else {
          ctx.globalAlpha = 0.28 + 0.08 * Math.sin(time / 160 + r + c);
          ctx.fillStyle = cols.glow || '#ffffff';
          ctx.fillRect(x + cs * 0.12, y + cs * 0.16, cs * 0.42, Math.max(2, cs * 0.07));
        }
      }
    }
    ctx.restore();
  }

  function drawDanger(ctx, geom, game, time) {
    if (game.status !== 'flow' && game.status !== 'leaking') return;
    var cs = geom.cell;
    var pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time / 110));
    for (var r = 0; r < game.rows; r++) {
      for (var c = 0; c < game.cols; c++) {
        var cell = game.cells[r][c];
        if (!cell || cell.fill < 0.62 || cell.fillStart < 0) continue;
        if (cell.state !== 'pipe' && cell.state !== 'source') continue;
        var cx = geom.ox + c * cs + cs / 2;
        var cy = geom.oy + r * cs + cs / 2;
        for (var d = 0; d < 4; d++) {
          if (!(cell.mask & (1 << d))) continue;
          if (mouthStatus(game, r, c, d) === 'connect') continue;
          drawMouth(ctx, cx, cy, cs, d, 'bad', pulse);
        }
      }
    }
  }

  /* Casa livre para o registro: fora de S, dos destinos e do caminho. */
  function valveCellScore(game, r, c) {
    var src = game.level.start;
    if (src && r === src.r && c === src.c) return -800;
    var drains = game.level.drains || [];
    var i;
    for (i = 0; i < drains.length; i++) {
      if (drains[i].r === r && drains[i].c === c) return -800;
    }
    var sol = game.level.solution || [];
    for (i = 0; i < sol.length; i++) {
      if (sol[i].r === r && sol[i].c === c) return -500;
    }
    var idx = r * game.cols + c;
    var blocked = game.level.blocked && game.level.blocked[idx];
    var edge = (r === 0 || c === 0 || r === game.rows - 1 || c === game.cols - 1) ? 24 : 0;
    var corner = ((r === 0 || r === game.rows - 1) && (c === 0 || c === game.cols - 1)) ? 30 : 0;
    return (blocked ? 80 : 8) + edge + corner;
  }

  /* Registro no tabuleiro: solta a água, o mesmo que a tecla R. */
  function valveMetrics(geom, game) {
    if (!geom || !game || !game.level || !game.level.start) return null;
    var cs = geom.cell;
    var size = Math.max(34, Math.min(cs * 0.9, 62));
    var bestR = 0, bestC = 0, bestScore = -1e9;
    for (var r = 0; r < game.rows; r++) {
      for (var c = 0; c < game.cols; c++) {
        var score = valveCellScore(game, r, c);
        if (score > bestScore) { bestScore = score; bestR = r; bestC = c; }
      }
    }
    var cx = geom.ox + (bestC + 0.5) * cs;
    var cy = geom.oy + (bestR + 0.5) * cs;
    cx = PM.clamp(cx, size / 2 + 2, geom.W - size / 2 - 2);
    cy = PM.clamp(cy, size / 2 + 2, geom.H - size / 2 - 2);
    return {
      x: cx - size / 2, y: cy - size / 2,
      w: size, h: size, cx: cx, cy: cy, r: size / 2
    };
  }

  function drawGlassValve(ctx, v, hot, open, time) {
    var cx = v.cx, cy = v.cy, r = v.r * 0.92;
    if (hot) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(30, 200, 255, ' + (0.16 + 0.14 * Math.sin(time / 160)) + ')';
      ctx.arc(cx, cy, r * 1.22, 0, 6.2832);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.arc(cx + 1, cy + 2, r, 0, 6.2832);
    ctx.fill();
    var g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#f7fcff');
    g.addColorStop(0.42, '#b7c9d6');
    g.addColorStop(1, '#3e5568');
    ctx.beginPath();
    ctx.fillStyle = g;
    ctx.arc(cx, cy, r, 0, 6.2832);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.strokeStyle = '#e7f3fb';
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(open ? 0.95 : (hot ? Math.sin(time / 260) * 0.1 : 0));
    ctx.strokeStyle = '#163044';
    ctx.lineWidth = Math.max(2, r * 0.13);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.58, 0); ctx.lineTo(r * 0.58, 0);
    ctx.moveTo(0, -r * 0.58); ctx.lineTo(0, r * 0.58);
    ctx.moveTo(-r * 0.4, -r * 0.4); ctx.lineTo(r * 0.4, r * 0.4);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.fillStyle = hot ? '#1ec8ff' : (open ? '#0838d4' : '#d7e8f4');
    ctx.arc(cx, cy, r * 0.26, 0, 6.2832);
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
  }

  function drawBambooLever(ctx, v, hot, open, time) {
    var cx = v.cx, cy = v.cy, r = v.r;
    var ang = open ? 0.95 : -0.9;
    if (hot) ang += Math.sin(time / 190) * 0.14;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    PM.roundRect(ctx, cx - r * 0.58, cy - r * 0.22, r * 1.16, r * 0.62, r * 0.18);
    ctx.fill();
    ctx.fillStyle = '#4a3b2a';
    PM.roundRect(ctx, cx - r * 0.55, cy - r * 0.28, r * 1.1, r * 0.58, r * 0.16);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = '#6d4a1f';
    ctx.arc(cx, cy, r * 0.2, 0, 6.2832);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    var g = ctx.createLinearGradient(0, -r * 0.15, 0, r * 0.15);
    g.addColorStop(0, '#3c5e16');
    g.addColorStop(0.45, '#c6ee62');
    g.addColorStop(1, '#2a4510');
    ctx.fillStyle = g;
    PM.roundRect(ctx, r * 0.02, -r * 0.15, r * 0.92, r * 0.3, r * 0.15);
    ctx.fill();
    ctx.strokeStyle = '#8d5a22';
    ctx.lineWidth = Math.max(1.4, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(r * 0.32, -r * 0.15); ctx.lineTo(r * 0.32, r * 0.15);
    ctx.moveTo(r * 0.58, -r * 0.15); ctx.lineTo(r * 0.58, r * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = '#e7c48a';
    ctx.arc(r * 0.92, 0, r * 0.15, 0, 6.2832);
    ctx.fill();
    ctx.restore();
    if (hot) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(198, 232, 106, ' + (0.45 + 0.4 * Math.sin(time / 160)) + ')';
      ctx.lineWidth = 2;
      ctx.arc(cx, cy, r * 0.98, 0, 6.2832);
      ctx.stroke();
    }
  }

  function drawFutureButton(ctx, v, hot, open, time) {
    var x = v.x, y = v.y, w = v.w, h = v.h;
    var pulse = 0.5 + 0.5 * Math.sin(time / 130);
    var neon = open ? '#25e0ff' : '#ff3b6a';
    var glow = hot ? (0.55 + 0.45 * pulse) : (open ? 1 : 0.35);
    ctx.fillStyle = '#10151d';
    PM.roundRect(ctx, x, y, w, h, h * 0.2);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = neon;
    ctx.shadowBlur = hot ? 16 * glow : 6;
    ctx.lineWidth = Math.max(2, h * 0.07);
    ctx.strokeStyle = PM.withAlpha(neon, 0.4 + 0.6 * glow);
    PM.roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, h * 0.18);
    ctx.stroke();
    ctx.restore();
    var br = h * 0.26;
    var bx = x + w * 0.64, by = y + h * 0.52;
    var bg = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.4, 1, bx, by, br);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.35, neon);
    bg.addColorStop(1, open ? '#065e72' : '#6e1028');
    ctx.beginPath();
    ctx.fillStyle = bg;
    ctx.arc(bx, by, br, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = PM.withAlpha('#ff4d6a', hot ? 0.45 + 0.55 * pulse : (open ? 0.25 : 0.85));
    PM.roundRect(ctx, x + w * 0.12, y + h * 0.22, w * 0.2, h * 0.16, 2);
    ctx.fill();
    ctx.fillStyle = PM.withAlpha('#25e0ff', open ? 0.95 : 0.28);
    PM.roundRect(ctx, x + w * 0.12, y + h * 0.52, w * 0.2, h * 0.16, 2);
    ctx.fill();
  }

  function drawValve(ctx, geom, game, time) {
    var v = valveMetrics(geom, game);
    if (!v || !game.style) return;
    var hot = game.status === 'prep';
    var open = game.status === 'flow' || game.status === 'leaking' ||
      game.status === 'won' || game.status === 'lost' ||
      (game.status === 'paused' && game._prev && game._prev !== 'prep');
    ctx.save();
    if (game.style.id === 'bamboo') drawBambooLever(ctx, v, hot, open, time);
    else if (game.style.id === 'future') drawFutureButton(ctx, v, hot, open, time);
    else drawGlassValve(ctx, v, hot, open, time);
    ctx.restore();
    geom.valve = v;
  }

  var bgCache = { key: '', canvas: null };

  function bakeBackground(geom, game) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var seed = game.level && game.level.seed;
    var key = [
      game.style.id, game.levelN, seed, geom.cell, geom.W, geom.H,
      geom.ox, geom.oy, game.cols, game.rows, dpr
    ].join('|');
    if (bgCache.key === key && bgCache.canvas) return bgCache.canvas;
    var cnv = bgCache.canvas || document.createElement('canvas');
    var box = PM.bitmapCanvas(cnv, geom.W, geom.H, 2);
    box.ctx.clearRect(0, 0, geom.W, geom.H);
    drawBackground(box.ctx, geom, game, 900);
    drawTerrain(box.ctx, geom, game);
    bgCache.canvas = cnv;
    bgCache.key = key;
    return cnv;
  }

  /* ---------- API pública ---------- */
  PM.Render = {
    /* calcula o encaixe do tabuleiro no canvas */
    layout: function (canvas, game) {
      var host = canvas.parentElement;
      if (!host) return null;
      /* O CSS mantém o canvas em 100% da moldura. A medida é o miolo
         (clientWidth), nunca o retângulo da borda, para o canvas não
         empurrar o pai e crescer sem parar. */
      if (canvas.style.width !== '100%') canvas.style.width = '100%';
      if (canvas.style.height !== '100%') canvas.style.height = '100%';
      var W = host.clientWidth | 0;
      var H = host.clientHeight | 0;
      if (W < 8 || H < 8 || !game.cols || !game.rows) return null;
      var f = PM.bitmapCanvas(canvas, W, H, 2);
      var pad = 4;
      var cell = Math.floor(Math.min((f.w - pad * 2) / game.cols, (f.h - pad * 2) / game.rows));
      cell = Math.max(8, Math.min(cell, 160));
      var bw = cell * game.cols, bh = cell * game.rows;
      return {
        ctx: f.ctx, W: f.w, H: f.h, cell: cell,
        ox: Math.round((f.w - bw) / 2), oy: Math.round((f.h - bh) / 2),
        bw: bw, bh: bh
      };
    },

    board: function (geom, game, time) {
      var ctx = geom.ctx, cs = geom.cell;
      ctx.drawImage(bakeBackground(geom, game), 0, 0, geom.W, geom.H);

      // canos colocados pelo jogador (estado 'pipe')
      for (var r = 0; r < game.rows; r++) {
        for (var c = 0; c < game.cols; c++) {
          var cell = game.cells[r][c];
          if (!cell || cell.state !== 'pipe') continue;
          drawPipe(ctx, {
            cx: geom.ox + c * cs + cs / 2,
            cy: geom.oy + r * cs + cs / 2,
            cs: cs, mask: cell.mask, style: game.style,
            seed: r * game.cols + c,
            fluid: cell.fill, entry: cell.fillDir, time: time
          });
        }
      }

      // fonte S, ralo R e cisterna C por cima
      drawMarker(ctx, geom, game, game.cells[game.level.start.r][game.level.start.c], 'start', time);
      var sinks = game.level.drains || [];
      for (var di = 0; di < sinks.length; di++) {
        var sink = sinks[di];
        var sk = game.cells[sink.r][sink.c];
        drawMarker(ctx, geom, game, sk, sink.role === 'cistern' ? 'cistern' : 'drain', time);
      }

      drawDanger(ctx, geom, game, time);
      drawSpill(ctx, geom, game, time);

      // prévia de colocação: célula sob o mouse (mouse) ou cursor (teclado/toque)
      var tgt = game.hover || game.cursor;
      if (tgt && (game.status === 'prep' || game.status === 'flow' || game.status === 'ready')) {
        var mode = game.targetMode(tgt.r, tgt.c);
        var tx = geom.ox + tgt.c * cs, ty = geom.oy + tgt.r * cs;
        var tcol = mode === 'ok' ? '#3ef2a0' : (mode === 'overwrite' ? '#ffb03a' : '#ff4d4d');
        if (game.status !== 'ready' && mode !== 'no') {
          drawPipe(ctx, {
            cx: tx + cs / 2, cy: ty + cs / 2, cs: cs,
            mask: game.currentMask(), style: game.style,
            ghost: true, alpha: 0.5, seed: tgt.r * game.cols + tgt.c
          });
          drawGhostMouths(ctx, geom, game, tgt);
        }
        ctx.save();
        ctx.strokeStyle = PM.withAlpha(tcol, 0.85);
        ctx.lineWidth = 2;
        if (mode === 'no') ctx.setLineDash([4, 3]);
        ctx.strokeRect(tx + 1.5, ty + 1.5, cs - 3, cs - 3);
        ctx.restore();
      }

      // vazamentos
      if (game.leaks && game.leaks.length) {
        for (var i = 0; i < game.leaks.length; i++) {
          var lk = game.leaks[i];
          var lx = geom.ox + lk.c * cs + cs / 2 + PM.DX[lk.d] * cs * 0.5;
          var ly = geom.oy + lk.r * cs + cs / 2 + PM.DY[lk.d] * cs * 0.5;
          var amt = PM.clamp((time - lk.t) / 700, 0, 1.6);
          ctx.save();
          ctx.globalAlpha = 0.9;
          PM.Fluid.spray(ctx, game.style, lx, ly, lk.d, time, amt);
          ctx.restore();
          // borda vermelha piscando na célula
          ctx.save();
          ctx.strokeStyle = PM.withAlpha('#ff4d4d', 0.5 + 0.5 * Math.sin(time / 90));
          ctx.lineWidth = 2;
          ctx.strokeRect(geom.ox + lk.c * cs + 1, geom.oy + lk.r * cs + 1, cs - 2, cs - 2);
          ctx.restore();
        }
      }

      drawValve(ctx, geom, game, time);
    },

    hitValve: function (geom, game, x, y) {
      if (!game || game.status !== 'prep' || !geom || !geom.valve) return false;
      var v = geom.valve;
      return x >= v.x && y >= v.y && x < v.x + v.w && y < v.y + v.h;
    },

    /* ícone de peça para a barra lateral / menu */
    pieceIcon: function (canvas, style, kind, rot, opts) {
      opts = opts || {};
      var W = canvas.clientWidth | 0;
      var H = canvas.clientHeight | 0;
      if (W < 8 || H < 8) return null;
      var f = PM.bitmapCanvas(canvas, W, H, 2);
      var ctx = f.ctx;
      ctx.clearRect(0, 0, W, H);

      if (opts.bg !== false) {
        ctx.fillStyle = opts.bg || 'rgba(12,18,28,0.55)';
        PM.roundRect(ctx, 1, 1, W - 2, H - 2, 8);
        ctx.fill();
      }
      var cs = Math.min(W, H) * (opts.fit || 0.86);
      var mask = kind === 'cap' ? (1 << (rot & 3)) : PM.maskOf(kind, rot);
      drawPipe(ctx, {
        cx: W / 2, cy: H / 2, cs: cs, mask: mask, style: style,
        seed: opts.seed || 3, fluid: opts.fluid || 0, entry: -1, time: opts.time || 0
      });
      return { ctx: ctx, W: W, H: H };
    },

    /* miniatura de peça da fila (desenha direto no contexto informado) */
    queuePiece: function (ctx, cx, cy, size, style, kind, seed) {
      if (!kind || size < 6) return;
      var rot = (kind === PM.KIND.STRAIGHT) ? 1 : 0;
      ctx.save();
      ctx.globalAlpha = 0.9;
      drawPipe(ctx, {
        cx: cx, cy: cy, cs: size * 0.9, mask: PM.maskOf(kind, rot),
        style: style, seed: (seed || 1) * 13 + 5
      });
      ctx.restore();
    },

    /* prévia pequena para os cartões de estilo do menu */
    stylePreview: function (canvas, style, time) {
      var W = canvas.clientWidth | 0;
      var H = canvas.clientHeight | 0;
      if (W < 8 || H < 8) return;
      var f = PM.bitmapCanvas(canvas, W, H, 2);
      var ctx = f.ctx;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = PM.withAlpha(style.colors.tileA, 0.9);
      ctx.fillRect(0, 0, W, H);
      var cs = Math.min(H * 0.72, W * 0.30);
      var cy = H / 2;
      var seq = [
        { mask: 5, fluid: 1 },        // reta vertical
        { mask: 3, fluid: 1 },        // curva
        { mask: 10, fluid: 0.7 },     // reta horizontal
        { mask: 7, fluid: 1 }         // junção T
      ];
      for (var i = 0; i < seq.length; i++) {
        var cx = W * (0.16 + i * 0.24);
        drawPipe(ctx, {
          cx: cx, cy: cy, cs: cs, mask: seq[i].mask, style: style,
          seed: i * 17 + 5, fluid: seq[i].fluid, entry: 3, time: time
        });
      }
    }
  };
})(window.PM);
