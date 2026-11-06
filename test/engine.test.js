/* ============================================================
   engine.test.js — regras do motor de COLOCAÇÃO LIVRE
   ------------------------------------------------------------
   Valida (sem navegador): matemática de máscaras/conexão,
   colocação/rotação, vazamento, pontuação com penalidades e, por
   fim, que um jogador perfeito vence as 30 fases montando a
   solução até o ralo (e as cisternas, quando existem).
   Rodar: node test/engine.test.js
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

const sandbox = {
  console, Math, JSON, Date, Uint8Array, Int32Array, Array, Object, String,
  Number, parseInt, performance: { now: () => Date.now() },
  window: {}, document: undefined, localStorage: undefined
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
['utils.js', 'pieces.js', 'config.js', 'levelgen.js', 'game.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), sandbox, { filename: f });
});
const PM = sandbox.window.PM;

/* ---------- stubs de áudio/UI ---------- */
const noop = function () {};
PM.Audio = {
  init: noop, resume: noop, setEnabled: noop, rotate: noop, place: noop,
  skip: noop, flowStep: noop, leak: noop, win: noop, lose: noop, ui: noop,
  startAmbient: noop, stopAmbient: noop
};
let sawWin = false, sawLose = false;
PM.UI = {
  screen: 'game', onWin: function () { sawWin = true; },
  onLose: function () { sawLose = true; },
  toast: noop, syncHud: noop, updateSidebar: noop, closeDialog: noop
};

let fails = 0;
function assert(cond, label) {
  if (!cond) { fails++; console.log('  FALHA: ' + label); } else console.log('  ok: ' + label);
}

/* ============================================================
   1) matemática de máscaras e conexão (seção 10)
   ============================================================ */
console.log('\n[máscaras/conexão]');
assert(PM.BASE_MASK.straight === 5, 'reta rot 0 = N|S (5)');
assert(PM.BASE_MASK.corner === 3, 'curva rot 0 = N|E (3)');
assert(PM.maskOf('straight', 1) === 10, 'reta girada 1x = L|O (10)');
assert(PM.maskOf('cross', 1) === 15, 'cruzamento invariante ao giro (15)');
assert(PM.kindOfMask(15) === 'cross' && PM.kindOfMask(0) === 'block', 'kindOfMask cruz/bloco');
assert(PM.rotationFor('corner', PM.maskOf('corner', 2)) === 2, 'rotationFor inverte maskOf');
assert(PM.connected(5, 2, 5) === true, 'retas N|S conectam na vertical');
assert(PM.fillTimeOf('reservoir') > PM.fillTimeOf('straight'), 'reservatório enche mais devagar');
assert(PM.scoreMultOf('reservoir') === 5 && PM.scoreMultOf('straight') === 1, 'multiplicadores de ponto');

/* ============================================================
   2) colocação livre + fila + substituição
   ============================================================ */
console.log('\n[colocação/fila]');
PM.save = PM.defaultSave();
const G = PM.Game;
G.build('glass', 1);
assert(G.status === 'ready', 'build -> status ready');
assert(G.queue.length === PM.QUEUE_SIZE, 'fila com ' + PM.QUEUE_SIZE + ' peças');
assert(G.cells[G.level.start.r][G.level.start.c].state === 'source', 'fonte = source');

const cell = firstEmpty(G, 1);          // célula livre longe da linha 0
G.start();
assert(G.status === 'prep', 'start() -> preparo');
assert(G.placeAt(cell.r, cell.c) === true && G.cells[cell.r][cell.c].state === 'pipe', 'placeAt coloca cano');

const prevKind = G.cells[cell.r][cell.c].kind;
G.queue[0] = prevKind === PM.KIND.STRAIGHT ? PM.KIND.CORNER : PM.KIND.STRAIGHT;
G.curRot = 0;
const sc0 = G.score;
assert(G.placeAt(cell.r, cell.c) === true, 'substituir coloca a nova peça');
assert(G.cells[cell.r][cell.c].state === 'pipe', 'a casa continua com cano');
assert(G.cells[cell.r][cell.c].kind !== prevKind, 'a peça de baixo foi trocada');
assert(G.score === Math.max(0, sc0 + PM.SCORE.overwritePenalty), 'substituir aplica penalidade');
assert(G.targetMode(cell.r, cell.c) === 'overwrite', 'pode trocar de novo na hora');

/* ============================================================
   3) descarte conta pontos e mantém o tamanho da fila
   ============================================================ */
console.log('\n[descarte]');
G.build('glass', 2); G.start();
const qLen = G.queue.length, scD = G.score;
G.discard();
assert(G.queue.length === qLen, 'descartar repõe a fila');
assert(G.score === Math.max(0, scD + PM.SCORE.discardPenalty), 'descartar penaliza');

/* ============================================================
   4) vazamento: reta pendurada abaixo da fonte -> leaking -> lost
   ============================================================ */
console.log('\n[vazamento]');
G.build('glass', 1);
const src = G.level.start;
G.cells[src.r + 1][src.c].state = 'empty';
G.start();
place(G, src.r + 1, src.c, 'straight', mdir(2, 0));  // entrada N, saída S p/ o nada
G.releaseWater();
let guard = 0;
while ((G.status === 'flow') && guard++ < 4000) G.update(50);
assert(G.status === 'leaking' || G.status === 'lost', 'abertura sem par vaza');
G.update(5000);
assert(G.status === 'lost' && G.lostReason === 'leak', 'vazamento fecha a fase como derrota');

/* ============================================================
   5) um jogador perfeito vence as 30 fases (laço fechado)
   ============================================================ */
console.log('\n[vitória automática nas 30 fases]');
let wins = 0;
for (const st of PM.STYLES) {
  for (let n = 1; n <= PM.LEVELS_PER_STYLE; n++) {
    const r = autoWin(st.id, n);
    if (r === 'won') { wins++; if (sawWin === false) { fails++; console.log('  FALHA ' + st.id + ' ' + n + ' venceu sem disparar onWin'); } }
    else { fails++; console.log('  FALHA ' + st.id + ' ' + n + ' -> ' + r); }
  }
}
console.log('  vitórias: ' + wins + '/30');

console.log('\n' + (fails ? 'FALHAS: ' + fails : 'OK: motor de colocação livre validado.'));
process.exit(fails ? 1 : 0);

/* ============================================================
   helpers
   ============================================================ */
function mdir(a, b) { return PM.bit(a) | PM.bit(b); }

function firstEmpty(G, fromR) {
  for (let r = fromR || 0; r < G.rows; r++)
    for (let c = 0; c < G.cols; c++)
      if (G.cells[r][c].state === 'empty') return { r: r, c: c };
  return null;
}

function place(G, r, c, kind, mask) {
  G.queue[0] = kind;
  G.curRot = PM.rotationFor(kind, mask);
  return G.placeAt(r, c);
}

function isEmpty(G, r, c) {
  if (r < 0 || c < 0 || r >= G.rows || c >= G.cols) return false;
  return G.cells[r][c].state === 'empty';
}

/* monta a solução da fase e solta a água; vence ao alcançar o ralo */
function autoWin(styleId, n) {
  const G = PM.Game;
  sawWin = sawLose = false;
  G.build(styleId, n);
  const src = G.level.start;

  if (!isEmpty(G, src.r + 1, src.c)) return 'entrada-bloqueada';
  if (!G.level.solution || !G.level.solution.length) return 'sem-solucao';
  if (!G.level.drains || !G.level.drains.length) return 'sem-ralo';

  G.start();
  for (const p of G.level.solution) {
    if (!place(G, p.r, p.c, p.kind, p.mask)) return 'place-path';
  }

  G.releaseWater();
  let guard = 0;
  while (G.status === 'flow' || G.status === 'leaking') {
    G.update(60);
    if (++guard > 60000) return 'timeout';
  }
  if (G.status !== 'won') return G.status + ':' + (G.lostReason || '') + (sawLose ? ':lose-callback' : '');
  return G.status + (sawWin ? '' : ':sem-callback');
}
