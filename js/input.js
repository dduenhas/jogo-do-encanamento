/* ============================================================
   input.js — teclado, mouse e toque
   ------------------------------------------------------------
   * Toque na peça da frente gira. O botão ⟲ gira no outro sentido.
   * Arrastar no tabuleiro mostra a prévia; soltar coloca.
   * Soltar em cima de um cano seco troca a peça na hora.
   * Teclado: setas e A/W/S movem, Q/E giram, Espaço coloca,
     D descarta, R solta a água. O registro desenhado no
     tabuleiro solta a água do mesmo jeito.
   ============================================================ */
(function (PM) {
  'use strict';

  var I = {};
  PM.Input = I;

  var drag = null;

  function dialogOpen() {
    return PM.UI && PM.UI.isDialogOpen && PM.UI.isDialogOpen();
  }

  function refresh() {
    if (!PM.UI) return;
    PM.UI.syncHud();
    PM.UI.updateSidebar();
  }

  function beginPlay() {
    var G = PM.Game;
    if (G.status !== 'ready') return false;
    G.start();
    if (PM.UI && PM.UI.closeDialog) PM.UI.closeDialog();
    if (PM.UI && PM.UI.maybeCoach) PM.UI.maybeCoach();
    refresh();
    return true;
  }

  function placeSmart(r, c) {
    var G = PM.Game;
    if (dialogOpen()) return false;
    if (G.status === 'ready') return beginPlay();
    var mode = G.targetMode(r, c);
    if (mode === 'ok' || mode === 'overwrite') {
      var ok = G.placeAt(r, c);
      refresh();
      return ok;
    }
    PM.Audio.ui(false);
    return false;
  }

  function act(name) {
    if (dialogOpen()) return;
    var G = PM.Game;
    switch (name) {
      case 'cleft': G.moveCursor(0, -1); break;
      case 'cright': G.moveCursor(0, 1); break;
      case 'cup': G.moveCursor(-1, 0); break;
      case 'cdown': G.moveCursor(1, 0); break;
      case 'rotcw': G.rotate(1); break;
      case 'rotccw': G.rotate(-1); break;
      case 'place':
        if (G.cursor) placeSmart(G.cursor.r, G.cursor.c);
        return;
      case 'discard': G.discard(); break;
      case 'release': G.releaseWater(); break;
      case 'start': beginPlay(); return;
      default: return;
    }
    refresh();
  }
  I.act = act;

  var KEYMAP = {
    ArrowLeft: 'cleft', ArrowRight: 'cright', ArrowUp: 'cup', ArrowDown: 'cdown',
    KeyA: 'cleft', KeyW: 'cup', KeyS: 'cdown',
    KeyQ: 'rotccw', KeyE: 'rotcw',
    Space: 'place', Enter: 'place',
    KeyD: 'discard', KeyR: 'release'
  };

  I.bindKeyboard = function () {
    document.addEventListener('keydown', function (e) {
      if (e.target && e.target.id === 'flow-slider') return;
      if (PM.UI.screen !== 'game') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          if (PM.UI.primaryAction()) return;
        }
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        PM.UI.togglePause();
        return;
      }
      if (e.code === 'KeyM') {
        e.preventDefault();
        PM.UI.toggleSound();
        return;
      }
      if (dialogOpen()) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          PM.UI.primaryAction();
        }
        return;
      }
      var a = KEYMAP[e.code];
      if (!a) return;
      e.preventDefault();
      if (PM.Game.status === 'ready' && a === 'place') { beginPlay(); return; }
      act(a);
    }, { passive: false });
  };

  I.bindPad = function () {
    var buttons = document.querySelectorAll('[data-act]');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        act(btn.getAttribute('data-act'));
      });
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
    var piece = PM.$('btn-piece');
    if (piece) {
      piece.addEventListener('click', function () { act('rotcw'); });
    }
  };

  I.bindBoard = function (canvas) {
    var G = PM.Game;

    function point(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function cell(e) {
      if (!PM.geom) return null;
      var p = point(e);
      return G.cellFromPoint(PM.geom, p.x, p.y);
    }
    function onValve(e) {
      if (!PM.Render.hitValve || !PM.geom) return false;
      var p = point(e);
      return PM.Render.hitValve(PM.geom, G, p.x, p.y);
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      if (dialogOpen()) return;
      if (onValve(e)) {
        e.preventDefault();
        PM.Audio.resume();
        G.releaseWater();
        refresh();
        return;
      }
      var p = cell(e);
      if (!p) return;
      e.preventDefault();
      PM.Audio.resume();
      drag = { id: e.pointerId, r: p.r, c: p.c, pointer: e.pointerType };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
      G.hover = p;
    });

    canvas.addEventListener('pointermove', function (e) {
      var over = onValve(e);
      canvas.style.cursor = over ? 'pointer' : '';
      if (over && !(drag && e.pointerId === drag.id)) {
        G.hover = null;
        return;
      }
      if (drag && e.pointerId === drag.id) {
        var p = cell(e);
        if (p && (p.r !== drag.r || p.c !== drag.c)) {
          drag.r = p.r;
          drag.c = p.c;
          G.hover = p;
        }
        return;
      }
      if (e.pointerType === 'mouse') G.hover = cell(e);
    });

    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var pointer = drag.pointer;
      var p = cell(e) || { r: drag.r, c: drag.c };
      drag = null;
      if (pointer !== 'mouse') G.hover = null;
      if (dialogOpen()) return;
      placeSmart(p.r, p.c);
    }

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', function (e) {
      if (!drag && e.pointerType === 'mouse') G.hover = null;
    });

    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (dialogOpen()) return;
      if (G.status === 'ready') { beginPlay(); return; }
      G.rotate(-1);
      if (PM.UI) PM.UI.updateSidebar();
    });
  };
})(window.PM);
