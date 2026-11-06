/* ============================================================
   game.js — motor do jogo (regras do Pipe Mania / Pipe Dream clássico)
   ------------------------------------------------------------
   * O jogador recebe peças uma a uma, vindas de uma FILA de 5.
   * Ele gira a peça da frente e a COLOCA em QUALQUER célula vazia
     do tabuleiro (colocação livre, não é queda por gravidade).
   * A fase abre com um CRONÔMETRO DE TOLERÂNCIA (preparação): a água
     ainda não corre. Quando ele acaba (ou o jogador libera a água
     antes, ganhando bônus), o fluido ("flooz") nasce em S e avança
     célula a célula pelas conexões.
   * O jogador CONTINUA colocando peças durante o fluxo, mas nunca
     sobre uma célula que já tem água.
   * Vazamento (abertura sem par) = derrota: a água alaga o tabuleiro
     em onda e só então a fase fecha. Vitória quando o fluido entra
     em todos os destinos do mapa (ralo e, quando houver, cisternas).
   ============================================================ */
(function (PM) {
  'use strict';

  var SPILL_HOLD_MS = 1000;       // tabuleiro já coberto, antes do modal

  var G = {
    status: 'idle',           // idle|ready|prep|flow|leaking|paused|won|lost
    _prev: null,              // estado antes da pausa
    styleId: 'glass',
    style: null,
    levelN: 1,
    skill: 1,
    level: null,
    cols: 0, rows: 0,
    cells: [],
    queue: [],
    curRot: 0,
    cursor: null,             // {r,c} p/ teclado
    hover: null,              // {r,c} p/ mouse
    score: 0,
    flooded: 0,
    target: 0,
    drainTotal: 0,
    drainsReached: 0,
    gt: 0,                    // tempo de jogo (ms); congela na pausa
    elapsed: 0,               // tempo efetivo de partida
    prepEndsAt: 0,
    flowMs: 700,
    leaks: [],
    spill: null,              // {r,c,t0,stepMs,riseMs} onda que alaga o tabuleiro
    leakEndsAt: 0,
    stars: 0,
    releasedEarly: false,
    lostReason: null,
    events: []                // fila de eventos p/ a UI (feedback)
  };
  PM.Game = G;

  function cellAt(r, c) {
    if (r < 0 || c < 0 || r >= G.rows || c >= G.cols) return null;
    return G.cells[r][c];
  }
  G.cellAt = cellAt;

  /* tempo de enchimento de uma célula comum (ms): parte do cfg.flowMs da
     fase e aplica o multiplicador da habilidade escolhida mais o ajuste
     extra definido na página de administração (PM.save.speedScale). */
  PM.computeFlowMs = function (baseFlowMs, styleId) {
    var skill = PM.SKILLS[PM.save ? PM.save.skill : 0] || PM.SKILLS[0];
    var extra = (PM.save && PM.save.speedScale) || 1;
    var id = styleId || (PM.Game && PM.Game.styleId) || 'glass';
    var pace = (PM.STYLE_PACE && PM.STYLE_PACE[id]) || { flow: 1 };
    return Math.round(baseFlowMs * skill.flowScale * extra * pace.flow);
  };

  /* ----------------------------------------------------------
     montagem da fase
     ---------------------------------------------------------- */
  G.build = function (styleId, levelN) {
    var style = PM.styleById(styleId);
    var level = PM.generateLevel(styleId, levelN);
    var skill = PM.SKILLS[PM.save ? PM.save.skill : 0] || PM.SKILLS[0];

    G.style = style;
    G.styleId = styleId;
    G.levelN = levelN;
    G.skill = PM.save ? PM.save.skill : 0;
    G.level = level;
    G.cols = level.cols;
    G.rows = level.rows;
    G.target = level.target;
    G.cells = [];

    var bl = level.blocked;
    for (var r = 0; r < G.rows; r++) {
      var row = [];
      for (var c = 0; c < G.cols; c++) {
        row.push({
          r: r, c: c,
          state: bl[r * G.cols + c] ? 'blocked' : 'empty',
          kind: null, rot: 0, mask: 0,
          fill: 0, fillStart: -1, fillDir: -1,
          outletsDone: false, visits: 0
        });
      }
      G.cells.push(row);
    }

    // fonte S já fixa no tabuleiro (tampa com 1 abertura para dentro)
    var s = level.start;
    var scell = cellAt(s.r, s.c);
    scell.state = 'source';
    scell.kind = PM.KIND.CAP;
    scell.rot = s.rot;
    scell.mask = s.mask;

    var sinks = level.drains || [];
    for (var di = 0; di < sinks.length; di++) {
      var sink = sinks[di];
      var dcell = cellAt(sink.r, sink.c);
      dcell.state = 'drain';
      dcell.role = sink.role || 'drain';
      dcell.kind = PM.KIND.CAP;
      dcell.rot = sink.rot;
      dcell.mask = sink.mask;
      dcell.reached = false;
    }

    // ritmo: fluido e tolerância, ajustados pela habilidade e pela
    // velocidade extra definida na página de administração (speedScale)
    var pace = (PM.STYLE_PACE && PM.STYLE_PACE[styleId]) || { flow: 1, prep: 1 };
    G.flowMs = PM.computeFlowMs(level.cfg.flowMs, styleId);
    G.prepMs = Math.round(level.cfg.prepSec * 1000 * skill.prepScale * pace.prep);

    resetRuntime();
    G.drainTotal = sinks.length;
    G.drainsReached = 0;
    G.target = sinks.length;
    G.bag = [];
    G.spares = {};
    G.forceKind = null;
    var sol = level.solution || [];
    for (var bi = 0; bi < sol.length; bi++) G.bag.push(sol[bi].kind);
    if (levelN >= 7) G.bag.push(PM.KIND.RESERVOIR);
    shuffleBag(G.bag);
    for (var si = 0; si < sol.length; si++) {
      if (sol[si].kind === PM.KIND.TEE) G.spares[PM.KIND.TEE] = 1;
      if (sol[si].kind === PM.KIND.CROSS) G.spares[PM.KIND.CROSS] = 1;
    }

    G.queue = [];
    for (var qi = 0; qi < PM.QUEUE_SIZE; qi++) G.queue.push(drawKind());
    G.curRot = 0;
    G.status = 'ready';
  };

  function shuffleBag(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function resetRuntime() {
    G.score = 0;
    G.flooded = 0;
    G.gt = 0;
    G.elapsed = 0;
    G.leaks = [];
    G.spill = null;
    G.leakEndsAt = 0;
    if (PM.Audio.stopFlood) PM.Audio.stopFlood();
    G.prepEndsAt = 0;
    G.stars = 0;
    G.releasedEarly = false;
    G.releaseBonus = 0;
    G.discards = 0;
    G.overwrites = 0;
    G.didRotate = false;
    G.didPlace = false;
    G.lostReason = null;
    G.events = [];
    G.cursor = { r: 1, c: Math.floor(G.cols / 2) };
    G.hover = null;
  }

  /* ----------------------------------------------------------
     fila / deck
     ---------------------------------------------------------- */
  function drawKind() {
    if (G.forceKind) {
      var forced = G.forceKind;
      G.forceKind = null;
      return forced;
    }
    if (G.bag && G.bag.length) return G.bag.shift();
    var weights = PM.piecesForLevel ? PM.piecesForLevel(G.levelN) : PM.NATURAL_WEIGHTS;
    var total = 0, i;
    for (i = 0; i < weights.length; i++) total += weights[i][1];
    var r = Math.random() * total;
    for (i = 0; i < weights.length; i++) {
      r -= weights[i][1];
      if (r <= 0) return weights[i][0];
    }
    return weights[0][0];
  }
  function shiftQueue() {
    G.queue.shift();
    G.queue.push(drawKind());
    G.curRot = 0;
  }

  G.currentKind = function () { return G.queue[0]; };
  G.currentMask = function () { return PM.maskOf(G.queue[0], G.curRot); };

  /* gira a peça da frente (antes de colocar) */
  G.rotate = function (dir) {
    if (!isPlayable()) return false;
    var kind = G.queue[0];
    var max = PM.KIND_ROTATIONS[kind] || 1;
    if (max <= 1) { PM.Audio.ui(false); return false; }
    G.curRot = ((G.curRot + dir) % max + max) % max;
    G.didRotate = true;
    PM.Audio.rotate(G.styleId);
    return true;
  };

  /* descarta a peça da frente. T e cruz da solução voltam uma vez. */
  G.discard = function () {
    if (!isPlayable()) return false;
    var discarded = G.queue[0];
    if (G.spares && G.spares[discarded] > 0) {
      G.spares[discarded]--;
      G.forceKind = discarded;
    }
    G.score = Math.max(0, G.score + PM.SCORE.discardPenalty);
    G.discards++;
    shiftQueue();
    PM.Audio.skip(G.styleId);
    G.events.push({ t: 'discard' });
    return true;
  };

  /* ----------------------------------------------------------
     colocação livre numa célula
     ---------------------------------------------------------- */
  function isPlayable() { return G.status === 'prep' || G.status === 'flow'; }

  /* classificação do alvo para o preview: 'ok'|'overwrite'|'no' */
  G.targetMode = function (r, c) {
    var cell = cellAt(r, c);
    if (!cell || !isPlayable()) return 'no';
    if (cell.state === 'empty') return 'ok';
    if (cell.state === 'pipe' && cell.fill <= 0 && cell.fillStart < 0) return 'overwrite';
    return 'no';
  };

  G.placeAt = function (r, c) {
    var cell = cellAt(r, c);
    if (!cell) return false;
    if (!isPlayable()) return false;

    var kind = G.queue[0];
    var mask = PM.maskOf(kind, G.curRot);

    if (cell.state === 'empty') {
      commit(cell, kind, G.curRot, mask);
      shiftQueue();
      PM.Audio.place(G.styleId);
      return true;
    }
    if (cell.state === 'pipe' && cell.fill <= 0 && cell.fillStart < 0) {
      commit(cell, kind, G.curRot, mask);
      G.score = Math.max(0, G.score + PM.SCORE.overwritePenalty);
      G.overwrites++;
      shiftQueue();
      PM.Audio.place(G.styleId);
      G.events.push({ t: 'overwrite' });
      return true;
    }
    PM.Audio.ui(false);
    return false;
  };

  function commit(cell, kind, rot, mask) {
    cell.state = 'pipe';
    cell.kind = kind;
    cell.rot = rot;
    cell.mask = mask;
    cell.fill = 0;
    cell.fillStart = -1;
    cell.fillDir = -1;
    cell.outletsDone = false;
    cell.visits = 0;
    G.cursor = { r: cell.r, c: cell.c };
    G.didPlace = true;
  }

  /* ----------------------------------------------------------
     água: preparo -> fluxo
     ---------------------------------------------------------- */
  function manualFlow() {
    return !!(PM.save && PM.save.flowMode === 'manual');
  }

  G.start = function () {
    if (G.status !== 'ready') return;
    G.status = 'prep';
    G.manual = manualFlow();
    G.prepEndsAt = G.gt + G.prepMs;
    PM.Audio.resume();
    PM.Audio.startAmbient(G.styleId);
  };

  /* Troca o modo no meio do preparo. No manual o cronômetro não solta a água. */
  G.setFlowMode = function (manual) {
    G.manual = !!manual;
    if (G.status === 'prep' && !G.manual && G.gt >= G.prepEndsAt) beginFlow();
  };

  /* libera a água antes do cronômetro (bônus de velocidade proporcional).
     No modo manual não há corrida contra o relógio, então não há bônus. */
  G.releaseWater = function () {
    if (G.status !== 'prep') return false;
    var bonus = 0;
    if (!G.manual) {
      var left = Math.max(0, G.prepEndsAt - G.gt);
      bonus = Math.round(PM.SCORE.speedBonus * (left / Math.max(1, G.prepMs)));
      G.score += bonus;
      G.releasedEarly = true;
      G.releaseBonus = bonus;
    }
    beginFlow();
    PM.Audio.ui(true);
    G.events.push({ t: 'release', bonus: bonus });
    return true;
  };

  function beginFlow() {
    G.status = 'flow';
    if (PM.Audio.startFlow) PM.Audio.startFlow(G.styleId);
    var src = cellAt(G.level.start.r, G.level.start.c);
    floodInto(src, PM.SOURCE_ENTRY);
  }

  function floodInto(cell, fromDir) {
    cell.fillStart = G.gt;
    cell.fillDir = fromDir;
    cell.outletsDone = cell.state === 'drain';
    cell.visits++;
    if (cell.state === 'drain' && !cell.reached) {
      cell.reached = true;
      G.drainsReached++;
    }
    if (cell.state === 'pipe' || cell.state === 'source' || cell.state === 'drain') {
      G.flooded++;
      if (cell.visits >= 2 && (cell.kind === PM.KIND.CROSS || cell.kind === PM.KIND.TEE)) {
        G.score += PM.SCORE.crossBonus;                 // bônus cross-over
        G.events.push({ t: 'cross' });
      } else {
        G.score += Math.round(PM.SCORE.flood * PM.scoreMultOf(cell.kind));
      }
      PM.Audio.flowStep(G.styleId, G.flooded);
      var denom = (G.level.solution && G.level.solution.length) || G.drainTotal || 1;
      if (PM.Audio.setFlowIntensity) PM.Audio.setFlowIntensity(G.flooded / denom);
    }
  }

  /* propaga a partir das células já cheias que ainda não descarregaram */
  function processOutlets() {
    for (var r = 0; r < G.rows; r++) {
      for (var c = 0; c < G.cols; c++) {
        var cell = G.cells[r][c];
        if (cell.fillStart < 0 || cell.fill < 1 || cell.outletsDone) continue;
        cell.outletsDone = true;
        if (cell.state === 'drain') continue;
        for (var d = 0; d < 4; d++) {
          if (!(cell.mask & PM.bit(d))) continue;
          var nb = cellAt(r + PM.DY[d], c + PM.DX[d]);
          if (!nb || nb.state === 'blocked' || nb.state === 'empty' ||
              !(nb.mask & PM.bit(PM.opp(d)))) {
            makeLeak(cell, d);                          // abriu para o nada
            return;
          }
          if (nb.fillStart < 0) floodInto(nb, PM.opp(d));
        }
      }
    }
  }

  /* A onda sai da boca aberta e cobre o tabuleiro inteiro, casa a casa. */
  function beginSpill(cell) {
    var maxD = 0;
    var r, c, dist;
    for (r = 0; r < G.rows; r++) {
      for (c = 0; c < G.cols; c++) {
        dist = Math.abs(r - cell.r) + Math.abs(c - cell.c);
        if (dist > maxD) maxD = dist;
      }
    }
    var stepMs = 58;
    var riseMs = 220;
    var cover = maxD * stepMs + riseMs;
    if (cover < 1200) {
      var scale = 1200 / Math.max(cover, 1);
      stepMs *= scale;
      riseMs *= scale;
      cover = 1200;
    }
    G.spill = { r: cell.r, c: cell.c, t0: G.gt, stepMs: stepMs, riseMs: riseMs };
    G.leakEndsAt = G.gt + cover + SPILL_HOLD_MS;
    if (PM.Audio.floodFail) PM.Audio.floodFail(G.styleId, cover + SPILL_HOLD_MS);
  }

  function makeLeak(cell, d) {
    G.leaks.push({ r: cell.r, c: cell.c, d: d, t: G.gt });
    G.status = 'leaking';
    PM.Audio.stopAmbient();
    PM.Audio.leak(G.styleId);
    beginSpill(cell);
  }

  function advanceFills() {
    for (var r = 0; r < G.rows; r++) {
      for (var c = 0; c < G.cols; c++) {
        var cell = G.cells[r][c];
        if (cell.fillStart < 0) continue;
        var dur = G.flowMs * PM.fillTimeOf(cell.kind);
        cell.fill = PM.clamp((G.gt - cell.fillStart) / dur, 0, 1);
      }
    }
  }

  function pendingWater() {
    for (var r = 0; r < G.rows; r++) {
      for (var c = 0; c < G.cols; c++) {
        var cell = G.cells[r][c];
        if (cell.fillStart >= 0 && (cell.fill < 1 || !cell.outletsDone)) return true;
      }
    }
    return false;
  }

  /* ----------------------------------------------------------
     ações de foco/teclado sobre o cursor
     ---------------------------------------------------------- */
  G.moveCursor = function (dr, dc) {
    if (!G.cursor) G.cursor = { r: 0, c: 0 };
    G.cursor.r = PM.clamp(G.cursor.r + dr, 0, G.rows - 1);
    G.cursor.c = PM.clamp(G.cursor.c + dc, 0, G.cols - 1);
  };
  G.placeCursor = function () {
    if (G.status === 'ready') { G.start(); return true; }
    if (!G.cursor) return false;
    return G.placeAt(G.cursor.r, G.cursor.c);
  };

  /* toque/clique no tabuleiro: coloca na célula informada */
  G.tapBoard = function (geom, x, y) {
    var p = G.cellFromPoint(geom, x, y);
    if (!p) return;
    if (G.status === 'ready') { G.start(); return; }
    G.hover = p;
    G.placeAt(p.r, p.c);
  };

  G.cellFromPoint = function (geom, x, y) {
    var c = Math.floor((x - geom.ox) / geom.cell);
    var r = Math.floor((y - geom.oy) / geom.cell);
    if (r < 0 || c < 0 || r >= G.rows || c >= G.cols) return null;
    return { r: r, c: c };
  };

  /* ----------------------------------------------------------
     fim de fase
     ---------------------------------------------------------- */
  function win() {
    if (G.status === 'won' || G.status === 'lost') return;
    G.status = 'won';
    G.score += PM.SCORE.levelBase + PM.SCORE.unusedPenalty * G.queue.length;
    G.stars = 1;
    if (G.releasedEarly) G.stars = 2;
    if (G.releasedEarly && !G.discards && !G.overwrites) G.stars = 3;
    PM.Audio.stopAmbient();
    PM.Audio.win(G.styleId);
    PM.UI && PM.UI.onWin(G);
  }

  function lose(reason) {
    if (G.status === 'lost' || G.status === 'won') return;
    G.status = 'lost';
    G.lostReason = reason;
    PM.Audio.stopAmbient();
    PM.Audio.lose(G.styleId);
    PM.UI && PM.UI.onLose(G, reason);
  }

  /* ----------------------------------------------------------
     pausa
     ---------------------------------------------------------- */
  G.pause = function () {
    if (G.status === 'prep' || G.status === 'flow') {
      G._prev = G.status;
      G.status = 'paused';
      PM.Audio.stopAmbient();
    }
  };
  G.resume = function () {
    if (G.status === 'paused') {
      var prev = G._prev || 'flow';
      G.status = prev;
      PM.Audio.startAmbient(G.styleId);
      if (prev === 'flow' && PM.Audio.startFlow) PM.Audio.startFlow(G.styleId);
    }
  };

  /* ----------------------------------------------------------
     loop
     ---------------------------------------------------------- */
  G.update = function (dt) {
    if (G.status === 'won') {
      G.gt += dt;
      advanceFills();
      return;
    }
    if (G.status === 'idle' || G.status === 'paused' || G.status === 'lost') return;

    G.gt += dt;
    if (G.status !== 'ready') G.elapsed += dt;

    advanceFills();

    if (G.status === 'prep') {
      if (!G.manual && G.gt >= G.prepEndsAt) beginFlow();
    } else if (G.status === 'flow') {
      processOutlets();
      if (G.status === 'flow' && G.drainTotal > 0 && G.drainsReached >= G.drainTotal) {
        win();
        return;
      }
      if (G.status === 'flow' && !pendingWater()) lose('short');
    } else if (G.status === 'leaking') {
      if (G.gt >= G.leakEndsAt) lose('leak');
    }
  };

  G.prepRemaining = function () {
    return G.status === 'prep' ? Math.max(0, G.prepEndsAt - G.gt) : 0;
  };
  G.reset = function () { G.build(G.styleId, G.levelN); };
})(window.PM);
