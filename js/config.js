/* ============================================================
   config.js — estilos (temas visuais), níveis de habilidade,
   tabela das 30 fases e constantes de pontuação
   ============================================================ */
(function (PM) {
  'use strict';

  /* ============================================================
     ESTILOS — cada um com 10 fases, na ordem pedida:
     1) canos de vidro  2) cano de bambu  3) cano futurista
     ============================================================ */
  PM.STYLES = [
    {
      id: 'glass',
      name: 'CANOS DE VIDRO',
      short: 'VIDRO',
      tagline: 'Água corrente e translúcida',
      desc: 'O visual clássico: tubos de vidro com anéis cromados e água azul-esverdeada borbulhando dentro.',
      fluid: 'water',
      seedText: 'pipemania-glass',
      colors: {
        page: '#0e1b2a',
        tileA: '#33506e',
        tileB: '#2a4460',
        tileEdge: '#1b2c3f',
        tileHi: '#4a6d92',
        frame: '#d13b3b',
        pipeBody: 'rgba(196,236,255,0.30)',
        pipeWall: '#cfe9ff',
        pipeShade: '#7fa8c8',
        rim: '#dfe9f2',
        rimDark: '#8c9fb0',
        fluidA: '#0838d4',
        fluidB: '#1ec8ff',
        glow: '#8fd4ff',
        start: '#3ef2a0',
        end: '#ff6b6b',
        spark: '#eaffff'
      },
      pipe: {
        // parâmetros de desenho do tubo de vidro
        wallScale: 0.30,      // espessura da parede relativa ao raio
        bodyScale: 0.34,      // raio interno do canal
        rings: true,          // anéis cromados nas juntas
        ringCount: 2,
        gloss: 0.9,           // brilho especular
        transparent: true
      },
      audio: {
        ambient: 'water',     // ruído de água encanada
        flow: 'water',
        place: 'glass',
        rotate: 'glass',
        leak: 'splash',
        win: 'water-chime'
      }
    },
    {
      id: 'bamboo',
      name: 'CANO DE BAMBU',
      short: 'BAMBU',
      tagline: 'Líquido borbulhante e colorido',
      desc: 'Canaus de bambu amarrados com corda e folhas, conduzindo um líquido espesso cheio de bolhas.',
      fluid: 'bubble',
      seedText: 'pipemania-bamboo',
      colors: {
        page: '#17160f',
        tileA: '#6d5a41',
        tileB: '#4f5b46',
        tileEdge: '#2b2418',
        tileHi: '#8a7355',
        frame: '#7c5a34',
        pipeBody: '#8fbf3f',
        pipeWall: '#d8b25a',
        pipeShade: '#4e7a22',
        rim: '#b98a45',
        rimDark: '#6d4a1f',
        fluidA: '#7fe36b',
        fluidB: '#ffd24a',
        glow: '#c9ff8a',
        start: '#8ef05a',
        end: '#ff8b4a',
        spark: '#eaffd0'
      },
      pipe: {
        wallScale: 0.42,
        bodyScale: 0.32,
        rings: true,          // voltas de corda de sisal
        ringCount: 2,
        gloss: 0.35,
        transparent: false,
        segments: true,       // nós do bambu
        leaves: true
      },
      audio: {
        ambient: 'wood',
        flow: 'bubble',
        place: 'wood',
        rotate: 'wood',
        leak: 'drip',
        win: 'wood-chime'
      }
    },
    {
      id: 'future',
      name: 'CANO FUTURISTA',
      short: 'FUTURO',
      tagline: 'Plasma elétrico neon',
      desc: 'Mangueiras de fibra de carbono com abraçadeiras metálicas e descargas de plasma roxo e laranja.',
      fluid: 'plasma',
      seedText: 'pipemania-future',
      colors: {
        page: '#070a12',
        tileA: '#1a2130',
        tileB: '#141a26',
        tileEdge: '#080b12',
        tileHi: '#2c3648',
        frame: '#12e0ff',
        pipeBody: '#2b3038',
        pipeWall: '#8f9aa8',
        pipeShade: '#12161c',
        rim: '#c3ccd8',
        rimDark: '#4a5462',
        fluidA: '#c45cff',
        fluidB: '#ff8a2b',
        glow: '#e07bff',
        start: '#25e0ff',
        end: '#ff3b5c',
        spark: '#ffffff'
      },
      pipe: {
        wallScale: 0.40,
        bodyScale: 0.30,
        rings: true,          // abraçadeiras metálicas
        ringCount: 2,
        gloss: 0.55,
        transparent: false,
        weave: true,          // textura de fibra de carbono
        neon: true            // filetes de neon nas bordas
      },
      audio: {
        ambient: 'hum',
        flow: 'plasma',
        place: 'metal',
        rotate: 'servo',
        leak: 'zap',
        win: 'power-up'
      }
    }
  ];

  PM.LEVELS_PER_STYLE = 10;

  /* Ritmo extra por estilo: bambu mais lento, futurista mais rápido.
     Não muda o ralo nem o tamanho do caminho. */
  PM.STYLE_PACE = {
    glass: { flow: 1, prep: 1 },
    bamboo: { flow: 1.18, prep: 1.08 },
    future: { flow: 0.85, prep: 0.9 }
  };

  /* Peças que entram na fila conforme a fase. As primeiras só ensinam
     reta e curva; T, cruz e tanque aparecem em degraus. */
  PM.piecesForLevel = function (n) {
    var list = [
      [PM.KIND.CORNER, 46],
      [PM.KIND.STRAIGHT, 40]
    ];
    if (n >= 3) list.push([PM.KIND.TEE, 18]);
    if (n >= 5) list.push([PM.KIND.CROSS, 8]);
    if (n >= 7) list.push([PM.KIND.RESERVOIR, 6]);
    return list;
  };

  PM.KIND_SHORT = {
    cap: 'TAMPA',
    straight: 'RETA',
    corner: 'CURVA',
    tee: 'T',
    cross: 'CRUZ',
    reservoir: 'TANQUE',
    block: 'BLOQUEIO'
  };

  /* Quantas peças ficam visíveis na fila (a da frente é a próxima a ser
     colocada). Clássico: 5. */
  PM.QUEUE_SIZE = 5;

  PM.styleById = function (id) {
    for (var i = 0; i < PM.STYLES.length; i++) if (PM.STYLES[i].id === id) return PM.STYLES[i];
    return PM.STYLES[0];
  };
  PM.styleIndex = function (id) {
    for (var i = 0; i < PM.STYLES.length; i++) if (PM.STYLES[i].id === id) return i;
    return 0;
  };

  /* ============================================================
     HABILIDADE — multiplica o tempo de preparação (cronômetro de
     tolerância) e a velocidade do fluido. Não afeta a fila (que é
     sempre sorteada aleatoriamente, como no original).
     ============================================================ */
  PM.SKILLS = [
    { id: 0, name: 'INICIANTE', prepScale: 1.4, flowScale: 1.35 },
    { id: 1, name: 'INTERMEDIÁRIO', prepScale: 1.0, flowScale: 1.0 },
    { id: 2, name: 'AVANÇADO', prepScale: 0.82, flowScale: 0.82 },
    { id: 3, name: 'MASTER', prepScale: 0.68, flowScale: 0.7 }
  ];

  /* ============================================================
     VELOCIDADE DA ÁGUA (página de administração) — multiplicador
     extra aplicado ao tempo de enchimento de cada célula, por cima
     da habilidade. Maior valor = água mais devagar = mais fácil.
     ============================================================ */
  PM.WATER_SPEEDS = [
    { v: 1.8, name: 'Muito devagar (mais fácil)' },
    { v: 1.3, name: 'Devagar' },
    { v: 1.0, name: 'Normal' },
    { v: 0.75, name: 'Rápida' },
    { v: 0.55, name: 'Muito rápida (mais difícil)' }
  ];
  
  /* ============================================================
     TABELA DE FASES — 10 por estilo, dificuldade crescente.
     Cada fase tem uma fonte S e um ralo. A partir da fase 3 há
     uma cisterna, que só a junção T consegue alimentar. Da fase 5
     o ramal cruza o corredor e a cruz é obrigatória.
     path: casas do corredor principal (sem contar S nem o ralo);
     turns: voltas mínimas desse corredor;
     tees / cross / spur: ramais e travessia;
     blocks: obstáculos além das paredes das curvas;
     prepSec: cronômetro antes de a água começar;
     flowMs: tempo para encher uma célula comum.
     ============================================================ */
  var CURVE = [
    { cols: 8,  rows: 6,  blocks: 3,  path: 6,  turns: 1, tees: 0, cross: 0, spur: 0, prepSec: 28, flowMs: 920 },
    { cols: 9,  rows: 7,  blocks: 5,  path: 9,  turns: 2, tees: 0, cross: 0, spur: 0, prepSec: 26, flowMs: 880 },
    { cols: 9,  rows: 8,  blocks: 6,  path: 8,  turns: 2, tees: 1, cross: 0, spur: 1, prepSec: 26, flowMs: 840 },
    { cols: 10, rows: 8,  blocks: 8,  path: 11, turns: 3, tees: 1, cross: 0, spur: 2, prepSec: 24, flowMs: 800 },
    { cols: 11, rows: 9,  blocks: 9,  path: 10, turns: 3, tees: 1, cross: 1, spur: 2, prepSec: 24, flowMs: 760 },
    { cols: 12, rows: 9,  blocks: 11, path: 13, turns: 3, tees: 1, cross: 1, spur: 2, prepSec: 22, flowMs: 740 },
    { cols: 12, rows: 10, blocks: 12, path: 14, turns: 4, tees: 1, cross: 1, spur: 2, prepSec: 22, flowMs: 720 },
    { cols: 13, rows: 10, blocks: 14, path: 16, turns: 4, tees: 2, cross: 1, spur: 2, prepSec: 20, flowMs: 700 },
    { cols: 14, rows: 10, blocks: 16, path: 18, turns: 4, tees: 2, cross: 1, spur: 2, prepSec: 20, flowMs: 680 },
    { cols: 14, rows: 11, blocks: 18, path: 22, turns: 5, tees: 2, cross: 1, spur: 3, prepSec: 18, flowMs: 660 }
  ];

  function mkLevel(i) {
    var src = CURVE[i];
    return {
      n: i + 1,
      cols: src.cols,
      rows: src.rows,
      blocks: src.blocks,
      path: src.path,
      turns: src.turns,
      tees: src.tees,
      cross: src.cross,
      spur: src.spur,
      prepSec: src.prepSec,
      flowMs: src.flowMs,
      target: 1 + src.tees
    };
  }
  

  PM.LEVELS = {};
  PM.STYLES.forEach(function (st) {
    var arr = [];
    for (var i = 0; i < PM.LEVELS_PER_STYLE; i++) arr.push(mkLevel(i));
    PM.LEVELS[st.id] = arr;
  });

  PM.levelCfg = function (styleId, n) {
    var arr = PM.LEVELS[styleId];
    return arr[PM.clamp(n - 1, 0, arr.length - 1)];
  };

  PM.levelSeed = function (styleId, n) {
    return PM.hashSeed(styleId + ':' + n + ':' + PM.LEVELS[styleId][n - 1].cols + 'x' + PM.LEVELS[styleId][n - 1].rows);
  };

  /* ============================================================
     PONTUAÇÃO (seção 7 do projeto)
     ============================================================ */
  PM.SCORE = {
    flood: 50,           // por célula que o fluido atravessa (base)
    levelBase: 400,      // bônus fixo por fase vencida
    speedBonus: 500,     // liberar a água cedo: proporcional ao tempo que sobrou
    discardPenalty: -15, // descartar a peça da frente
    overwritePenalty: -25,// substituir uma peça já colocada (seca)
    unusedPenalty: -8,   // por peça que sobrar na fila ao vencer
    crossBonus: 150      // água atravessa a MESMA peça (T/cruz) por dois braços
  };


  PM.STARS = {
    two: 0.55,   // fração do bônus de tempo para 2 estrelas
    three: 0.78  // para 3 estrelas
  };

  /* Cadência de animação do fluido dentro dos canos */
  PM.FLOW_ANIM = {
    water: { speed: 1.0, bubbles: 26, wobble: 0.9, trail: 0.55 },
    bubble: { speed: 0.62, bubbles: 16, wobble: 1.5, trail: 0.75 },
    plasma: { speed: 1.6, bubbles: 10, wobble: 0.4, trail: 0.3 }
  };
})(window.PM);
