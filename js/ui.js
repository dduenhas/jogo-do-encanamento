/* ============================================================
   ui.js — telas, HUD, diálogos, tutorial e progresso salvo
   ============================================================ */
(function (PM) {
  'use strict';

  var U = {
    screen: 'menu',
    selectedStyle: 'glass',
    dialogOpen: false,
    dialogKind: null,
    coachLive: false,
    coachStep: 0
  };
  PM.UI = U;

  var hudCache = {};
  var COACH = [
    'Toque na peça da frente para girar. O outro sentido fica no botão ⟲.',
    'Toque na casa logo abaixo do S para começar o cano.',
    'Monte o cano até o R. Solte a água antes do tempo para ganhar pontos — ou espere o cronômetro.'
  ];

  function isPlaying() {
    var s = PM.Game.status;
    return s === 'prep' || s === 'flow';
  }

  function setText(id, text) {
    if (hudCache[id] === text) return;
    hudCache[id] = text;
    var el = PM.$(id);
    if (el) el.textContent = text;
  }

  function prog(styleId) { return PM.save.styles[styleId]; }

  U.isUnlocked = function (styleId, n) {
    var p = prog(styleId);
    return n <= (p.unlocked || 0) + 1;
  };

  U.nextLevel = function (styleId) {
    var p = prog(styleId);
    return Math.min(PM.LEVELS_PER_STYLE, (p.unlocked || 0) + 1);
  };

  U.recordWin = function (styleId, n, stars, score) {
    var p = prog(styleId);
    if (n > (p.unlocked || 0)) p.unlocked = n;
    p.stars[n] = Math.max(p.stars[n] || 0, stars);
    p.score[n] = Math.max(p.score[n] || 0, score);
    if (score > PM.save.best) PM.save.best = score;
    PM.saveSave(PM.save);
  };

  U.applyTheme = function (style) {
    var root = document.documentElement;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!style) {
      ['--bg', '--frame', '--accent', '--accent-2', '--glow'].forEach(function (name) {
        root.style.removeProperty(name);
      });
      if (meta) meta.setAttribute('content', '#10141c');
      delete root.dataset.style;
      return;
    }
    root.style.setProperty('--bg', style.colors.page);
    root.style.setProperty('--frame', style.colors.frame);
    root.style.setProperty('--accent', style.colors.fluidA);
    root.style.setProperty('--accent-2', style.colors.start);
    root.style.setProperty('--glow', style.colors.glow);
    root.dataset.style = style.id;
    if (meta) meta.setAttribute('content', style.colors.page);
    U.syncFlowDock();
  };

  U.cancelWinReveal = function () {
    if (U._winTimer) {
      clearTimeout(U._winTimer);
      U._winTimer = 0;
    }
  };

  /* Espera a água acabar de encher e mais um instante para olhar o tabuleiro. */
  function settleMs(G) {
    var wait = 0;
    if (G.cells) {
      for (var r = 0; r < G.rows; r++) {
        for (var c = 0; c < G.cols; c++) {
          var cell = G.cells[r][c];
          if (!cell || cell.fillStart < 0 || cell.fill >= 1) continue;
          var left = G.flowMs * PM.fillTimeOf(cell.kind) * (1 - cell.fill);
          if (left > wait) wait = left;
        }
      }
    }
    return Math.round(PM.clamp(wait + 1800, 2200, 5200));
  }

  U.showScreen = function (name) {
    U.cancelWinReveal();
    if (PM.Audio.stopFlood) PM.Audio.stopFlood();
    U.screen = name;
    ['menu', 'levels', 'game'].forEach(function (s) {
      var el = PM.$('screen-' + s);
      if (el) el.classList.toggle('active', s === name);
    });
    if (name !== 'game') {
      U.applyTheme(null);
      U.coachLive = false;
      var coach = PM.$('coach');
      if (coach) coach.hidden = true;
      if (PM.Audio && PM.Audio.stopAmbient) PM.Audio.stopAmbient();
    }
    if (name === 'menu') { U.closeDialog(); buildStyleCards(); }
    if (name === 'levels') { U.closeDialog(); buildLevelGrid(); }
  };

  U.refreshMenuActions = function () {
    var st = PM.styleById(U.selectedStyle);
    var n = U.nextLevel(U.selectedStyle);
    var p = prog(U.selectedStyle);
    var done = (p.unlocked || 0) >= PM.LEVELS_PER_STYLE;
    var play = PM.$('btn-play');
    var cont = PM.$('btn-continue');
    if (play) play.textContent = 'JOGAR · ' + st.short + ' · FASE ' + n;
    if (cont) cont.textContent = done ? 'REPETIR FASE ' + n : 'CONTINUAR · FASE ' + n;
    var title = PM.$('levels-title');
    if (title) title.textContent = 'Fases — ' + st.name;
  };

  function buildStyleCards() {
    var host = PM.$('style-list');
    host.innerHTML = '';
    PM.menuPreviews = [];
    PM.STYLES.forEach(function (st) {
      var p = prog(st.id);
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'style-card' + (st.id === U.selectedStyle ? ' selected' : '');
      card.dataset.style = st.id;
      card.innerHTML =
        '<canvas></canvas>' +
        '<h3>' + st.name + '</h3>' +
        '<p>' + st.tagline + '</p>' +
        '<span class="badge">' + (p.unlocked || 0) + '/' + PM.LEVELS_PER_STYLE + '</span>';
      card.addEventListener('click', function () {
        PM.Audio.resume(); PM.Audio.ui(true);
        U.selectedStyle = st.id;
        var cards = host.querySelectorAll('.style-card');
        for (var i = 0; i < cards.length; i++) {
          cards[i].classList.toggle('selected', cards[i].dataset.style === st.id);
        }
        U.refreshMenuActions();
      });
      host.appendChild(card);
      var cv = card.querySelector('canvas');
      PM.menuPreviews.push({ cv: cv, style: st });
      requestAnimationFrame(function () {
        PM.Render.stylePreview(cv, st, performance.now());
      });
    });
    PM.$('menu-best').textContent =
      'Recorde: ' + PM.fmt(PM.save.best) + ' pts   ·   Habilidade: ' + PM.SKILLS[PM.save.skill].name;
    U.refreshMenuActions();
  }

  function buildLevelGrid() {
    var host = PM.$('level-grid');
    host.innerHTML = '';
    var st = PM.styleById(U.selectedStyle);
    var p = prog(st.id);
    for (var n = 1; n <= PM.LEVELS_PER_STYLE; n++) {
      (function (n) {
        var cell = document.createElement('button');
        var unlocked = U.isUnlocked(st.id, n);
        cell.className = 'level-cell' + (p.stars[n] ? ' done' : '') +
          (n === U.nextLevel(st.id) ? ' current' : '');
        cell.innerHTML = unlocked ? n : '🔒';
        if (p.stars[n]) cell.innerHTML += '<span class="star">' + '★'.repeat(p.stars[n]) + '</span>';
        cell.title = unlocked ? 'Fase ' + n : 'Termine a fase anterior';
        cell.addEventListener('click', function () {
          if (!unlocked) { PM.Audio.ui(false); return; }
          PM.Audio.resume(); PM.Audio.ui(true);
          U.startLevel(st.id, n);
        });
        host.appendChild(cell);
      })(n);
    }
  }

  U.startLevel = function (styleId, n) {
    U.cancelWinReveal();
    U.selectedStyle = styleId;
    if (PM.save.skill == null) PM.save.skill = 0;
    hudCache = {};
    U.coachLive = false;
    var coach = PM.$('coach');
    if (coach) coach.hidden = true;
    PM.Game.build(styleId, n);
    U.applyTheme(PM.Game.style);
    U.showScreen('game');
    U.syncHud();
    U.updateSidebar();
    U.showReady();
  };

  U.retryLevel = function () {
    U.startLevel(PM.Game.styleId, PM.Game.levelN);
  };

  U.nextLevelOf = function () {
    var G = PM.Game;
    var n = Math.min(PM.LEVELS_PER_STYLE, G.levelN + 1);
    U.startLevel(G.styleId, n);
  };

  function debutLine(n) {
    if (n === 1) return 'A fila desta fase só traz retas e curvas. O R no mapa é o ralo.';
    if (n === 3) return 'A junção T divide o fluxo: um braço segue ao ralo e o outro enche a cisterna.';
    if (n === 5) return 'A cruz atravessa dois canos. Os quatro braços precisam estar ligados.';
    if (n === 7) return 'O tanque substitui uma reta: enche devagar e vale mais pontos.';
    return '';
  }

  function goalSentence(G) {
    var cisterns = 0;
    var sinks = (G.level && G.level.drains) || [];
    for (var i = 0; i < sinks.length; i++) if (sinks[i].role === 'cistern') cisterns++;
    var s = '<b style="color:' + G.style.colors.start + '">S</b>';
    if (cisterns > 1) return 'Leve a água de ' + s + ' até o ralo e encha as cisternas.';
    if (cisterns === 1) return 'Leve a água de ' + s + ' até o ralo e encha a cisterna.';
    return 'Leve a água de ' + s + ' até o ralo.';
  }

  U.syncHud = function () {
    var G = PM.Game;
    if (!G.style) return;
    setText('hud-level', 'Fase ' + G.levelN + '/' + PM.LEVELS_PER_STYLE);
    setText('hud-score', PM.fmt(G.score));

    var pct = G.drainTotal ? PM.clamp(G.drainsReached / G.drainTotal, 0, 1) : 0;
    var pctKey = pct.toFixed(3);
    if (hudCache.meter !== pctKey) {
      hudCache.meter = pctKey;
      var fill = PM.$('hud-meter-fill');
      if (fill) fill.style.width = (pct * 100) + '%';
    }
    setText('hud-water', (G.drainsReached || 0) + '/' + (G.drainTotal || 0));

    var tEl = PM.$('hud-timer');
    var timerText = '';
    var timerClass = 'hud-readout hud-phase';
    if (G.status === 'prep') {
      timerText = G.manual ? 'Manual' : ('Preparo ' + Math.ceil(G.prepRemaining() / 1000) + 's');
    }
    else if (G.status === 'flow') {
      timerText = 'Fluindo';
    } else if (G.status === 'leaking') {
      timerText = 'Alagando';
      timerClass += ' hud-danger';
    } else if (G.status === 'paused') timerText = 'Pausa';
    else if (G.status === 'ready') timerText = 'Pronto?';
    else if (G.status === 'won') timerText = 'Vitória';
    else if (G.status === 'lost') timerText = 'Derrota';
    if (tEl && hudCache.timer !== timerText + timerClass) {
      hudCache.timer = timerText + timerClass;
      tEl.textContent = timerText;
      tEl.className = timerClass;
    }

    var prep = G.status === 'prep';
    var rel = PM.$('btn-release');
    var st = PM.$('pad-status');
    if (rel) rel.hidden = !prep;
    if (st) {
      var statusLabel = '';
      if (G.status === 'flow') statusLabel = 'Fluindo';
      else if (G.status === 'leaking') statusLabel = 'Alagando';
      else if (G.status === 'paused') statusLabel = 'Pausa';
      else if (G.status === 'won') statusLabel = 'Fase concluída';
      else if (G.status === 'lost') statusLabel = 'Fase perdida';
      st.hidden = !statusLabel;
      if (statusLabel) setText('pad-status', statusLabel);
    }
    if (prep) {
      if (G.manual) setText('release-label', 'SOLTAR ÁGUA');
      else {
        var bonus = Math.round(PM.SCORE.speedBonus * (G.prepRemaining() / Math.max(1, G.prepMs)));
        setText('release-label', 'SOLTAR +' + PM.fmt(bonus));
      }
    }
    U.noteCoach();
  };

  U.updateSidebar = function () {
    var G = PM.Game;
    if (!G.style) return;
    var nameEl = PM.$('piece-name');
    if (nameEl) {
      nameEl.textContent = G.queue.length ? (PM.KIND_SHORT[G.currentKind()] || '') : '';
    }

    var cv = PM.$('cv-current');
    if (cv) {
      if (cv.style.width !== '100%') cv.style.width = '100%';
      if (cv.style.height) cv.style.height = '';
      if (G.queue.length) {
        PM.Render.pieceIcon(cv, G.style, G.currentKind(), G.curRot, { fluid: 0, seed: 21 });
      } else {
        var cw = cv.clientWidth | 0, ch = cv.clientHeight | 0;
        if (cw >= 8 && ch >= 8) {
          PM.bitmapCanvas(cv, cw, ch, 2).ctx.clearRect(0, 0, cw, ch);
        }
      }
    }

    var qcv = PM.$('cv-queue');
    if (!qcv) return;
    if (qcv.style.width !== '100%') qcv.style.width = '100%';
    if (qcv.style.height !== '100%') qcv.style.height = '100%';
    var qw = qcv.clientWidth | 0, qh = qcv.clientHeight | 0;
    if (qw < 8 || qh < 8) return;
    var rect = { width: qw, height: qh };
    var f2 = PM.bitmapCanvas(qcv, qw, qh, 2);
    f2.ctx.clearRect(0, 0, qw, qh);
    var upcoming = G.queue.slice(1);
    var n = upcoming.length;
    if (!n) return;
    var isRow = rect.width > rect.height;
    for (var i = 0; i < n; i++) {
      drawQueueItem(f2.ctx, rect, isRow, i, n, upcoming[i], G.style, i + 1, i === 0);
    }
  };

  function drawQueueItem(ctx, rect, isRow, i, n, kind, style, seed, next) {
    var cell, cx, cy, slot;
    if (isRow) {
      slot = rect.width / Math.max(1, n);
      cell = Math.min(rect.height - 8, slot - 8);
      cx = slot * (i + 0.5);
      cy = rect.height / 2;
    } else {
      slot = rect.height / Math.max(1, n);
      cell = Math.min(rect.width - 8, slot - 8);
      cx = rect.width / 2;
      cy = slot * (i + 0.5);
    }
    if (cell < 6) return;
    ctx.save();
    ctx.fillStyle = next ? 'rgba(62,242,160,0.14)' : 'rgba(12,18,28,0.5)';
    PM.roundRect(ctx, cx - cell / 2 - 2, cy - cell / 2 - 2, cell + 4, cell + 4, 6);
    ctx.fill();
    if (next) {
      ctx.strokeStyle = PM.withAlpha('#3ef2a0', 0.7);
      ctx.lineWidth = 1.5;
      PM.roundRect(ctx, cx - cell / 2 - 2, cy - cell / 2 - 2, cell + 4, cell + 4, 6);
      ctx.stroke();
    }
    ctx.restore();
    PM.Render.queuePiece(ctx, cx, cy, cell, style, kind, seed);
  }

  U.openDialog = function (title, body, actions, kind) {
    kind = kind || 'info';
    if (isPlaying() && (kind === 'pause' || kind === 'help' || kind === 'menu' || kind === 'settings')) {
      PM.Game.pause();
    }
    U.dialogOpen = true;
    U.dialogKind = kind;
    PM.$('dlg-title').innerHTML = title;
    PM.$('dlg-body').innerHTML = body;
    var host = PM.$('dlg-actions');
    host.innerHTML = '';
    (actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn' + (a.primary ? ' btn-primary' : '') + (a.danger ? ' btn-danger' : '');
      b.innerHTML = a.label;
      b.addEventListener('click', function () {
        PM.Audio.resume(); PM.Audio.ui(true);
        if (a.close !== false) U.closeDialog({ silent: !!a.silent });
        if (a.fn) a.fn();
      });
      host.appendChild(b);
    });
    PM.$('overlay').classList.add('show');
  };

  U.closeDialog = function (opts) {
    var wasPlaying = PM.Game.status === 'paused';
    U.dialogOpen = false;
    U.dialogKind = null;
    PM.$('overlay').classList.remove('show');
    if (wasPlaying && !(opts && opts.silent)) PM.Game.resume();
  };

  U.isDialogOpen = function () { return !!PM.$('overlay').classList.contains('show'); };

  U.showReady = function () {
    var G = PM.Game;
    var extra = debutLine(G.levelN);
    U.openDialog(
      'FASE ' + G.levelN + ' — ' + G.style.short,
      '<p class="lead">' + goalSentence(G) + ' Não deixe uma ponta aberta.</p>' +
      (extra ? '<p class="center">' + extra + '</p>' : '') +
      '<p class="center">Toque o registro no tabuleiro, ou aperte R, para soltar a água.</p>' +
      '<p class="muted center">Preparo ' + Math.round(G.prepMs / 1000) +
        ' s · 1★ ao vencer · 2★ se soltar a água cedo · 3★ sem descartar nem substituir</p>',
      [{ label: 'COMEÇAR', primary: true, fn: function () { G.start(); U.maybeCoach(); U.syncHud(); } },
       { label: 'COMO JOGAR', fn: function () { U.showHelp(); } }],
      'ready');
  };

  U.onWin = function (G) {
    U.finishCoach();
    var stars = '';
    for (var i = 0; i < 3; i++) stars += i < G.stars ? '★' : '☆';
    var last = G.levelN >= PM.LEVELS_PER_STYLE;
    var nextStyle = PM.STYLES[PM.styleIndex(G.styleId) + 1];
    U.recordWin(G.styleId, G.levelN, G.stars, G.score);

    var hint = G.stars >= 3
      ? 'Soltou a água cedo, sem descartar nem substituir.'
      : (G.stars === 2
        ? 'Soltou a água com tempo sobrando. Sem descarte nem substituição seriam 3 estrelas.'
        : 'Venceu. Solte a água antes do fim do preparo para ganhar a 2ª estrela.');

    var body =
      '<div class="score-big">' + PM.fmt(G.score) + '</div>' +
      '<div style="text-align:center;font-size:26px;color:#ffcf5c;letter-spacing:6px">' + stars + '</div>' +
      '<p class="muted center">' + hint + '</p>' +
      '<div class="stat-row"><span>Tempo</span><b>' + (G.elapsed / 1000).toFixed(1) + ' s</b></div>' +
      '<div class="stat-row"><span>Destinos</span><b>' + G.drainsReached + ' / ' + G.drainTotal + '</b></div>' +
      '<div class="stat-row"><span>Casas com água</span><b>' + G.flooded + '</b></div>' +
      (G.releasedEarly
        ? '<div class="stat-row"><span>Bônus por soltar cedo</span><b>+' + PM.fmt(G.releaseBonus || 0) + '</b></div>'
        : '') +
      (last && nextStyle
        ? '<p class="center" style="margin-top:10px">Estilo concluído. Próximo: <b>' + nextStyle.name + '</b></p>'
        : (last ? '<p class="center" style="margin-top:10px">Você zerou os três estilos.</p>' : ''));

    var actions = [];
    if (!last) actions.push({ label: 'PRÓXIMA FASE', primary: true, fn: U.nextLevelOf });
    else if (nextStyle) actions.push({
      label: 'IR PARA ' + nextStyle.short, primary: true,
      fn: function () { U.selectedStyle = nextStyle.id; U.startLevel(nextStyle.id, 1); }
    });
    else actions.push({ label: 'MENU', primary: true, fn: function () { U.showScreen('menu'); } });
    actions.push({ label: 'REPETIR', fn: U.retryLevel });
    actions.push({ label: 'FASES', fn: function () { U.showScreen('levels'); } });

    U.cancelWinReveal();
    U._winTimer = setTimeout(function () {
      U._winTimer = 0;
      if (!PM.Game || PM.Game.status !== 'won' || U.screen !== 'game') return;
      U.openDialog('FASE CONCLUÍDA', body, actions, 'win');
    }, settleMs(G));
  };

  U.onLose = function (G, reason) {
    var msg = reason === 'leak'
      ? '<p class="lead">A água achou uma ponta aberta e vazou.</p>'
      : (reason === 'short'
        ? '<p class="lead">A água parou sem chegar a todos os destinos.</p>'
        : '<p class="lead">Fase perdida.</p>');
    U.openDialog(reason === 'leak' ? 'VAZOU' : 'SEM ALCANCE', msg +
      '<div class="stat-row"><span>Destinos</span><b>' + G.drainsReached + ' / ' + G.drainTotal + '</b></div>' +
      '<div class="stat-row"><span>Casas com água</span><b>' + G.flooded + '</b></div>' +
      '<div class="stat-row"><span>Pontos</span><b>' + PM.fmt(G.score) + '</b></div>' +
      '<p class="muted center">Feche cada ponta antes da água chegar. O ponto vermelho mostra a boca em risco.</p>',
      [{ label: 'TENTAR DE NOVO', primary: true, fn: U.retryLevel },
       { label: 'FASES', fn: function () { U.showScreen('levels'); } },
       { label: 'MENU', fn: function () { U.showScreen('menu'); } }], 'lose');
  };

  U.togglePause = function () {
    var G = PM.Game;
    if (U.screen !== 'game') return;
    if (U.dialogOpen && U.dialogKind) { U.closeDialog(); return; }
    if (G.status === 'paused') { U.closeDialog(); return; }
    if (G.status === 'ready') { U.showReady(); return; }
    if (!isPlaying()) return;
    G.pause();
    U.openDialog('PAUSA',
      '<p class="center">' + G.style.name + ' — Fase ' + G.levelN + '</p>' +
      skillRow() + speedRow() + soundRow(),
      [{ label: 'CONTINUAR', primary: true },
       { label: 'COMO JOGAR', close: false, fn: function () { U.showHelp(); } },
       { label: 'AJUSTES', close: false, fn: function () { U.showSettings(); } }],
      'pause');
  };

  var HELP_HTML = '' +
    '<h4>OBJETIVO</h4>' +
    '<p>A água nasce em <b>S</b> e deve chegar ao ralo <b>R</b>. Da fase 3 em diante a cisterna <b>C</b> também precisa encher. Qualquer ponta aberta vaza.</p>' +
    '<h4>COMO JOGAR</h4><ul>' +
    '<li>A peça da frente da fila é a próxima. Toque nela para girar e arraste no tabuleiro para colocar.</li>' +
    '<li>A junção T divide o cano: um braço segue ao ralo e o outro alimenta a cisterna.</li>' +
    '<li>A cruz atravessa dois canos. Os quatro braços têm de estar ligados.</li>' +
    '<li>O tanque entra no lugar de uma reta, enche devagar e vale mais.</li>' +
    '<li>Verde na boca: encaixa no vizinho. Âmbar: aponta para uma casa vazia. Vermelho: bloqueio ou borda.</li>' +
    '<li>No preparo a água ainda não corre. Toque o registro no tabuleiro, ou aperte R, para soltar antes do fim do tempo.</li>' +
    '<li>O medidor à esquerda muda a velocidade da água. Em automático ela sai sozinha no fim do preparo. Em manual só sai quando você aciona o registro.</li>' +
    '<li>Durante o fluxo, o ponto vermelho marca a boca que vai vazar. Coloque um cano ali.</li>' +
    '<li>Colocar outra peça em cima de um cano seco troca na hora e custa 25 pontos. Descartar custa 15.</li>' +
    '</ul>' +
    '<h4>PONTOS E ESTRELAS</h4><ul>' +
    '<li>Cada casa vale pontos. A cruz vale ×1,5 e o tanque ×5, mas o tanque enche devagar.</li>' +
    '<li>A água passar duas vezes pela mesma cruz ou T dá um bônus.</li>' +
    '<li>1 estrela ao vencer, 2 se soltar a água cedo, 3 se também não descartar nem substituir.</li>' +
    '</ul>' +
    '<h4>CONTROLES</h4><ul>' +
    '<li><b>Toque:</b> a peça gira, arrastar coloca, inclusive por cima de um cano seco.</li>' +
    '<li><b>Teclado:</b> <kbd>setas</kbd> ou <kbd>A</kbd><kbd>W</kbd><kbd>S</kbd> movem · ' +
    '<kbd>Q</kbd><kbd>E</kbd> giram · <kbd>Espaço</kbd> coloca · <kbd>D</kbd> descarta · <kbd>R</kbd> solta a água.</li>' +
    '<li><kbd>P</kbd> ou <kbd>Esc</kbd> pausa · <kbd>M</kbd> som.</li>' +
    '</ul>' +
    '<p class="muted">São 10 fases em cada estilo: vidro, bambu e futurista.</p>';

  U.showHelp = function () {
    U.openDialog('COMO JOGAR', HELP_HTML,
      [{ label: 'ENTENDI', primary: true, fn: function () {
        if (PM.Game.status === 'ready') U.showReady();
      } }], 'help');
  };

  function skillRow() {
    var opts = PM.SKILLS.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === PM.save.skill ? ' selected' : '') + '>' + s.name + '</option>';
    }).join('');
    return '<div class="opt-row"><span>Habilidade</span><select id="opt-skill">' + opts + '</select></div>';
  }

  function soundRow() {
    return '<div class="opt-row"><span>Som</span><select id="opt-sound">' +
      '<option value="1"' + (PM.save.sound ? ' selected' : '') + '>LIGADO</option>' +
      '<option value="0"' + (!PM.save.sound ? ' selected' : '') + '>DESLIGADO</option></select></div>';
  }

  function speedRow() {
    var cur = (PM.save.speedScale != null) ? PM.save.speedScale : 1;
    var opts = PM.WATER_SPEEDS.map(function (s) {
      return '<option value="' + s.v + '"' + (Math.abs(s.v - cur) < 1e-6 ? ' selected' : '') + '>' + s.name + '</option>';
    }).join('');
    return '<div class="opt-row"><span>Velocidade da água</span><select id="opt-speed">' + opts + '</select></div>';
  }

  function currentFlowMs() {
    var G = PM.Game;
    if (U.screen === 'game' && G.styleId) {
      return PM.computeFlowMs(PM.levelCfg(G.styleId, G.levelN).flowMs, G.styleId);
    }
    var st = U.selectedStyle || PM.STYLES[0].id;
    return PM.computeFlowMs(PM.levelCfg(st, U.nextLevel(st) || 1).flowMs, st);
  }

  U.showSettings = function () {
    var flowTxt = (currentFlowMs() / 1000).toFixed(2) + ' s / casa';
    U.openDialog('AJUSTES',
      '<p class="muted center">Água mais devagar deixa a fase mais fácil. O som liga e desliga aqui também.</p>' +
      skillRow() + speedRow() + soundRow() +
      '<div class="stat-row"><span>Enchimento da água</span><b id="set-flowms">' + flowTxt + '</b></div>',
      [{ label: 'FECHAR', primary: true }], 'settings');
  };

  U.bindDialogOptions = function () {
    PM.$('dlg-body').addEventListener('change', function (e) {
      if (e.target.id === 'opt-skill') {
        PM.save.skill = parseInt(e.target.value, 10);
        PM.saveSave(PM.save);
        if (U.screen === 'game' && PM.Game.styleId) {
          PM.Game.skill = PM.save.skill;
          PM.Game.build(PM.Game.styleId, PM.Game.levelN);
          U.closeDialog();
          U.showReady();
        }
      }
      if (e.target.id === 'opt-sound') {
        PM.save.sound = e.target.value === '1';
        PM.saveSave(PM.save);
        PM.Audio.setEnabled(PM.save.sound);
        if (PM.save.sound && isPlaying()) PM.Audio.startAmbient(PM.Game.styleId);
        U.updateSoundBtn();
      }
      if (e.target.id === 'opt-speed') {
        PM.save.speedScale = parseFloat(e.target.value);
        PM.saveSave(PM.save);
        var G = PM.Game;
        if (U.screen === 'game' && G.styleId) {
          var cfg = PM.levelCfg(G.styleId, G.levelN);
          G.flowMs = PM.computeFlowMs(cfg.flowMs, G.styleId);
        }
        var lbl = PM.$('set-flowms');
        if (lbl) lbl.textContent = (currentFlowMs() / 1000).toFixed(2) + ' s / casa';
        U.syncFlowDock();
        U.syncHud();
      }
    });
  };

  U.updateSoundBtn = function () {
    var b = PM.$('btn-sound');
    if (b) b.textContent = PM.save.sound ? '🔊' : '🔇';
  };

  U.toggleSound = function () {
    PM.save.sound = !PM.save.sound;
    PM.saveSave(PM.save);
    PM.Audio.setEnabled(PM.save.sound);
    if (PM.save.sound) { PM.Audio.resume(); if (isPlaying()) PM.Audio.startAmbient(PM.Game.styleId); }
    else PM.Audio.stopAmbient();
    U.updateSoundBtn();
  };

  U.primaryAction = function () {
    if (U.dialogOpen && U.dialogKind) {
      var b = PM.$('dlg-actions').querySelector('.btn-primary');
      if (b) { b.click(); return true; }
      return true;
    }
    if (U.screen === 'menu') {
      U.showScreen('levels');
      return true;
    }
    if (U.screen === 'levels') {
      U.startLevel(U.selectedStyle, U.nextLevel(U.selectedStyle));
      return true;
    }
    return false;
  };

  var toastTimer = null;
  U.toast = function (msg, kind) {
    var el = PM.$('board-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'board-toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1400);
  };

  U.flushEvents = function () {
    var G = PM.Game;
    if (!G.events || !G.events.length) return;
    var evs = G.events;
    G.events = [];
    var cross = 0;
    var last = null;
    for (var i = 0; i < evs.length; i++) {
      if (evs[i].t === 'cross') cross++;
      else last = evs[i];
    }
    if (last && last.t === 'discard') U.toast('Peça descartada −15', 'bad');
    else if (last && last.t === 'overwrite') U.toast('Peça trocada −25', 'warn');
    else if (last && last.t === 'release') U.toast('Água solta +' + PM.fmt(last.bonus || 0), 'good');
    else if (cross) U.toast('Cruzamento +' + PM.fmt(PM.SCORE.crossBonus), 'good');
  };

  function showCoach() {
    var el = PM.$('coach');
    var text = PM.$('coach-text');
    var next = PM.$('coach-next');
    if (!el || !text) return;
    text.textContent = COACH[U.coachStep] || '';
    if (next) next.textContent = U.coachStep >= COACH.length - 1 ? 'ENTENDI' : 'PRÓXIMO';
    el.hidden = false;
  }

  U.maybeCoach = function () {
    if (!PM.save || PM.save.seenCoach) return;
    if (!PM.Game || PM.Game.levelN !== 1) return;
    U.coachStep = 0;
    U.coachLive = true;
    showCoach();
  };

  U.advanceCoach = function () {
    if (!U.coachLive) return;
    U.coachStep++;
    if (U.coachStep >= COACH.length) U.finishCoach();
    else showCoach();
  };

  U.finishCoach = function () {
    U.coachLive = false;
    var el = PM.$('coach');
    if (el) el.hidden = true;
    if (PM.save && !PM.save.seenCoach) {
      PM.save.seenCoach = true;
      PM.saveSave(PM.save);
    }
  };

  U.noteCoach = function () {
    var G = PM.Game;
    var rotated = !!G.didRotate;
    var placed = !!G.didPlace;
    G.didRotate = false;
    G.didPlace = false;
    if (!U.coachLive) return;
    if (U.coachStep === 0 && rotated) U.advanceCoach();
    else if (U.coachStep === 1 && placed) U.advanceCoach();
    else if (U.coachStep === 2 && (G.status === 'flow' || G.status === 'leaking' || G.status === 'won' || G.status === 'lost')) {
      U.finishCoach();
    }
  };

  /* 0 = bem devagar, 1 = bem rápida. O 1 do save (normal) cai no meio. */
  var SPEED_SLOW = 2;
  var SPEED_FAST = 0.45;

  function speedT(scale) {
    var t = (scale - SPEED_SLOW) / (SPEED_FAST - SPEED_SLOW);
    return PM.clamp(t, 0, 1);
  }
  function scaleFromT(t) {
    return Math.round((SPEED_SLOW + (SPEED_FAST - SPEED_SLOW) * PM.clamp(t, 0, 1)) * 100) / 100;
  }
  function speedWord(t) {
    if (t < 0.38) return 'Devagar';
    if (t < 0.72) return 'Normal';
    return 'Rápida';
  }

  function applyFlowSpeed(scale) {
    PM.save.speedScale = scale;
    var G = PM.Game;
    if (G && G.styleId && G.levelN && PM.levelCfg) {
      G.flowMs = PM.computeFlowMs(PM.levelCfg(G.styleId, G.levelN).flowMs, G.styleId);
    }
    U.syncFlowDock();
  }

  U.syncFlowDock = function () {
    var scale = (PM.save && PM.save.speedScale != null) ? PM.save.speedScale : 1;
    var t = speedT(scale);
    var fill = PM.$('flow-fill');
    var thumb = PM.$('flow-thumb');
    var read = PM.$('flow-read');
    var slider = PM.$('flow-slider');
    var btn = PM.$('btn-flow-mode');
    var pct = Math.round(t * 100);
    if (fill) fill.style.height = pct + '%';
    if (thumb) thumb.style.bottom = 'calc(' + pct + '% - ' + (pct * 0.2) + 'px)';
    if (read) read.textContent = speedWord(t);
    if (slider) {
      slider.setAttribute('aria-valuenow', String(pct));
      slider.setAttribute('aria-valuetext', speedWord(t));
    }
    if (btn) {
      var manual = PM.save && PM.save.flowMode === 'manual';
      btn.textContent = manual ? 'MANUAL' : 'AUTOMÁTICO';
      btn.classList.toggle('is-manual', !!manual);
      btn.title = manual
        ? 'Manual: a água só sai quando você aciona o registro.'
        : 'Automático: a água sai sozinha no fim do preparo.';
    }
  };

  U.bindFlowDock = function () {
    var slider = PM.$('flow-slider');
    var btn = PM.$('btn-flow-mode');
    if (slider) {
      var drag = false;
      function fromEvent(e) {
        var rect = slider.getBoundingClientRect();
        var t = 1 - (e.clientY - rect.top) / Math.max(1, rect.height);
        applyFlowSpeed(scaleFromT(t));
      }
      slider.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        drag = true;
        try { slider.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
        PM.Audio.resume();
        fromEvent(e);
      });
      slider.addEventListener('pointermove', function (e) {
        if (!drag) return;
        fromEvent(e);
      });
      function endDrag() {
        if (!drag) return;
        drag = false;
        PM.saveSave(PM.save);
      }
      slider.addEventListener('pointerup', endDrag);
      slider.addEventListener('pointercancel', endDrag);
      slider.addEventListener('keydown', function (e) {
        var t = speedT(PM.save.speedScale != null ? PM.save.speedScale : 1);
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') t += 0.08;
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') t -= 0.08;
        else return;
        e.preventDefault();
        e.stopPropagation();
        applyFlowSpeed(scaleFromT(t));
        PM.saveSave(PM.save);
      });
    }
    if (btn) {
      btn.addEventListener('click', function () {
        PM.Audio.resume();
        PM.Audio.ui(true);
        var manual = !(PM.save && PM.save.flowMode === 'manual');
        PM.save.flowMode = manual ? 'manual' : 'auto';
        PM.saveSave(PM.save);
        if (PM.Game && PM.Game.setFlowMode) PM.Game.setFlowMode(manual);
        U.syncFlowDock();
        U.syncHud();
      });
    }
  };

  function fitPedagogy() {
    var board = PM.$('pedagogy-board');
    var wrap = PM.$('pedagogy-scale');
    if (board) {
      board.style.transform = 'none';
      board.style.width = '';
    }
    if (wrap) {
      wrap.style.width = '';
      wrap.style.height = '';
    }
  }

  U.openPedagogy = function () {
    var host = PM.$('pedagogy');
    if (!host) return;
    host.hidden = false;
    host.classList.add('show');
    fitPedagogy();
    var close = PM.$('pedagogy-close');
    if (close) close.focus();
  };

  U.closePedagogy = function () {
    var host = PM.$('pedagogy');
    if (!host) return;
    host.classList.remove('show');
    host.hidden = true;
    var opener = PM.$('btn-pedagogy');
    if (opener) opener.focus();
  };

  U.bindPedagogy = function () {
    var btn = PM.$('btn-pedagogy');
    var host = PM.$('pedagogy');
    var close = PM.$('pedagogy-close');
    if (btn) {
      btn.addEventListener('click', function () {
        PM.Audio.resume();
        PM.Audio.ui(true);
        U.openPedagogy();
      });
    }
    if (close) {
      close.addEventListener('click', function () {
        PM.Audio.ui(true);
        U.closePedagogy();
      });
    }
    if (host) {
      var press = null;
      host.addEventListener('pointerdown', function (e) {
        press = { x: e.clientX, y: e.clientY };
      });
      host.addEventListener('click', function (e) {
        if (e.target !== host) return;
        if (press && (Math.abs(e.clientX - press.x) > 4 || Math.abs(e.clientY - press.y) > 4)) return;
        var sel = window.getSelection();
        if (sel && !sel.isCollapsed) return;
        U.closePedagogy();
      });
    }
    window.addEventListener('resize', fitPedagogy);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var box = PM.$('pedagogy');
      if (!box || box.hidden) return;
      e.preventDefault();
      e.stopPropagation();
      U.closePedagogy();
    });
  };

  U.init = function () {
    PM.save = PM.loadSave();
    if (PM.save.skill == null) PM.save.skill = 0;
    PM.Audio.setEnabled(PM.save.sound);
    U.updateSoundBtn();

    PM.$('btn-play').addEventListener('click', function () {
      PM.Audio.resume(); PM.Audio.ui(true);
      U.refreshMenuActions();
      U.showScreen('levels');
    });
    PM.$('btn-continue').addEventListener('click', function () {
      PM.Audio.resume(); PM.Audio.ui(true);
      U.startLevel(U.selectedStyle, U.nextLevel(U.selectedStyle));
    });
    PM.$('btn-help').addEventListener('click', function () { PM.Audio.resume(); U.showHelp(); });
    PM.$('btn-ruleta').addEventListener('click', function () { PM.Audio.resume(); U.showHelp(); });
    PM.$('btn-sound').addEventListener('click', function () { PM.Audio.resume(); U.toggleSound(); });
    PM.$('btn-settings').addEventListener('click', function () { PM.Audio.resume(); U.showSettings(); });
    U.bindPedagogy();
    U.bindFlowDock();
    U.syncFlowDock();

    PM.$('coach-next').addEventListener('click', function (e) {
      e.stopPropagation();
      PM.Audio.ui(true);
      U.advanceCoach();
    });
    PM.$('coach-skip').addEventListener('click', function (e) {
      e.stopPropagation();
      PM.Audio.ui(true);
      U.finishCoach();
    });

    PM.$('btn-levels-back').addEventListener('click', function () { U.showScreen('menu'); });
    PM.$('btn-levels-reset').addEventListener('click', function () {
      U.openDialog('Zerar progresso?', '<p>Todas as fases, estrelas e o recorde voltam ao início.</p>', [
        { label: 'CONFIRMAR', danger: true, fn: function () { PM.save = PM.defaultSave(); PM.saveSave(PM.save); U.showScreen('menu'); } },
        { label: 'CANCELAR', primary: true }
      ]);
    });

    PM.$('btn-menu').addEventListener('click', function () {
      if (PM.Game.status === 'ready') { U.showReady(); return; }
      U.openDialog('MENU',
        '<p class="center">' + (PM.Game.style ? PM.Game.style.name + ' — Fase ' + PM.Game.levelN : '') + '</p>' +
        skillRow() + speedRow() + soundRow(),
        [{ label: 'VOLTAR AO JOGO', primary: true },
         { label: 'COMO JOGAR', close: false, fn: function () { U.showHelp(); } },
         { label: 'REINICIAR', silent: true, fn: U.retryLevel },
         { label: 'FASES', silent: true, fn: function () { U.showScreen('levels'); } },
         { label: 'MENU PRINCIPAL', silent: true, fn: function () { U.showScreen('menu'); } }], 'menu');
    });
    PM.$('btn-pause').addEventListener('click', function () { U.togglePause(); });

    U.bindDialogOptions();

    var unlock = function () {
      PM.Audio.init();
      PM.Audio.resume();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    U.showScreen('menu');
  };
})(window.PM);
