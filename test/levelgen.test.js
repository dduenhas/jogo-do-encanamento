/* ============================================================
   levelgen.test.js — ralo, solução e peças de cada fase
   ------------------------------------------------------------
   A fonte fica na linha 0 abrindo para baixo. Cada fase tem um
   ralo, uma solução conectada e, a partir da fase 3, a junção T
   alimentando uma cisterna. Da fase 5 a cruz atravessa o corredor.
   Rodar: node test/levelgen.test.js
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const sandbox = {
  window: {}, Math, console, Uint8Array, Int32Array, Array, Object, JSON,
  String, Number, parseInt
};
sandbox.globalThis = sandbox; vm.createContext(sandbox);
for (const f of ['utils.js', 'pieces.js', 'config.js', 'levelgen.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), sandbox, { filename: f });
}
const PM = sandbox.window.PM;

function ascii(level) {
  const { cols, rows, blocked, start, drains, solution } = level;
  const mark = {};
  (solution || []).forEach(function (p) { mark[p.r + ',' + p.c] = p.kind === 'tee' ? 'T' : (p.kind === 'cross' ? 'X' : '+'); });
  (drains || []).forEach(function (d) { mark[d.r + ',' + d.c] = d.role === 'cistern' ? 'C' : 'R'; });
  mark[start.r + ',' + start.c] = 'S';
  const lines = ['   ' + cols + 'x' + rows + '  destinos=' + (drains || []).length + ' blocos=' + level.blockCount + ' canos=' + (solution || []).length];
  for (let r = 0; r < rows; r++) {
    let s = '   ';
    for (let c = 0; c < cols; c++) {
      const k = r + ',' + c;
      if (mark[k]) { s += mark[k]; continue; }
      s += blocked[r * cols + c] ? '#' : '.';
    }
    lines.push(s);
  }
  return lines.join('\n');
}

let bad = 0, slow = 0;
const seen = {};

for (const st of PM.STYLES) {
  for (let n = 1; n <= PM.LEVELS_PER_STYLE; n++) {
    const t0 = Date.now();
    const level = PM.generateLevel(st.id, n);
    const ms = Date.now() - t0;
    if (ms > 1500) slow++;

    const problems = [];
    const cfg = level.cfg;

    if (!cfg || level.cols !== cfg.cols || level.rows !== cfg.rows)
      problems.push('dimensões divergem do cfg');
    if (!level.blocked || level.blocked.length !== level.cols * level.rows)
      problems.push('blocked com tamanho errado');
    if (level.start.r !== 0) problems.push('S fora da linha 0');
    if (level.start.mask !== PM.bit(2)) problems.push('abertura de S não aponta p/ baixo');

    const er = level.start.r + PM.DY[level.start.outDir];
    const ec = level.start.c + PM.DX[level.start.outDir];
    if (level.blocked[er * level.cols + ec]) problems.push('entrada de S bloqueada');

    const v = PM.__gen.validate(level);
    if (!v.ok) problems.push('validate: ' + v.msg);

    const drains = level.drains || [];
    const ralo = drains.filter(function (d) { return d.role !== 'cistern'; });
    const cisterns = drains.filter(function (d) { return d.role === 'cistern'; });
    if (ralo.length !== 1) problems.push('ralo');
    if (ralo.length && ralo[0].r === level.start.r && ralo[0].c === level.start.c)
      problems.push('ralo na fonte');
    if (n >= 3 && cisterns.length < 1) problems.push('sem cisterna');
    if (n < 3 && cisterns.length) problems.push('cisterna cedo');

    const kinds = {};
    (level.solution || []).forEach(function (p) { kinds[p.kind] = (kinds[p.kind] || 0) + 1; });
    if (n >= 3 && !kinds.tee) problems.push('sem T');
    if (n < 3 && kinds.tee) problems.push('T cedo');
    if (n >= 5 && !kinds.cross) problems.push('sem cruz');
    if (n < 5 && kinds.cross) problems.push('cruz cedo');
    if ((level.solution || []).length < cfg.path) problems.push('caminho curto');

    const again = PM.generateLevel(st.id, n);
    const solKey = function (lv) {
      return (lv.solution || []).map(function (p) { return p.r + ',' + p.c + ':' + p.mask; }).join('|') +
        '#' + (lv.drains || []).map(function (d) { return d.r + ',' + d.c + d.role; }).join('|');
    };
    if (again.seed !== level.seed || String(again.blocked) !== String(level.blocked) || solKey(again) !== solKey(level))
      problems.push('não-determinístico');

    if (problems.length) { bad++; console.log('FALHA ' + st.id + ' ' + n + ': ' + problems.join('; ')); }
    console.log(
      st.short + ' F' + String(n).padStart(2) + ' ' + level.cols + 'x' + level.rows +
      '  blocos=' + String(level.blockCount).padStart(2) +
      '  canos=' + String((level.solution || []).length).padStart(2) +
      '  R=' + ralo.length + ' C=' + cisterns.length +
      '  T=' + (kinds.tee || 0) + ' X=' + (kinds.cross || 0) +
      '  ' + String(ms).padStart(4) + 'ms' +
      (problems.length ? '  <<FALHOU' : ''));
    seen[st.id + '-' + n] = level;
  }
}

console.log('\n=== amostras ===');
console.log('VIDRO F1'); console.log(ascii(seen['glass-1']));
console.log('VIDRO F3'); console.log(ascii(seen['glass-3']));
console.log('BAMBU F5'); console.log(ascii(seen['bamboo-5']));
console.log('FUTURO F10'); console.log(ascii(seen['future-10']));

console.log(slow ? '\nlentas(>1.5s): ' + slow : '');
console.log(bad === 0 ? '\nOK: as 30 fases têm ralo, solução e peças da fase.'
  : '\n' + bad + ' fases com problema.');
process.exit(bad === 0 ? 0 : 1);
