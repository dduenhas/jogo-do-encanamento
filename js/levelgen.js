/* ============================================================
   levelgen.js — tabuleiro com fonte, ralo e solução jogável
   ------------------------------------------------------------
   A fonte S fica na linha 0, abrindo para baixo. O corredor
   termina num ralo (uma boca). Da fase 3 um ramal sai de uma
   junção T e acaba numa cisterna. Da fase 5 esse ramal atravessa
   o corredor numa cruz. Os obstáculos fecham a reta na frente
   de cada curva e sobram longe do caminho.

   A solução gravada prova que a fase cabe nas peças da fila.
   O jogador pode usar outro traçado, desde que a água chegue
   a todos os destinos sem ponta aberta. Tudo é determinístico
   a partir de (estilo, fase).
   ============================================================ */
(function (PM) {
  'use strict';

  var N = 0, E = 1, S = 2, W = 3;

  function idx(cols, r, c) { return r * cols + c; }
  function inB(cols, rows, r, c) { return r >= 0 && c >= 0 && r < rows && c < cols; }
  function kxy(r, c) { return r + ',' + c; }

  function pickSource(rng, cols) {
    var c = 1 + rng.int(Math.max(1, cols - 2));
    return { r: 0, c: c, outDir: S, rot: 2 };
  }

  function cellFree(cols, rows, r, c, used) {
    if (!inB(cols, rows, r, c) || r === 0) return false;
    return !used[idx(cols, r, c)];
  }

  function dirOf(a, b) {
    if (b.r < a.r) return N;
    if (b.r > a.r) return S;
    if (b.c > a.c) return E;
    return W;
  }

  /* Corredor principal: retas longas e uma volta a cada trecho,
     para sobrar lado livre onde o ramal e a cruz se apoiam. */
  function routeMain(rng, cols, rows, src, pathLen, minTurns) {
    var used = {};
    used[idx(cols, src.r, src.c)] = 1;
    var cells = [];
    var r = src.r + 1, c = src.c;
    var arrive = S;
    var dir = rng.chance(0.5) ? E : W;
    if (dir === E && c > cols - 3) dir = W;
    if (dir === W && c < 2) dir = E;
    var turns = 0;
    var run = 0;
    var runMax = Math.max(2, Math.floor(pathLen / (minTurns + 1)));

    for (var i = 0; i < pathLen; i++) {
      if (!cellFree(cols, rows, r, c, used)) return null;
      var cell = { r: r, c: c, arrive: arrive, leave: arrive };
      cells.push(cell);
      used[idx(cols, r, c)] = 1;
      if (i === pathLen - 1) {
        var drainDir = pickOpen(cols, rows, r, c, [arrive, (arrive + 1) & 3, (arrive + 3) & 3], used);
        if (drainDir == null) return null;
        cell.leave = drainDir;
        if (drainDir !== arrive) turns++;
        var dr = r + PM.DY[drainDir], dc = c + PM.DX[drainDir];
        used[idx(cols, dr, dc)] = 1;
        return {
          src: src, cells: cells, used: used, turns: turns, spurs: [],
          drain: { r: dr, c: dc, dir: PM.opp(drainDir), role: 'drain' }
        };
      }

      var force = run >= runMax && turns < minTurns;
      var next = null;
      var straightR = r + PM.DY[dir], straightC = c + PM.DX[dir];
      if (!force && cellFree(cols, rows, straightR, straightC, used)) next = dir;
      if (next == null) {
        var alts = [(dir + 1) & 3, (dir + 3) & 3, dir, PM.opp(dir)];
        for (var a = 0; a < alts.length; a++) {
          if (alts[a] === PM.opp(arrive)) continue;
          var nr = r + PM.DY[alts[a]], nc = c + PM.DX[alts[a]];
          if (cellFree(cols, rows, nr, nc, used)) { next = alts[a]; break; }
        }
      }
      if (next == null) return null;
      cell.leave = next;
      if (next !== arrive) { turns++; run = 0; }
      else run++;
      arrive = next;
      dir = next;
      r += PM.DY[next];
      c += PM.DX[next];
    }
    return null;
  }

  function pickOpen(cols, rows, r, c, dirs, used) {
    for (var i = 0; i < dirs.length; i++) {
      var d = dirs[i];
      var nr = r + PM.DY[d], nc = c + PM.DX[d];
      if (!inB(cols, rows, nr, nc)) continue;
      if (used[idx(cols, nr, nc)]) continue;
      return d;
    }
    return null;
  }

  function freeMouths(cell) {
    var taken = {};
    taken[PM.opp(cell.arrive)] = 1;
    taken[cell.leave] = 1;
    var out = [];
    for (var d = 0; d < 4; d++) if (!taken[d]) out.push(d);
    return out;
  }

  function mark(used, cols, list) {
    for (var i = 0; i < list.length; i++) used[idx(cols, list[i].r, list[i].c)] = 1;
  }
  function unmark(used, cols, list) {
    for (var i = 0; i < list.length; i++) delete used[idx(cols, list[i].r, list[i].c)];
  }

  /* Ramal reto-com-uma-dobra: `spurLen` canos e uma cisterna. */
  function growSpur(cols, rows, r, c, dir, spurLen, used) {
    var pipes = [];
    var cr = r + PM.DY[dir], cc = c + PM.DX[dir];
    var arrive = dir;
    var d = dir;
    var added = [];
    for (var i = 0; i < spurLen; i++) {
      if (!cellFree(cols, rows, cr, cc, used)) { unmark(used, cols, added); return null; }
      var leave = pickOpen(cols, rows, cr, cc, [d, (d + 1) & 3, (d + 3) & 3], used);
      if (leave == null) { unmark(used, cols, added); return null; }
      var pipe = { r: cr, c: cc, arrive: arrive, leave: leave };
      pipes.push(pipe);
      added.push(pipe);
      used[idx(cols, cr, cc)] = 1;
      cr += PM.DY[leave];
      cc += PM.DX[leave];
      arrive = leave;
      d = leave;
    }
    if (!inB(cols, rows, cr, cc) || used[idx(cols, cr, cc)]) {
      unmark(used, cols, added);
      return null;
    }
    used[idx(cols, cr, cc)] = 1;
    return {
      pipes: pipes,
      cistern: { r: cr, c: cc, dir: PM.opp(arrive), role: 'cistern' }
    };
  }

  function addSimpleSpur(layout, spurLen, rng, cols, rows) {
    var order = [];
    for (var i = 1; i < layout.cells.length - 1; i++) {
      if (!layout.cells[i].isTee && !layout.cells[i].isCross) order.push(i);
    }
    rng.shuffle(order);
    for (var n = 0; n < order.length; n++) {
      var cell = layout.cells[order[n]];
      var sides = freeMouths(cell);
      rng.shuffle(sides);
      for (var s = 0; s < sides.length; s++) {
        var spur = growSpur(cols, rows, cell.r, cell.c, sides[s], spurLen, layout.used);
        if (!spur) continue;
        cell.isTee = true;
        cell.spurDir = sides[s];
        layout.spurs.push({ pipes: spur.pipes, cistern: spur.cistern });
        return true;
      }
    }
    return false;
  }

  function bfs(cols, rows, start, goal, used, limit) {
    var q = [{ r: start.r, c: start.c, path: [start] }];
    var seen = {};
    seen[kxy(start.r, start.c)] = 1;
    var guard = cols * rows;
    while (q.length && guard-- > 0) {
      var cur = q.shift();
      if (cur.r === goal.r && cur.c === goal.c) return cur.path;
      if (cur.path.length >= limit) continue;
      for (var d = 0; d < 4; d++) {
        var nr = cur.r + PM.DY[d], nc = cur.c + PM.DX[d];
        if (!cellFree(cols, rows, nr, nc, used) && !(nr === goal.r && nc === goal.c)) continue;
        if (nr === goal.r && nc === goal.c) {
          if (used[idx(cols, nr, nc)] && !(nr === goal.r && nc === goal.c)) continue;
        }
        var kk = kxy(nr, nc);
        if (seen[kk]) continue;
        if (!(nr === goal.r && nc === goal.c) && used[idx(cols, nr, nc)]) continue;
        if (nr === goal.r && nc === goal.c && used[idx(cols, nr, nc)]) continue;
        seen[kk] = 1;
        var next = cur.path.concat([{ r: nr, c: nc }]);
        q.push({ r: nr, c: nc, path: next });
      }
    }
    return null;
  }

  /* O ramal sai da T, atravessa uma reta do corredor e segue até a cisterna. */
  function addCrossSpur(layout, spurLen, rng, cols, rows) {
    var crosses = [];
    var tees = [];
    for (var i = 1; i < layout.cells.length - 1; i++) {
      var cell = layout.cells[i];
      if (cell.isTee || cell.isCross) continue;
      tees.push(cell);
      if (cell.arrive === cell.leave) {
        var perp = (cell.arrive + 1) & 3;
        var a = { r: cell.r + PM.DY[perp], c: cell.c + PM.DX[perp] };
        var b = { r: cell.r + PM.DY[PM.opp(perp)], c: cell.c + PM.DX[PM.opp(perp)] };
        if (!inB(cols, rows, a.r, a.c) || !inB(cols, rows, b.r, b.c)) continue;
        if (layout.used[idx(cols, a.r, a.c)] || layout.used[idx(cols, b.r, b.c)]) continue;
        crosses.push({ cell: cell, a: a, b: b, sideA: perp, sideB: PM.opp(perp) });
      }
    }
    rng.shuffle(crosses);
    rng.shuffle(tees);
    for (var ci = 0; ci < crosses.length; ci++) {
      var cross = crosses[ci];
      for (var ti = 0; ti < tees.length; ti++) {
        var tee = tees[ti];
        if (tee === cross.cell) continue;
        var sides = freeMouths(tee);
        for (var s = 0; s < sides.length; s++) {
          var start = { r: tee.r + PM.DY[sides[s]], c: tee.c + PM.DX[sides[s]] };
          if (!cellFree(cols, rows, start.r, start.c, layout.used)) continue;
          var entries = [
            { entry: cross.a, exit: cross.b, sideA: cross.sideA, sideB: cross.sideB },
            { entry: cross.b, exit: cross.a, sideA: cross.sideB, sideB: cross.sideA }
          ];
          for (var e = 0; e < entries.length; e++) {
            var ent = entries[e];
            if (!cellFree(cols, rows, ent.entry.r, ent.entry.c, layout.used)) continue;
            if (layout.used[idx(cols, ent.exit.r, ent.exit.c)]) continue;
            layout.used[idx(cols, ent.exit.r, ent.exit.c)] = 1;
            var path = bfs(cols, rows, start, ent.entry, layout.used, Math.max(4, spurLen + 2));
            delete layout.used[idx(cols, ent.exit.r, ent.exit.c)];
            if (!path) continue;
            var before = path.length;
            var after = Math.max(0, spurLen - before);
            var pipes = [];
            for (var p = 0; p < path.length; p++) {
              var arrive = p === 0 ? sides[s] : dirOf(path[p - 1], path[p]);
              var leave;
              if (p < path.length - 1) leave = dirOf(path[p], path[p + 1]);
              else leave = dirOf(path[p], cross.cell);
              pipes.push({ r: path[p].r, c: path[p].c, arrive: arrive, leave: leave });
            }
            mark(layout.used, cols, pipes);
            var tail = null;
            var cistern = null;
            if (after === 0) {
              if (!inB(cols, rows, ent.exit.r, ent.exit.c) || layout.used[idx(cols, ent.exit.r, ent.exit.c)]) {
                unmark(layout.used, cols, pipes);
                continue;
              }
              cistern = { r: ent.exit.r, c: ent.exit.c, dir: PM.opp(ent.sideB), role: 'cistern' };
              layout.used[idx(cols, cistern.r, cistern.c)] = 1;
            } else {
              tail = growSpur(cols, rows, cross.cell.r, cross.cell.c, ent.sideB, after, layout.used);
              if (!tail) { unmark(layout.used, cols, pipes); continue; }
              cistern = tail.cistern;
              pipes = pipes.concat(tail.pipes);
            }
            tee.isTee = true;
            tee.spurDir = sides[s];
            cross.cell.isCross = true;
            cross.cell.sideA = ent.sideA;
            cross.cell.sideB = ent.sideB;
            layout.spurs.push({ pipes: pipes, cistern: cistern });
            return true;
          }
        }
      }
    }
    return false;
  }

  function pieceOf(cell) {
    var mask = 0;
    mask |= PM.bit(PM.opp(cell.arrive));
    mask |= PM.bit(cell.leave);
    if (cell.spurDir != null) mask |= PM.bit(cell.spurDir);
    if (cell.isCross) {
      mask |= PM.bit(cell.sideA);
      mask |= PM.bit(cell.sideB);
    }
    var kind = PM.kindOfMask(mask);
    var rot = PM.rotationFor(kind, mask);
    if (rot < 0 || !kind) return null;
    return { r: cell.r, c: cell.c, kind: kind, rot: rot, mask: mask };
  }

  function sinkOf(raw) {
    var mask = PM.bit(raw.dir);
    var rot = PM.rotationFor(PM.KIND.CAP, mask);
    return { r: raw.r, c: raw.c, role: raw.role, mask: mask, rot: rot };
  }

  function compile(layout, levelN) {
    var solution = [];
    var drains = [sinkOf(layout.drain)];
    var i;
    for (i = 0; i < layout.cells.length; i++) {
      var piece = pieceOf(layout.cells[i]);
      if (!piece || !kindAllowed(levelN, piece.kind)) return null;
      solution.push(piece);
    }
    for (i = 0; i < layout.spurs.length; i++) {
      var spur = layout.spurs[i];
      for (var p = 0; p < spur.pipes.length; p++) {
        var sp = pieceOf(spur.pipes[p]);
        if (!sp || !kindAllowed(levelN, sp.kind)) return null;
        solution.push(sp);
      }
      drains.push(sinkOf(spur.cistern));
    }
    return { solution: solution, drains: drains };
  }

  function kindAllowed(levelN, kind) {
    if (kind === PM.KIND.CAP) return false;
    var list = PM.piecesForLevel(levelN);
    for (var i = 0; i < list.length; i++) if (list[i][0] === kind) return true;
    return false;
  }

  function specials(layout, cols) {
    var set = {};
    set[kxy(layout.src.r, layout.src.c)] = 1;
    set[kxy(layout.drain.r, layout.drain.c)] = 1;
    var i, p;
    for (i = 0; i < layout.cells.length; i++) set[kxy(layout.cells[i].r, layout.cells[i].c)] = 1;
    for (i = 0; i < layout.spurs.length; i++) {
      var spur = layout.spurs[i];
      set[kxy(spur.cistern.r, spur.cistern.c)] = 1;
      for (p = 0; p < spur.pipes.length; p++) set[kxy(spur.pipes[p].r, spur.pipes[p].c)] = 1;
    }
    return set;
  }

  function tryBlock(blocked, cols, rows, r, c, spec) {
    if (!inB(cols, rows, r, c)) return false;
    if (spec[kxy(r, c)]) return false;
    var k = idx(cols, r, c);
    if (blocked[k]) return false;
    blocked[k] = 1;
    return true;
  }

  function placeBlocks(layout, cols, rows, budget, rng) {
    var blocked = new Uint8Array(cols * rows);
    var spec = specials(layout, cols);
    var placed = 0;
    var all = layout.cells.slice();
    var i, p;
    for (i = 0; i < layout.spurs.length; i++) all = all.concat(layout.spurs[i].pipes);

    for (i = 0; i < all.length; i++) {
      var cell = all[i];
      if (cell.arrive !== cell.leave && !cell.isCross) {
        if (tryBlock(blocked, cols, rows, cell.r + PM.DY[cell.arrive], cell.c + PM.DX[cell.arrive], spec)) placed++;
      }
      if (cell.isTee) {
        var piece = pieceOf(cell);
        if (!piece) continue;
        for (var d = 0; d < 4; d++) {
          if (piece.mask & PM.bit(d)) continue;
          if (tryBlock(blocked, cols, rows, cell.r + PM.DY[d], cell.c + PM.DX[d], spec)) placed++;
        }
      }
    }

    var guard = budget * 40;
    while (placed < budget && guard-- > 0) {
      var r = rng.int(rows), c = rng.int(cols);
      if (!farEnough(r, c, spec)) continue;
      var cluster = 2 + (rng.chance(0.4) ? 1 : 0);
      var cr = r, cc = c;
      for (var n = 0; n < cluster && placed < budget; n++) {
        if (!farEnough(cr, cc, spec)) break;
        if (tryBlock(blocked, cols, rows, cr, cc, spec)) placed++;
        var dir = rng.int(4);
        cr += PM.DY[dir];
        cc += PM.DX[dir];
      }
    }
    return { blocked: blocked, placed: placed };
  }

  function farEnough(r, c, spec) {
    for (var key in spec) {
      var parts = key.split(',');
      var sr = parseInt(parts[0], 10), sc = parseInt(parts[1], 10);
      if (Math.max(Math.abs(sr - r), Math.abs(sc - c)) < 2) return false;
    }
    return true;
  }

  function buildLayout(rng, cols, rows, cfg) {
    var src = pickSource(rng, cols);
    var layout = routeMain(rng, cols, rows, src, cfg.path, cfg.turns);
    if (!layout || layout.turns < cfg.turns) return null;
    var made = 0;
    if (cfg.cross) {
      if (!addCrossSpur(layout, Math.max(1, cfg.spur), rng, cols, rows)) return null;
      made++;
    }
    while (made < cfg.tees) {
      if (!addSimpleSpur(layout, Math.max(1, cfg.spur), rng, cols, rows)) return null;
      made++;
    }
    return layout;
  }

  function validate(level) {
    var fail = function (m) { return { ok: false, msg: m }; };
    if (!level.start || level.start.r !== 0) return fail('S fora da linha 0');
    if (level.start.mask !== PM.bit(S)) return fail('abertura de S não aponta p/ baixo');
    if (!level.drains || !level.drains.length) return fail('sem destino');
    if (!level.solution || !level.solution.length) return fail('sem solução');

    var cols = level.cols, rows = level.rows;
    var map = {};
    var seen = {};
    function put(r, c, mask, what) {
      if (!inB(cols, rows, r, c)) return what + ' fora';
      var k = kxy(r, c);
      if (seen[k]) return what + ' sobreposto';
      if (level.blocked && level.blocked[idx(cols, r, c)]) return what + ' em bloqueio';
      seen[k] = 1;
      map[k] = mask;
      return null;
    }
    var err = put(level.start.r, level.start.c, level.start.mask, 'fonte');
    if (err) return fail(err);
    var drains = 0, cisterns = 0, tees = 0, crosses = 0;
    var i, d;
    for (i = 0; i < level.drains.length; i++) {
      var sink = level.drains[i];
      err = put(sink.r, sink.c, sink.mask, sink.role || 'ralo');
      if (err) return fail(err);
      if (PM.popcount(sink.mask) !== 1) return fail('destino sem boca única');
      if (sink.role === 'cistern') cisterns++;
      else drains++;
    }
    if (drains !== 1) return fail('ralo ausente');
    for (i = 0; i < level.solution.length; i++) {
      var piece = level.solution[i];
      err = put(piece.r, piece.c, piece.mask, 'canos');
      if (err) return fail(err);
      if (!kindAllowed(level.levelN, piece.kind)) return fail('peça ' + piece.kind + ' fora da fase');
      if (PM.maskOf(piece.kind, piece.rot) !== piece.mask) return fail('rotação da solução');
      if (piece.kind === PM.KIND.TEE) tees++;
      if (piece.kind === PM.KIND.CROSS) crosses++;
    }
    var cfg = level.cfg || {};
    if (cfg.tees != null && tees !== cfg.tees) return fail('T da solução');
    if (cfg.cross != null && crosses !== (cfg.cross ? 1 : 0)) return fail('cruz da solução');
    if (cfg.tees != null && cisterns !== cfg.tees) return fail('cisterna');

    function mouthsOk(r, c, mask) {
      for (var dir = 0; dir < 4; dir++) {
        if (!(mask & PM.bit(dir))) continue;
        var nr = r + PM.DY[dir], nc = c + PM.DX[dir];
        var other = map[kxy(nr, nc)];
        if (!other || !(other & PM.bit(PM.opp(dir)))) return false;
      }
      return true;
    }
    if (!mouthsOk(level.start.r, level.start.c, level.start.mask)) return fail('S desconectado');
    for (i = 0; i < level.solution.length; i++) {
      if (!mouthsOk(level.solution[i].r, level.solution[i].c, level.solution[i].mask)) return fail('canos desconectados');
    }
    for (d = 0; d < level.drains.length; d++) {
      if (!mouthsOk(level.drains[d].r, level.drains[d].c, level.drains[d].mask)) return fail('destino desconectado');
    }
    var er = level.start.r + 1, ec = level.start.c;
    if (level.blocked && level.blocked[idx(cols, er, ec)]) return fail('entrada bloqueada');
    return { ok: true, tees: tees, crosses: crosses, cisterns: cisterns };
  }

  function assemble(styleId, levelN, cfg, layout, blocked) {
    var built = compile(layout, levelN);
    if (!built) return null;
    var start = {
      r: layout.src.r, c: layout.src.c, outDir: S, rot: 2,
      mask: PM.maskOf(PM.KIND.CAP, 2)
    };
    var level = {
      styleId: styleId, levelN: levelN, cols: cfg.cols, rows: cfg.rows, cfg: cfg,
      seed: 0,
      blocked: blocked.blocked, blockCount: blocked.placed,
      start: start,
      drains: built.drains,
      solution: built.solution,
      target: built.drains.length
    };
    var v = validate(level);
    return v.ok ? level : null;
  }

  PM.generateLevel = function (styleId, levelN) {
    var cfg = PM.levelCfg(styleId, levelN);
    var baseSeed = PM.levelSeed(styleId, levelN);

    for (var attempt = 0; attempt < 80; attempt++) {
      var rng = PM.rng(baseSeed + attempt * 7919);
      var layout = buildLayout(rng, cfg.cols, cfg.rows, cfg);
      if (!layout) continue;
      var blocked = placeBlocks(layout, cfg.cols, cfg.rows, cfg.blocks, rng);
      var level = assemble(styleId, levelN, cfg, layout, blocked);
      if (!level) continue;
      level.seed = baseSeed + attempt * 7919;
      return level;
    }
    return makeFallbackLevel(styleId, levelN);
  };

  function makeFallbackLevel(styleId, levelN) {
    var cfg = PM.levelCfg(styleId, levelN);
    var rng = PM.rng(PM.levelSeed(styleId, levelN) ^ 0x9e3779b9);
    for (var attempt = 0; attempt < 40; attempt++) {
      var layout = buildLayout(rng, cfg.cols, cfg.rows, cfg);
      if (!layout) continue;
      var blocked = placeBlocks(layout, cfg.cols, cfg.rows, Math.min(cfg.blocks, 4), rng);
      var level = assemble(styleId, levelN, cfg, layout, blocked);
      if (!level) continue;
      level.seed = PM.levelSeed(styleId, levelN);
      return level;
    }
    var cols = cfg.cols, rows = cfg.rows;
    var blocked = new Uint8Array(cols * rows);
    var src = { r: 0, c: 1, outDir: S, rot: 2 };
    var solution = [];
    var r = 1, c = 1, arrive = S, dir = E;
    for (var i = 0; i < cfg.path; i++) {
      var leave = (i === cfg.path - 1) ? S : (c >= cols - 2 ? S : dir);
      if (i < cfg.path - 1 && c >= cols - 2) { leave = S; dir = W; }
      var mask = PM.bit(PM.opp(arrive)) | PM.bit(leave);
      var kind = PM.kindOfMask(mask);
      solution.push({ r: r, c: c, kind: kind, rot: PM.rotationFor(kind, mask), mask: mask });
      if (i === cfg.path - 1) {
        var drain = sinkOf({ r: r + PM.DY[leave], c: c + PM.DX[leave], dir: PM.opp(leave), role: 'drain' });
        return {
          styleId: styleId, levelN: levelN, cols: cols, rows: rows, cfg: cfg,
          seed: PM.levelSeed(styleId, levelN), blocked: blocked, blockCount: 0,
          start: { r: 0, c: 1, outDir: S, rot: 2, mask: PM.maskOf(PM.KIND.CAP, 2) },
          drains: [drain], solution: solution, target: 1
        };
      }
      r += PM.DY[leave];
      c += PM.DX[leave];
      arrive = leave;
      if (leave === S) dir = dir === E ? W : E;
    }
    return {
      styleId: styleId, levelN: levelN, cols: cols, rows: rows, cfg: cfg,
      seed: PM.levelSeed(styleId, levelN), blocked: blocked, blockCount: 0,
      start: { r: src.r, c: src.c, outDir: S, rot: 2, mask: PM.maskOf(PM.KIND.CAP, 2) },
      drains: [], solution: [], target: 1
    };
  }

  PM.__gen = {
    pickSource: pickSource,
    validate: validate,
    idx: idx,
    inB: inB
  };
})(window.PM);
