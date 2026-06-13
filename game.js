/* ============================================================
   Ski Rush — Descida Radical
   Mistura de Ski Free + Subway Surfers em HTML5 Canvas.
   ============================================================ */
(() => {
  'use strict';

  // ---------- Setup do canvas ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // Área de jogo lógica (retrato). É escalada para caber na tela.
  let W = 480, H = 800, DPR = 1;
  let PXS = 3; // tamanho do "pixel" dos sprites (escala inteira, look 32 bits)

  function resize() {
    const wrapW = window.innerWidth;
    const wrapH = window.innerHeight;
    // Mantém proporção 3:5, limitada à tela disponível.
    const targetRatio = 3 / 5;
    let cw = wrapH * targetRatio;
    let ch = wrapH;
    if (cw > wrapW) { cw = wrapW; ch = wrapW / targetRatio; }
    W = Math.round(cw);
    H = Math.round(ch);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = false; // pixels nítidos (nearest-neighbor)
    PXS = Math.max(2, Math.round(W / 150));
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Elementos da UI ----------
  const ui = {
    hud: document.getElementById('hud'),
    coins: document.getElementById('coins'),
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    powerbar: document.getElementById('powerbar'),
    start: document.getElementById('start-screen'),
    gameover: document.getElementById('gameover-screen'),
    pause: document.getElementById('pause-screen'),
    pauseBtn: document.getElementById('pause-btn'),
    finalScore: document.getElementById('final-score'),
    finalCoins: document.getElementById('final-coins'),
    finalDist: document.getElementById('final-dist'),
    newRecord: document.getElementById('new-record'),
  };

  const BEST_KEY = 'skirush_best';
  let best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  ui.best.textContent = best;

  // ---------- Estado do jogo ----------
  let state = 'menu'; // menu | playing | paused | gameover
  let last = 0;

  const game = {
    distance: 0,      // metros descidos
    score: 0,
    coins: 0,
    speed: 0,         // velocidade de rolagem (px/s)
    baseSpeed: 230,
    spawnTimer: 0,
    coinTimer: 0,
    powerTimer: 0,
    shakeTime: 0,
    flashTime: 0,
  };

  const skier = {
    x: W / 2,
    y: 0,
    targetX: W / 2,
    vx: 0,
    lean: 0,          // inclinação visual [-1, 1]
    radius: 16,
  };

  // Power-ups ativos: nome -> tempo restante (s)
  const power = { magnet: 0, ghost: 0, boost: 0, shield: 0 };

  let obstacles = [];
  let coins = [];
  let powerups = [];
  let particles = [];
  let trails = [];

  const POWER_DEFS = {
    magnet: { color: '#ffcf3f', icon: '🧲', label: 'Ímã',     dur: 8 },
    ghost:  { color: '#b69bff', icon: '👻', label: 'Fantasma', dur: 6 },
    boost:  { color: '#ff7a59', icon: '🔥', label: 'Turbo',    dur: 5 },
    shield: { color: '#4fe3c2', icon: '🛡️', label: 'Escudo',   dur: 12 },
  };

  /* ============================================================
     SISTEMA DE SPRITES PIXEL ART (estilo 32 bits)
     Cada sprite é uma matriz de caracteres -> cor da paleta.
     É pré-rasterizado num canvas em tamanho nativo (1px = 1px)
     e depois desenhado com escala inteira e suavização desligada,
     mantendo o visual chunky/retro inclusive ao girar.
     ============================================================ */
  const PAL = {
    '.': null,
    K: '#1a2238', // contorno escuro
    // esquiador
    R: '#e23b50', W: '#ffffff', S: '#ffd2a6',
    B: '#2e6df0', b: '#1b46a6', g: '#8a93a6', r: '#ff5a5a',
    // pinheiro
    G: '#2f8f4e', E: '#236b3c', T: '#7a5230', t: '#5e3f24',
    // pedra
    O: '#8b95a3', o: '#aab4c2', q: '#646d7c',
    // toco
    U: '#6b4423', u: '#9c7b4f',
    // boneco de neve
    n: '#f2f9ff', N: '#ff8c2b',
    // moeda
    Y: '#ffcf3f', y: '#ffe89a', a: '#d99a1e',
    // neve
    s: '#e3f1ff',
  };

  function makeSprite(rows, pal) {
    const w = rows[0].length, h = rows.length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const col = pal[rows[y][x]];
        if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
      }
    }
    return c;
  }

  const SPR = {
    skier: makeSprite([
      '...RRRRR...',
      '..RRRRRRR..',
      '..RWWWWWR..',
      '..SSSSSSS..',
      '..SKSSKSS..',
      '...SSSSS...',
      '...bBBBb...',
      '..BBBBBBB..',
      '.gBBBBBBBg.',
      '.gBBBBBBBg.',
      '.g.BBBBB.g.',
      '..bBBBBBb..',
      '..B.....B..',
      '.rr.....rr.',
      '.rr.....rr.',
      'rr.......rr',
    ], PAL),
    tree: makeSprite([
      '......G......',
      '.....GGG.....',
      '....GGGGG....',
      '...GGsGGGG...',
      '.....GGG.....',
      '....GGGGG....',
      '...GGGGGGG...',
      '..GGGsGGsGG..',
      '....GGGGG....',
      '...GGGGGGG...',
      '..GGGGGGGGG..',
      '.GGsGGGGGsGG.',
      '.....TtT.....',
      '.....TTT.....',
      '.....TtT.....',
      '....sTTTs....',
    ], PAL),
    rock: makeSprite([
      '.....ooo.....',
      '...oOOOOOq...',
      '..oOOOOOOOq..',
      '.oOOOOOOOOOq.',
      '.OOOOOOOOOOO.',
      '.qOOOOOOOOOq.',
      '..qOOOOOOOq..',
      '...qqOOOqq...',
      '.....qqq.....',
    ], PAL),
    stump: makeSprite([
      '...uuuuu...',
      '..uUUUUUu..',
      '..uUuUuUu..',
      '..UUUUUUU..',
      '..UUUUUUU..',
      '..UUUUUUU..',
      '...UUUUU...',
      '..ssUUUss..',
      '...sssss...',
    ], PAL),
    snowman: makeSprite([
      '....nnn....',
      '...nnnnn...',
      '...nKnKn...',
      '...nnNnn...',
      '...nnnnn...',
      '....nnn....',
      '..nnnnnnn..',
      '.nnnnnnnnn.',
      '.nnnKnnnnn.',
      '.nnnnnnnnn.',
      '.nnnnnnnnn.',
      '..nnnnnnn..',
      '...nnnnn...',
      '..sssssss..',
      '...sssss...',
    ], PAL),
    coin: makeSprite([
      '.YYYYY.',
      'YYyyyYY',
      'YyaYayY',
      'YyaaayY',
      'YyaYayY',
      'YYyyyYY',
      '.YYYYY.',
    ], PAL),
  };

  // --- Gems de power-up: diamante colorido + símbolo branco ---
  const DIAMOND = [
    '.....X.....',
    '....XXX....',
    '...XXXXX...',
    '..XXXXXXX..',
    '.XXXXXXXXX.',
    'XXXXXXXXXXX',
    '.XXXXXXXXX.',
    '..XXXXXXX..',
    '...XXXXX...',
    '....XXX....',
    '.....X.....',
  ];
  function lighten(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.min(255, Math.round(r * f));
    g = Math.min(255, Math.round(g * f));
    b = Math.min(255, Math.round(b * f));
    return `rgb(${r},${g},${b})`;
  }
  function makeGem(main, glyph) {
    const c = document.createElement('canvas');
    c.width = 11; c.height = 11;
    const g = c.getContext('2d');
    const lite = lighten(main, 1.3);
    const dark = lighten(main, 0.7);
    for (let y = 0; y < 11; y++) {
      for (let x = 0; x < 11; x++) {
        if (DIAMOND[y][x] !== 'X') continue;
        g.fillStyle = (x + y < 9) ? lite : (x + y > 12 ? dark : main);
        g.fillRect(x, y, 1, 1);
      }
    }
    g.fillStyle = '#ffffff';
    for (const [gx, gy] of glyph) g.fillRect(gx, gy, 1, 1);
    return c;
  }
  // Símbolos (brancos) centralizados na região do diamante.
  const GLYPHS = {
    magnet: [[3,3],[3,4],[3,5],[3,6],[7,3],[7,4],[7,5],[7,6],[4,7],[5,7],[6,7]],
    ghost:  [[4,3],[5,3],[6,3],[3,4],[4,4],[5,4],[6,4],[7,4],[3,5],[4,5],[5,5],[6,5],[7,5],[3,6],[5,6],[7,6]],
    boost:  [[5,3],[4,4],[5,4],[6,4],[3,5],[4,5],[5,5],[6,5],[7,5],[5,6],[5,7]],
    shield: [[5,3],[5,4],[3,5],[4,5],[5,5],[6,5],[7,5],[5,6],[5,7]],
  };
  for (const name in POWER_DEFS) {
    POWER_DEFS[name].spr = makeGem(POWER_DEFS[name].color, GLYPHS[name]);
  }

  // Desenha um sprite centralizado em (cx, cy) com escala inteira.
  function blit(spr, cx, cy, scale, o) {
    o = o || {};
    const xs = o.xscale != null ? o.xscale : 1;
    const w = spr.width * scale * xs, h = spr.height * scale;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    ctx.translate(cx, cy);
    if (o.rot) ctx.rotate(o.rot);
    ctx.drawImage(spr, Math.round(-w / 2), Math.round(-h / 2), w, h);
    ctx.restore();
  }

  // ---------- Entrada do jogador ----------
  const keys = { left: false, right: false };
  let pointerActive = false;
  let pointerX = null;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === ' ' && state === 'menu') startGame();
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
      if (state === 'playing') pauseGame();
      else if (state === 'paused') resumeGame();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });

  function canvasX(clientX) {
    const r = canvas.getBoundingClientRect();
    return (clientX - r.left) * (W / r.width);
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'playing') return;
    pointerActive = true;
    pointerX = canvasX(e.clientX);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointerActive) return;
    pointerX = canvasX(e.clientX);
  });
  const endPointer = () => { pointerActive = false; pointerX = null; };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', endPointer);

  // ---------- Botões ----------
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', startGame);
  document.getElementById('resume-btn').addEventListener('click', resumeGame);
  document.getElementById('quit-btn').addEventListener('click', toMenu);
  ui.pauseBtn.addEventListener('click', pauseGame);

  // ---------- Controle de telas ----------
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function startGame() {
    obstacles = []; coins = []; powerups = []; particles = []; trails = [];
    game.distance = 0; game.score = 0; game.coins = 0;
    game.speed = game.baseSpeed;
    game.spawnTimer = 0; game.coinTimer = 0; game.powerTimer = 12;
    game.shakeTime = 0; game.flashTime = 0;
    skier.x = W / 2; skier.targetX = W / 2; skier.vx = 0; skier.lean = 0;
    skier.y = H * 0.30;
    for (const k in power) power[k] = 0;

    state = 'playing';
    hide(ui.start); hide(ui.gameover); hide(ui.pause);
    show(ui.hud); show(ui.powerbar);
    ui.pauseBtn.style.display = 'flex';
    updateHUD();
    last = performance.now();
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    show(ui.pause);
  }
  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    hide(ui.pause);
    last = performance.now();
  }
  function toMenu() {
    state = 'menu';
    hide(ui.pause); hide(ui.gameover);
    hide(ui.hud); hide(ui.powerbar);
    ui.pauseBtn.style.display = 'none';
    show(ui.start);
  }

  function gameOver() {
    state = 'gameover';
    ui.pauseBtn.style.display = 'none';
    hide(ui.powerbar);
    const sc = Math.floor(game.score);
    ui.finalScore.textContent = sc;
    ui.finalCoins.textContent = game.coins;
    ui.finalDist.textContent = Math.floor(game.distance) + ' m';
    if (sc > best) {
      best = sc;
      localStorage.setItem(BEST_KEY, String(best));
      ui.best.textContent = best;
      show(ui.newRecord);
    } else {
      hide(ui.newRecord);
    }
    show(ui.gameover);
  }

  // ---------- Geração de entidades ----------
  const OBSTACLE_TYPES = ['tree', 'rock', 'snowman', 'tree', 'stump'];

  function spawnObstacle() {
    const type = OBSTACLE_TYPES[(Math.random() * OBSTACLE_TYPES.length) | 0];
    const r = type === 'rock' ? 16 : type === 'stump' ? 14 : 20;
    obstacles.push({
      x: 30 + Math.random() * (W - 60),
      y: H + 40,
      type,
      r,
      hit: false,
    });
  }

  function spawnCoinCluster() {
    // Linha ou arco de moedas.
    const n = 3 + ((Math.random() * 4) | 0);
    const startX = 40 + Math.random() * (W - 80);
    const arc = Math.random() < 0.5;
    const dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      let cx = startX + dir * i * 26;
      cx = Math.max(24, Math.min(W - 24, cx));
      const cy = H + 40 + i * 30;
      const oy = arc ? -Math.sin((i / (n - 1)) * Math.PI) * 30 : 0;
      coins.push({ x: cx, y: cy + oy, r: 11, taken: false, pulse: Math.random() * 6.28 });
    }
  }

  function spawnPowerup() {
    const names = Object.keys(POWER_DEFS);
    const name = names[(Math.random() * names.length) | 0];
    powerups.push({
      x: 40 + Math.random() * (W - 80),
      y: H + 40,
      r: 18,
      name,
      pulse: 0,
    });
  }

  // ---------- Partículas ----------
  function burst(x, y, color, count, spd) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spd * (0.4 + Math.random() * 0.8);
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 1, decay: 1.6 + Math.random(),
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  // ---------- Atualização ----------
  function update(dt) {
    // Velocidade aumenta com a distância (e com o turbo).
    const ramp = Math.min(game.distance / 1800, 1);
    let speed = game.baseSpeed + ramp * 240;
    if (power.boost > 0) speed *= 1.55;
    game.speed = speed;

    const move = speed * dt;
    game.distance += move * 0.06;

    // Pontuação por distância (turbo dá bônus).
    game.score += move * 0.05 * (power.boost > 0 ? 2 : 1);

    // ---- Movimento do esquiador ----
    const accel = 1400;
    const maxV = 360;
    if (pointerActive && pointerX != null) {
      skier.targetX = pointerX;
      const diff = skier.targetX - skier.x;
      skier.vx = Math.max(-maxV, Math.min(maxV, diff * 9));
    } else {
      let dir = 0;
      if (keys.left) dir -= 1;
      if (keys.right) dir += 1;
      if (dir !== 0) {
        skier.vx += dir * accel * dt;
        skier.vx = Math.max(-maxV, Math.min(maxV, skier.vx));
      } else {
        skier.vx *= Math.pow(0.0009, dt); // fricção
      }
    }
    skier.x += skier.vx * dt;

    // Limites laterais.
    const margin = skier.radius + 4;
    if (skier.x < margin) { skier.x = margin; skier.vx = 0; }
    if (skier.x > W - margin) { skier.x = W - margin; skier.vx = 0; }

    // Inclinação visual suave.
    const targetLean = Math.max(-1, Math.min(1, skier.vx / maxV));
    skier.lean += (targetLean - skier.lean) * Math.min(1, dt * 10);

    // Rastro na neve.
    trails.push({ x: skier.x, y: skier.y + 14, life: 1 });
    if (trails.length > 60) trails.shift();
    for (const t of trails) t.life -= dt * 0.7;
    trails = trails.filter(t => t.life > 0);

    // ---- Spawns ----
    game.spawnTimer -= dt;
    const spawnInterval = Math.max(0.28, 0.85 - ramp * 0.5);
    if (game.spawnTimer <= 0) {
      game.spawnTimer = spawnInterval * (0.7 + Math.random() * 0.6);
      spawnObstacle();
    }
    game.coinTimer -= dt;
    if (game.coinTimer <= 0) {
      game.coinTimer = 1.6 + Math.random() * 1.8;
      spawnCoinCluster();
    }
    game.powerTimer -= dt;
    if (game.powerTimer <= 0) {
      game.powerTimer = 10 + Math.random() * 9;
      spawnPowerup();
    }

    // ---- Move entidades para cima ----
    for (const o of obstacles) o.y -= move;
    for (const c of coins) c.y -= move;
    for (const p of powerups) { p.y -= move; p.pulse += dt * 5; }

    // ---- Ímã: atrai moedas próximas ----
    if (power.magnet > 0) {
      for (const c of coins) {
        if (c.taken) continue;
        const dx = skier.x - c.x, dy = skier.y - c.y;
        const d = Math.hypot(dx, dy);
        if (d < 220 && d > 0.1) {
          const pull = (1 - d / 220) * 620 * dt;
          c.x += (dx / d) * pull;
          c.y += (dy / d) * pull;
        }
      }
    }

    // ---- Colisões: moedas ----
    for (const c of coins) {
      if (c.taken) continue;
      c.pulse += dt * 6;
      const d = Math.hypot(skier.x - c.x, skier.y - c.y);
      if (d < skier.radius + c.r) {
        c.taken = true;
        game.coins++;
        game.score += 10 * (power.boost > 0 ? 2 : 1);
        burst(c.x, c.y, '#ffcf3f', 8, 120);
      }
    }

    // ---- Colisões: power-ups ----
    for (const p of powerups) {
      if (p.taken) continue;
      const d = Math.hypot(skier.x - p.x, skier.y - p.y);
      if (d < skier.radius + p.r) {
        p.taken = true;
        const def = POWER_DEFS[p.name];
        power[p.name] = def.dur;
        burst(p.x, p.y, def.color, 18, 180);
        game.flashTime = 0.25;
      }
    }

    // ---- Colisões: obstáculos ----
    for (const o of obstacles) {
      if (o.hit) continue;
      const d = Math.hypot(skier.x - o.x, skier.y - o.y);
      if (d < skier.radius + o.r * 0.7) {
        if (power.ghost > 0) {
          // atravessa
        } else if (power.shield > 0) {
          power.shield = 0;
          o.hit = true;
          game.shakeTime = 0.4;
          burst(o.x, o.y, '#4fe3c2', 22, 200);
        } else {
          o.hit = true;
          game.shakeTime = 0.5;
          burst(skier.x, skier.y, '#ffffff', 26, 220);
          burst(skier.x, skier.y, '#9fb4d8', 14, 160);
          gameOver();
          return;
        }
      }
    }

    // ---- Limpeza ----
    obstacles = obstacles.filter(o => o.y > -60);
    coins = coins.filter(c => c.y > -40 && !c.taken);
    powerups = powerups.filter(p => p.y > -40 && !p.taken);

    // ---- Partículas ----
    for (const pt of particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 200 * dt;
      pt.life -= pt.decay * dt;
    }
    particles = particles.filter(pt => pt.life > 0);

    // ---- Timers de power-up ----
    for (const k in power) if (power[k] > 0) power[k] = Math.max(0, power[k] - dt);

    if (game.shakeTime > 0) game.shakeTime -= dt;
    if (game.flashTime > 0) game.flashTime -= dt;

    updateHUD();
    updatePowerbar();
  }

  // ---------- HUD ----------
  function updateHUD() {
    ui.coins.textContent = game.coins;
    ui.score.textContent = Math.floor(game.score);
  }

  let powerbarCache = '';
  function updatePowerbar() {
    let html = '';
    for (const k in POWER_DEFS) {
      if (power[k] > 0) {
        const def = POWER_DEFS[k];
        html += `<div class="power-chip" style="background:${def.color}cc">`
              + `<span>${def.icon} ${def.label}</span>`
              + `<span class="timer">${power[k].toFixed(1)}s</span></div>`;
      }
    }
    if (html !== powerbarCache) {
      ui.powerbar.innerHTML = html;
      powerbarCache = html;
    } else {
      // Atualiza só os timers sem recriar (mantém animação).
      const chips = ui.powerbar.querySelectorAll('.power-chip .timer');
      let i = 0;
      for (const k in POWER_DEFS) {
        if (power[k] > 0 && chips[i]) { chips[i].textContent = power[k].toFixed(1) + 's'; i++; }
      }
    }
  }

  // ---------- Render ----------
  function render() {
    ctx.clearRect(0, 0, W, H);

    let sx = 0, sy = 0;
    if (game.shakeTime > 0) {
      const m = game.shakeTime * 16;
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m;
    }
    ctx.save();
    ctx.translate(sx, sy);

    drawBackground();
    drawTrails();

    // Ordena por y para profundidade simples.
    for (const c of coins) drawCoin(c);
    for (const p of powerups) drawPowerup(p);
    for (const o of obstacles) drawObstacle(o);

    drawSkier();
    drawParticles();

    ctx.restore();

    // Flash ao pegar power-up.
    if (game.flashTime > 0) {
      ctx.fillStyle = `rgba(255,255,255,${game.flashTime * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Fundo de neve em pixels com dithering rolante (estilo 32 bits).
  let bgScroll = 0;
  function drawBackground() {
    ctx.fillStyle = '#e9f4ff';
    ctx.fillRect(0, 0, W, H);

    bgScroll += game.speed * 0.016 * 0.5;
    const step = PXS * 8;
    const dot = PXS;

    // Camada de pontos azulados (textura da neve).
    ctx.fillStyle = '#d3e6f7';
    const offA = bgScroll % step;
    for (let y = -step; y < H + step; y += step) {
      const yy = Math.round(y + offA);
      const rowOdd = Math.floor((y + offA) / step) % 2;
      for (let x = 0; x < W + step; x += step) {
        ctx.fillRect(Math.round(x + rowOdd * (step / 2)), yy, dot, dot);
      }
    }
    // Brilhos brancos esparsos (parallax mais rápido).
    ctx.fillStyle = '#ffffff';
    const step2 = step * 2;
    const offB = (bgScroll * 1.35) % step2;
    for (let y = -step2; y < H + step2; y += step2) {
      const yy = Math.round(y + offB);
      for (let x = step; x < W; x += step2) {
        ctx.fillRect(Math.round(x), yy, dot, dot);
      }
    }
    // Bordas da pista em pixels.
    ctx.fillStyle = 'rgba(150, 190, 225, 0.3)';
    ctx.fillRect(0, 0, PXS, H);
    ctx.fillRect(W - PXS, 0, PXS, H);
  }

  function drawTrails() {
    ctx.strokeStyle = 'rgba(150, 180, 215, 0.5)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 1; i < trails.length; i++) {
      const a = trails[i - 1], b = trails[i];
      ctx.globalAlpha = b.life * 0.6;
      ctx.beginPath();
      ctx.moveTo(a.x - 5, a.y);
      ctx.lineTo(b.x - 5, b.y);
      ctx.moveTo(a.x + 5, a.y);
      ctx.lineTo(b.x + 5, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawCoin(c) {
    // Giro fake: comprime/estica no eixo X (nearest-neighbor = look retro).
    const xs = 0.35 + 0.65 * Math.abs(Math.cos(c.pulse));
    ctx.save();
    ctx.shadowColor = 'rgba(255, 200, 40, 0.7)';
    ctx.shadowBlur = 10;
    blit(SPR.coin, Math.round(c.x), Math.round(c.y), PXS, { xscale: xs });
    ctx.restore();
  }

  function drawPowerup(p) {
    const def = POWER_DEFS[p.name];
    const s = 1 + Math.sin(p.pulse) * 0.1;
    ctx.save();
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 18;
    blit(def.spr, Math.round(p.x), Math.round(p.y), PXS * s);
    ctx.restore();
  }

  function drawObstacle(o) {
    const spr = SPR[o.type];
    // Sombra em pixels na base do sprite.
    ctx.fillStyle = 'rgba(120, 150, 185, 0.28)';
    const sw = spr.width * PXS * 0.55, sh = PXS * 1.5;
    const by = Math.round(o.y + spr.height * PXS * 0.42);
    ctx.fillRect(Math.round(o.x - sw / 2), by, Math.round(sw), Math.round(sh));
    blit(spr, Math.round(o.x), Math.round(o.y), PXS);
  }

  function drawSkier() {
    // Aura de power-up (escudo / fantasma).
    if (power.ghost > 0 || power.shield > 0) {
      const col = power.shield > 0 ? '#4fe3c2' : '#b69bff';
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 120) * 0.12;
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(skier.x, skier.y, skier.radius + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Sombra em pixels.
    ctx.fillStyle = 'rgba(100, 130, 170, 0.25)';
    ctx.fillRect(Math.round(skier.x - 9 * PXS / 3), Math.round(skier.y + 24), Math.round(6 * PXS), PXS);

    const ghost = power.ghost > 0;
    blit(SPR.skier, Math.round(skier.x), Math.round(skier.y), PXS, {
      rot: skier.lean * 0.18,
      alpha: ghost ? 0.55 : 1,
    });
  }

  function drawParticles() {
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      const s = Math.max(PXS, Math.round(pt.size));
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), s, s);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Loop principal ----------
  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // limita saltos grandes

    if (state === 'playing') {
      update(dt);
      render();
    } else if (state === 'paused' || state === 'gameover') {
      render(); // mantém a cena congelada
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Polyfill roundRect para navegadores antigos.
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }
})();
