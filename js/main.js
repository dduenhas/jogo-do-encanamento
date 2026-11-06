/* ============================================================
   main.js — inicialização, laço de animação e redimensionamento
   ------------------------------------------------------------
   * mantém PM.geom (geometria do tabuleiro) sempre atualizada;
   * chama Game.update() e Render.board() a cada quadro;
   * redesenha HUD/barra lateral apenas quando algo muda;
   * anima as prévias dos estilos no menu.
   ============================================================ */
(function (PM) {
  'use strict';

  var M = {};
  PM.Main = M;

  var canvas = null;
  var frame = null;          // última geometry publicada
  var seenLevel = null;      // level object da última leitura de layout
  var needLayout = true;
  var lastTs = 0;
  var lastSideKey = '';
  var previews = null;       // prévias animadas do menu
  var previewHost = null;

  /* ----------------------------------------------------------
     layout
     ---------------------------------------------------------- */
  function relayout(force) {
    var G = PM.Game;
    if (PM.UI.screen !== 'game' || !G.style) return null;
    if (!force && !needLayout && seenLevel === G.level && frame) return frame;
    var next = PM.Render.layout(canvas, G);
    if (!next) return frame;
    frame = next;
    PM.geom = frame;
    seenLevel = G.level;
    needLayout = false;
    PM.UI.updateSidebar();
    return frame;
  }
  M.relayout = relayout;

  function markDirty() {
    needLayout = true;
  }

  function observeResize() {
    var host = document.querySelector('.game-shell');
    if (window.ResizeObserver && host) {
      var ro = new ResizeObserver(function () { markDirty(); });
      ro.observe(host);
    }
    window.addEventListener('resize', markDirty);
    window.addEventListener('orientationchange', function () {
      setTimeout(markDirty, 120);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', markDirty);
    }
    // ao trocar de tela o tabuleiro muda de tamanho: refaz tudo
    var showScreen = PM.UI.showScreen;
    PM.UI.showScreen = function (name) {
      showScreen.call(PM.UI, name);
      markDirty();
      if (name === 'menu') previews = null;
    };
  }

  /* ----------------------------------------------------------
     barra lateral / HUD (só quando o conteúdo muda)
     ---------------------------------------------------------- */
  function syncPanels(G) {
    // sidebar só quando a fila/rotação/estado mudam
    var key = G.queue.join(',') + '|' + G.curRot + '|' + G.status;
    if (key !== lastSideKey) {
      lastSideKey = key;
      PM.UI.updateSidebar();
    }
    PM.UI.syncHud();
    if (PM.UI.flushEvents) PM.UI.flushEvents();
  }

  /* ----------------------------------------------------------
     prévias animadas dos cartões de estilo
     ---------------------------------------------------------- */
  function syncPreviews(time) {
    if (!previews || previewHost !== PM.$('style-list')) {
      previewHost = PM.$('style-list');
      previews = PM.menuPreviews || null;
    }
    if (!previews || !previews.length) return;
    for (var i = 0; i < previews.length; i++) {
      var p = previews[i];
      if (!p.cv.isConnected) { previews = null; return; }
      PM.Render.stylePreview(p.cv, p.style, time);
    }
  }

  /* ----------------------------------------------------------
     laço principal
     ---------------------------------------------------------- */
  function tick(ts) {
    requestAnimationFrame(tick);
    var dt = lastTs ? Math.min(64, ts - lastTs) : 16;
    lastTs = ts;

    try {
      if (PM.UI.screen === 'game') {
        var G = PM.Game;
        if (G.style) {
          G.update(dt);
          var geom = relayout(false);
          if (geom) {
            PM.Render.board(geom, G, G.gt);
            syncPanels(G);
          }
        }
      } else {
        syncPreviews(ts);
      }
    } catch (err) {
      if (window.console && console.error) console.error(err);
    }
  }

  /* ----------------------------------------------------------
     inicialização
     ---------------------------------------------------------- */
  function boot() {
    canvas = PM.$('cv-board');

    PM.UI.init();
    PM.Input.bindKeyboard();
    PM.Input.bindPad();
    PM.Input.bindBoard(canvas);
    observeResize();

    // sair de cena pausa a partida (evita vazar com o app em segundo plano)
    document.addEventListener('visibilitychange', function () {
      var s = PM.Game.status;
      if (document.hidden && (s === 'prep' || s === 'flow')) {
        PM.Game.pause();
        PM.UI.openDialog('PAUSA',
          '<p style="text-align:center">' + PM.Game.style.name + ' — Fase ' + PM.Game.levelN + '</p>',
          [{ label: 'CONTINUAR', primary: true }], 'pause');
        PM.UI.toast('Pausado', 'warn');
      }
    });

    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.PM);
