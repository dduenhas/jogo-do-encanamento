/* ============================================================
   pieces.js — modelo dos canos: direções, máscaras e rotações
   ============================================================ */
(function (PM) {
  'use strict';

  // Ordem canônica: 0=Norte, 1=Leste, 2=Sul, 3=Oeste
  PM.DIR = { N: 0, E: 1, S: 2, W: 3 };
  PM.DIR_COUNT = 4;
  PM.DX = [0, 1, 0, -1];
  PM.DY = [-1, 0, 1, 0];
  PM.DIR_NAME = ['N', 'E', 'S', 'W'];

  PM.bit = function (d) { return 1 << d; };
  PM.opp = function (d) { return (d + 2) & 3; };

  // marca a célula-fonte do fluido: ele nasce no centro e espira para fora
  PM.SOURCE_ENTRY = -2;

  PM.rotCW = function (m) { return ((m << 1) | (m >> 3)) & 15; };
  PM.rotCCW = function (m) { return ((m >> 1) | (m << 3)) & 15; };

  PM.openings = function (m) {
    var out = [];
    for (var d = 0; d < 4; d++) if (m & (1 << d)) out.push(d);
    return out;
  };

  PM.popcount = function (m) {
    return ((m & 1) ? 1 : 0) + ((m & 2) ? 1 : 0) + ((m & 4) ? 1 : 0) + ((m & 8) ? 1 : 0);
  };

  /* ---------- tipos de peça (idênticos ao jogo original) ---------- */
  //  RETA · CURVA · ENCRUZILHADA · JUNÇÃO T · RESERVATÓRIO   (+ BLOCO obstáculo)
  PM.KIND = {
    CAP: 'cap',           // 1 abertura (usada na célula de origem S)
    STRAIGHT: 'straight', // RETA
    CORNER: 'corner',     // CURVA
    TEE: 'tee',           // JUNÇÃO T
    CROSS: 'cross',       // ENCRUZILHADA
    RESERVOIR: 'reservoir',// RESERVATÓRIO: reta que enche devagar e vale muito
    BLOCK: 'block'        // CRUZ-BLOCO: obstáculo fixo, nunca aceita cano
  };

  PM.KIND_LABEL = {
    cap: 'TAMPA',
    straight: 'RETA',
    corner: 'CURVA',
    tee: 'JUNÇÃO T',
    cross: 'ENCRUZILHADA',
    reservoir: 'RESERVATÓRIO',
    block: 'BLOQUEIO'
  };

  // máscara-base de cada tipo (rotação 0)
  PM.BASE_MASK = {
    cap: 1,             // N
    straight: 5,        // N|S
    corner: 3,          // N|E
    tee: 7,             // N|E|S
    cross: 15,          // N|E|S|W
    reservoir: 5,       // mesma forma da reta, mas enche devagar
    block: 0            // sem abertura
  };

  PM.KIND_ROTATIONS = { cap: 4, straight: 2, corner: 4, tee: 4, cross: 1, reservoir: 2, block: 1 };

  /* Tempo relativo de preenchimento e multiplicador de pontos de cada tipo
     (seções 7 e 10 do projeto: reta curta < reta < reta longa < reservatório).
     Aqui a "reta longa" e o reservatório entram como variantes lentas. */
  PM.FILL_TIME = {
    cap: 0.5, straight: 1, corner: 1, tee: 1.15, cross: 1.25, reservoir: 3
  };
  PM.SCORE_MULT = {
    cap: 1, straight: 1, corner: 1, tee: 1, cross: 1.5, reservoir: 5
  };
  PM.fillTimeOf = function (kind) { return PM.FILL_TIME[kind] || 1; };
  PM.scoreMultOf = function (kind) { return PM.SCORE_MULT[kind] || 1; };

  PM.kindOfMask = function (m) {
    switch (PM.popcount(m)) {
      case 0: return PM.KIND.BLOCK;
      case 1: return PM.KIND.CAP;
      case 2: return (m === 5 || m === 10) ? PM.KIND.STRAIGHT : PM.KIND.CORNER;
      case 3: return PM.KIND.TEE;
      case 4: return PM.KIND.CROSS;
      default: return null;
    }
  };

  /* Rotação (0..3) que transforma a máscara-base de `kind` em `mask`.
     Retorna -1 se nenhum giro produzir `mask`. */
  PM.rotationFor = function (kind, mask) {
    var m = PM.BASE_MASK[kind];
    if (m === undefined) return -1;
    for (var r = 0; r < 4; r++) {
      if (m === mask) return r;
      m = PM.rotCW(m);
    }
    return -1;
  };

  PM.maskOf = function (kind, rot) {
    var m = PM.BASE_MASK[kind];
    for (var i = 0; i < (rot & 3); i++) m = PM.rotCW(m);
    return m;
  };

  /* ---------- fila (deck) de peças ---------- */
  // Tipos sorteados para o jogador durante a partida (S e BLOCO não saem da fila)
  PM.QUEUE_KINDS = [
    PM.KIND.STRAIGHT, PM.KIND.CORNER, PM.KIND.TEE, PM.KIND.CROSS, PM.KIND.RESERVOIR
  ];

  PM.isQueueKind = function (k) { return PM.QUEUE_KINDS.indexOf(k) >= 0; };

  /* Distribuição do sorteio (seção 4.2): retas e curvas são as mais comuns;
     reservatório é raro (peça bônus). */
  PM.NATURAL_WEIGHTS = [
    [PM.KIND.CORNER, 40],
    [PM.KIND.STRAIGHT, 34],
    [PM.KIND.TEE, 15],
    [PM.KIND.CROSS, 6],
    [PM.KIND.RESERVOIR, 5]
  ];

  /* Duas máscaras se conectam quando cada uma tem uma abertura voltada para a outra. */
  PM.connected = function (maskA, dirAtoB, maskB) {
    return !!(maskA & PM.bit(dirAtoB)) && !!(maskB & PM.bit(PM.opp(dirAtoB)));
  };
})(window.PM);
