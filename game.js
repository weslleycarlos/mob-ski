/* ============================================================
   Ski Rush — Descida Radical
   Mistura de Ski Free + Subway Surfers em HTML5 Canvas.
   Usa sprites em PNG (pasta assets/) carregados via sprites.json.
   ============================================================ */
(() => {
  'use strict';

  // ---------- Setup do canvas ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  let W = 480, H = 800, DPR = 1, S = 1; // S = escala relativa (H/800)

  function resize() {
    const wrapW = window.innerWidth;
    const wrapH = window.innerHeight;
    const targetRatio = 3 / 5;
    let cw = wrapH * targetRatio;
    let ch = wrapH;
    if (cw > wrapW) { cw = wrapW; ch = wrapW / targetRatio; }
    W = Math.round(cw);
    H = Math.round(ch);
    S = H / 800;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Carregamento dos assets ----------
  const A = { skier: {}, coins: [], powers: {}, obstacles: [], obMeta: [], obPool: [], bg: null };
  // Floating score texts (near miss, etc.)
  let floatingTexts = [];
  let assetsReady = false;

  function loadImg(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('falha ao carregar ' + src));
      i.src = src;
    });
  }

  async function loadAssets() {
    const m = await fetch('assets/sprites.json').then(r => r.json());
    A.manifest = m;
    A.skier.down = await loadImg('assets/' + m.skier.down.file);
    A.skier.turn = await loadImg('assets/' + m.skier.turn.file);
    // Carrega frames de animação esquerda/direita
    A.skier.left = await Promise.all(m.skier.left.map(f => loadImg('assets/' + f.file)));
    A.skier.right = await Promise.all(m.skier.right.map(f => loadImg('assets/' + f.file)));
    A.coins = await Promise.all(m.coins.map(c => loadImg('assets/' + c.file)));
    for (const k in m.powers) A.powers[k] = await loadImg('assets/' + m.powers[k].file);
    A.obstacles = await Promise.all(m.obstacles.map(o => loadImg('assets/' + o.file)));
    A.obMeta = m.obstacles;
    // pool ponderado de obstáculos
    A.obMeta.forEach((o, i) => { for (let k = 0; k < (o.w8 || 1); k++) A.obPool.push(i); });
    A.bg = await loadImg('assets/' + m.background.file);
    assetsReady = true;
  }

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
    startBtn: document.getElementById('start-btn'),
    finalScore: document.getElementById('final-score'),
    finalCoins: document.getElementById('final-coins'),
    finalDist: document.getElementById('final-dist'),
    newRecord: document.getElementById('new-record'),
    muteBtn: document.getElementById('mute-btn'),
    countdown: document.getElementById('countdown'),
  };

  const BEST_KEY = 'skirush_best';
  let best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  ui.best.textContent = best;

  // ---------- Áudio ----------
  const SND_DEFS = {
    coin: 'coin.mp3', powerup: 'powerup.mp3', shield: 'shield.mp3',
    crash: 'crash.mp3', game_over: 'game_over.mp3', record: 'record.mp3',
    countdown: 'countdown.mp3', go: 'go.mp3', near_miss: 'near_miss.mp3',
  };
  const VOL = {
    coin: 0.5, powerup: 0.7, shield: 0.75, crash: 0.85, game_over: 0.7,
    record: 0.9, countdown: 0.6, go: 0.75, near_miss: 0.4,
  };
  const SND = {};
  for (const k in SND_DEFS) { const a = new Audio('sounds/' + SND_DEFS[k]); a.preload = 'auto'; SND[k] = a; }
  const music = new Audio('sounds/music_game.mp3');
  music.loop = true; music.volume = 0.45;
  let muted = localStorage.getItem('skirush_muted') === '1';

  function sfx(name) {
    if (muted) return;
    const base = SND[name]; if (!base) return;
    const a = base.cloneNode();
    a.volume = VOL[name] != null ? VOL[name] : 0.6;
    a.play().catch(() => {});
  }
  function startMusic() { if (!muted) music.play().catch(() => {}); }
  function stopMusic() { music.pause(); try { music.currentTime = 0; } catch (e) {} }
  function applyMute() {
    ui.muteBtn.textContent = muted ? '🔇' : '🔊';
    if (muted) music.pause();
    else if (state === 'playing' || state === 'countdown') music.play().catch(() => {});
  }

  // ---------- Definição dos poderes ----------
  const POWER_DEFS = {
    magnet: { color: '#ff5a5a', icon: '🧲', label: 'Ímã',     dur: 8 },
    ghost:  { color: '#cdc8ff', icon: '👻', label: 'Fantasma', dur: 6 },
    turbo:  { color: '#ff9a3c', icon: '🔥', label: 'Turbo',    dur: 6 },
    double: { color: '#5ad24a', icon: '✖️', label: '2x Pontos', dur: 8 },
    shield: { color: '#4aa6ff', icon: '🛡️', label: 'Escudo',   dur: 12 },
  };

  // ---------- Estado do jogo ----------
  let state = 'loading'; // loading | menu | playing | paused | gameover
  let last = 0;

  const game = {
    distance: 0, score: 0, coins: 0,
    speed: 0, baseSpeed: 230,
    spawnTimer: 0, coinTimer: 0, powerTimer: 0,
    shakeTime: 0, flashTime: 0, bgScroll: 0,
    slowMo: 0, // near-miss slow-motion timer
  };

  const skier = { x: W / 2, y: 0, vx: 0, lean: 0, radius: 14, animTimer: 0, animFrame: 0 };
  const power = { magnet: 0, ghost: 0, turbo: 0, double: 0, shield: 0 };
  // Rastreia poderes coletados durante a partida
  let powersCollected = {};

  let obstacles = [], coins = [], powerups = [], particles = [], trails = [];

  // ---------- Entrada ----------
  const keys = { left: false, right: false };
  let pointerActive = false, pointerX = null;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === ' ' && state === 'menu') startGame();
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
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
    pointerActive = true; pointerX = canvasX(e.clientX);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointerActive) pointerX = canvasX(e.clientX);
  });
  const endPointer = () => { pointerActive = false; pointerX = null; };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', endPointer);

  ui.startBtn.addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', startGame);
  document.getElementById('resume-btn').addEventListener('click', resumeGame);
  document.getElementById('quit-btn').addEventListener('click', toMenu);
  ui.pauseBtn.addEventListener('click', pauseGame);
  ui.muteBtn.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem('skirush_muted', muted ? '1' : '0');
    applyMute();
  });
  applyMute();

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  // ---------- Fluxo de telas ----------
  function startGame() {
    if (!assetsReady) return;
    obstacles = []; coins = []; powerups = []; particles = []; trails = []; floatingTexts = [];
    game.distance = 0; game.score = 0; game.coins = 0;
    game.speed = game.baseSpeed;
    game.spawnTimer = 0; game.coinTimer = 0; game.powerTimer = 11;
    game.shakeTime = 0; game.flashTime = 0; game.slowMo = 0;
    skier.x = W / 2; skier.vx = 0; skier.lean = 0; skier.y = H * 0.32;
    skier.animTimer = 0; skier.animFrame = 0;
    powersCollected = {};
    for (const k in power) power[k] = 0;
    hide(ui.start); hide(ui.gameover); hide(ui.pause);
    show(ui.hud); show(ui.powerbar);
    ui.pauseBtn.style.display = 'flex';
    updateHUD();
    runCountdown();
  }
  function runCountdown() {
    state = 'countdown';
    last = performance.now();
    startMusic();
    const steps = ['3', '2', '1', 'JÁ!'];
    let i = 0;
    const el = ui.countdown;
    (function tick() {
      if (i < steps.length) {
        el.classList.remove('hidden', 'tick');
        el.textContent = steps[i];
        void el.offsetWidth; // reinicia a animação
        el.classList.add('tick');
        sfx(i < 3 ? 'countdown' : 'go');
        i++;
        setTimeout(tick, 700);
      } else {
        el.classList.add('hidden');
        state = 'playing';
        last = performance.now();
      }
    })();
  }
  function pauseGame() { if (state === 'playing') { state = 'paused'; show(ui.pause); music.pause(); } }
  function resumeGame() { if (state === 'paused') { state = 'playing'; hide(ui.pause); last = performance.now(); startMusic(); } }
  function toMenu() {
    state = 'menu';
    stopMusic();
    hide(ui.pause); hide(ui.gameover); hide(ui.hud); hide(ui.powerbar);
    ui.pauseBtn.style.display = 'none';
    show(ui.start);
  }
  function gameOver() {
    state = 'gameover';
    stopMusic();
    ui.pauseBtn.style.display = 'none';
    hide(ui.powerbar);
    const sc = Math.floor(game.score);
    ui.finalScore.textContent = sc;
    ui.finalCoins.textContent = game.coins;
    ui.finalDist.textContent = Math.floor(game.distance) + ' m';
    // Resumo de poderes coletados
    buildPowersSummary();
    if (sc > best) {
      best = sc; localStorage.setItem(BEST_KEY, String(best));
      ui.best.textContent = best; show(ui.newRecord);
      sfx('game_over'); setTimeout(() => sfx('record'), 380);
    } else { hide(ui.newRecord); sfx('game_over'); }
    show(ui.gameover);
  }

  function buildPowersSummary() {
    const el = document.getElementById('powers-summary');
    if (!el) return;
    const names = Object.keys(powersCollected);
    if (names.length === 0) {
      el.innerHTML = '<span class="no-powers">Nenhum poder coletado</span>';
      return;
    }
    el.innerHTML = names.map(k => {
      const def = POWER_DEFS[k];
      return `<div class="power-summary-chip" style="background:${def.color}cc">`
           + `<span class="power-icon">${def.icon}</span>`
           + `<span class="power-count">${powersCollected[k]}×</span></div>`;
    }).join('');
  }

  // ---------- Geometria dos obstáculos ----------
  const OB_K = 0.6; // escala de exibição dos obstáculos
  function obGeom(o) {
    const m = A.obMeta[o.idx];
    const dispH = m.h * OB_K * S;
    const dispW = m.w * OB_K * S;
    const rad = m.rf * dispW;            // colisão proporcional à largura
    const cy = o.y + dispH * 0.20;       // centro de colisão perto da base
    return { dispH, dispW, rad, cy, m };
  }

  // ---------- Spawns ----------
  function spawnObstacle() {
    const idx = A.obPool[(Math.random() * A.obPool.length) | 0];
    obstacles.push({ idx, x: 30 * S + Math.random() * (W - 60 * S), y: H + 120 * S, hit: false });
  }
  function spawnCoinCluster() {
    const n = 3 + ((Math.random() * 4) | 0);
    const startX = 40 * S + Math.random() * (W - 80 * S);
    const arc = Math.random() < 0.5;
    const dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      let cx = startX + dir * i * 26 * S;
      cx = Math.max(24 * S, Math.min(W - 24 * S, cx));
      const cy = H + 40 * S + i * 30 * S;
      const oy = arc ? -Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 30 * S : 0;
      coins.push({ x: cx, y: cy + oy, taken: false, seed: Math.random() * 10 });
    }
  }
  function spawnPowerup() {
    const names = Object.keys(POWER_DEFS);
    const name = names[(Math.random() * names.length) | 0];
    powerups.push({ x: 40 * S + Math.random() * (W - 80 * S), y: H + 60 * S, name, phase: Math.random() * 6.28 });
  }

  // ---------- Partículas ----------
  function burst(x, y, color, count, spd) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spd * S * (0.4 + Math.random() * 0.8);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1, decay: 1.6 + Math.random(), size: (2 + Math.random() * 3) * S, color });
    }
  }

  // ---------- Atualização ----------
  function update(dt) {
    // Slow-mo (near miss)
    if (game.slowMo > 0) { dt *= 0.35; game.slowMo -= dt / 0.35; }

    const ramp = Math.min(game.distance / 1800, 1);
    let speed = (game.baseSpeed + ramp * 240) * S;
    if (power.turbo > 0) speed *= 1.5;
    game.speed = speed;
    const move = speed * dt;
    const mult = power.double > 0 ? 2 : 1;
    game.distance += move * 0.06 / S;
    game.score += move * 0.05 * mult / S;
    game.bgScroll += move * 0.5;

    // ---- Movimento do esquiador ----
    const accel = 1400 * S, maxV = 360 * S;
    if (pointerActive && pointerX != null) {
      const diff = pointerX - skier.x;
      skier.vx = Math.max(-maxV, Math.min(maxV, diff * 9));
    } else {
      let dir = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
      if (dir !== 0) skier.vx = Math.max(-maxV, Math.min(maxV, skier.vx + dir * accel * dt));
      else skier.vx *= Math.pow(0.0009, dt);
    }
    skier.x += skier.vx * dt;
    const margin = skier.radius + 4 * S;
    if (skier.x < margin) { skier.x = margin; skier.vx = 0; }
    if (skier.x > W - margin) { skier.x = W - margin; skier.vx = 0; }
    const targetLean = Math.max(-1, Math.min(1, skier.vx / maxV));
    skier.lean += (targetLean - skier.lean) * Math.min(1, dt * 10);

    // ---- Animação de pernas do esquiador ----
    const absLean = Math.abs(skier.lean);
    if (absLean > 0.15) {
      // Velocidade da animação proporcional ao lean
      const animSpeed = 6 + absLean * 10; // frames por segundo
      skier.animTimer += dt * animSpeed;
      if (skier.animTimer >= 1) {
        skier.animTimer -= 1;
        skier.animFrame = (skier.animFrame + 1) % 3;
      }
    } else {
      skier.animTimer = 0;
      skier.animFrame = 0;
    }

    // ---- Partículas de neve ao virar ----
    if (absLean > 0.35) {
      const freq = absLean > 0.7 ? 0.02 : 0.06;
      if (Math.random() < freq / dt * 0.016) {
        const side = skier.lean > 0 ? -1 : 1;
        const px = skier.x + side * 12 * S;
        const py = skier.y + 18 * S;
        const spd = (40 + absLean * 80) * S;
        for (let i = 0; i < 2; i++) {
          const a = (side > 0 ? Math.PI * 0.7 : Math.PI * 0.3) + (Math.random() - 0.5) * 0.8;
          const s = spd * (0.5 + Math.random() * 0.7);
          particles.push({ x: px + (Math.random() - 0.5) * 6 * S, y: py,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30 * S,
            life: 1, decay: 2.5 + Math.random(), size: (1.5 + Math.random() * 2.5) * S,
            color: Math.random() < 0.5 ? 'rgba(220,235,255,0.9)' : 'rgba(190,215,240,0.8)' });
        }
      }
    }

    // ---- Rastro na neve: cada marca fica fixa na neve e sobe com a
    //      rolagem, formando o sulco que recua morro acima atrás do esquiador.
    for (const t of trails) { t.y -= move; t.life -= dt * 0.5; }
    trails.push({ x: skier.x, y: skier.y + 20 * S, life: 1 });
    if (trails.length > 140) trails.shift();
    trails = trails.filter(t => t.life > 0 && t.y > -30);

    // ---- Spawns ----
    game.spawnTimer -= dt;
    const spawnInterval = Math.max(0.30, 0.85 - ramp * 0.48);
    if (game.spawnTimer <= 0) { game.spawnTimer = spawnInterval * (0.7 + Math.random() * 0.6); spawnObstacle(); }
    game.coinTimer -= dt;
    if (game.coinTimer <= 0) { game.coinTimer = 1.6 + Math.random() * 1.8; spawnCoinCluster(); }
    game.powerTimer -= dt;
    if (game.powerTimer <= 0) { game.powerTimer = 10 + Math.random() * 9; spawnPowerup(); }

    // ---- Move entidades ----
    for (const o of obstacles) o.y -= move;
    for (const c of coins) c.y -= move;
    for (const p of powerups) p.y -= move;

    // ---- Ímã ----
    if (power.magnet > 0) {
      const R = 230 * S;
      for (const c of coins) {
        if (c.taken) continue;
        const dx = skier.x - c.x, dy = skier.y - c.y, d = Math.hypot(dx, dy);
        if (d < R && d > 0.1) { const pull = (1 - d / R) * 640 * S * dt; c.x += dx / d * pull; c.y += dy / d * pull; }
      }
    }

    // ---- Colisão moedas ----
    for (const c of coins) {
      if (c.taken) continue;
      if (Math.hypot(skier.x - c.x, skier.y - c.y) < skier.radius + 16 * S) {
        c.taken = true; game.coins++; game.score += 10 * mult;
        burst(c.x, c.y, '#ffcf3f', 8, 120); sfx('coin');
      }
    }

    // ---- Colisão poderes ----
    for (const p of powerups) {
      if (p.taken) continue;
      if (Math.hypot(skier.x - p.x, skier.y - p.y) < skier.radius + 22 * S) {
        p.taken = true; const def = POWER_DEFS[p.name];
        power[p.name] = def.dur; burst(p.x, p.y, def.color, 18, 180); game.flashTime = 0.25; sfx('powerup');
        // Registra poder coletado
        powersCollected[p.name] = (powersCollected[p.name] || 0) + 1;
      }
    }

    // ---- Colisão / quase-batida com obstáculos ----
    for (const o of obstacles) {
      if (o.hit) continue;
      const g = obGeom(o);
      const hd = skier.radius + g.rad;
      if (Math.hypot(skier.x - o.x, skier.y - g.cy) < hd) {
        if (power.ghost > 0) { /* atravessa */ }
        else if (power.shield > 0) { power.shield = 0; o.hit = true; game.shakeTime = 0.4; burst(o.x, g.cy, '#4aa6ff', 22, 200); sfx('shield'); }
        else {
          o.hit = true; game.shakeTime = 0.5; sfx('crash');
          // Burst de neve na colisão
          burst(skier.x, skier.y, '#ffffff', 32, 260);
          burst(skier.x, skier.y, '#cde0f5', 18, 180);
          burst(skier.x, skier.y, '#9fb4d8', 14, 160);
          // Partículas de neve espalhadas
          for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = (80 + Math.random() * 140) * S;
            particles.push({ x: skier.x, y: skier.y,
              vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60 * S,
              life: 1, decay: 1.0 + Math.random() * 0.8, size: (2 + Math.random() * 4) * S,
              color: 'rgba(230,240,255,0.85)' });
          }
          gameOver(); return;
        }
      } else if (!o.passed && g.cy > skier.y) {
        // obstáculo acabou de passar pelo esquiador sem bater
        o.passed = true;
        const dx = Math.abs(skier.x - o.x);
        if (dx < hd + 26 * S) {
          const pts = 5 * mult;
          sfx('near_miss'); game.score += pts;
          game.flashTime = Math.max(game.flashTime, 0.15);
          game.slowMo = Math.max(game.slowMo, 0.18);
          // Texto flutuante "+5"
          floatingTexts.push({
            x: skier.x, y: skier.y - 30 * S,
            text: '+' + pts, life: 1, color: '#ffcf3f',
          });
          // Brilho no esquiador
          burst(skier.x, skier.y, '#ffcf3f', 6, 80);
        }
      }
    }

    // ---- Limpeza ----
    obstacles = obstacles.filter(o => o.y > -260 * S);
    coins = coins.filter(c => c.y > -40 && !c.taken);
    powerups = powerups.filter(p => p.y > -60 && !p.taken);

    // ---- Partículas ----
    for (const pt of particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 200 * S * dt; pt.life -= pt.decay * dt; }
    particles = particles.filter(pt => pt.life > 0);

    // ---- Textos flutuantes ----
    for (const ft of floatingTexts) { ft.y -= 60 * S * dt; ft.life -= dt * 1.2; }
    floatingTexts = floatingTexts.filter(ft => ft.life > 0);

    // ---- Timers ----
    for (const k in power) if (power[k] > 0) power[k] = Math.max(0, power[k] - dt);
    if (game.shakeTime > 0) game.shakeTime -= dt;
    if (game.flashTime > 0) game.flashTime -= dt;

    updateHUD(); updatePowerbar();
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
        html += `<div class="power-chip" style="background:${def.color}dd">`
              + `<span>${def.icon} ${def.label}</span>`
              + `<span class="timer">${power[k].toFixed(1)}s</span></div>`;
      }
    }
    if (html !== powerbarCache) { ui.powerbar.innerHTML = html; powerbarCache = html; }
    else {
      const chips = ui.powerbar.querySelectorAll('.power-chip .timer');
      let i = 0;
      for (const k in POWER_DEFS) if (power[k] > 0 && chips[i]) { chips[i].textContent = power[k].toFixed(1) + 's'; i++; }
    }
  }

  // ---------- Render ----------
  function render() {
    ctx.clearRect(0, 0, W, H);
    let sx = 0, sy = 0;
    if (game.shakeTime > 0) { const m = game.shakeTime * 16 * S; sx = (Math.random() - 0.5) * m; sy = (Math.random() - 0.5) * m; }
    ctx.save();
    ctx.translate(sx, sy);
    ctx.imageSmoothingEnabled = true;

    drawBackground();
    drawTrails();
    for (const c of coins) drawCoin(c);
    for (const p of powerups) drawPowerup(p);
    obstacles.slice().sort((a, b) => a.y - b.y).forEach(drawObstacle);
    drawSkier();
    drawParticles();
    drawFloatingTexts();

    ctx.restore();
    if (game.flashTime > 0) { ctx.fillStyle = `rgba(255,255,255,${game.flashTime * 0.6})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawBackground() {
    const img = A.bg;
    if (!img) { ctx.fillStyle = '#e9f4ff'; ctx.fillRect(0, 0, W, H); return; }
    const dh = img.height * (W / img.width);
    let off = game.bgScroll % dh;
    for (let y = off - dh; y < H; y += dh) ctx.drawImage(img, 0, Math.round(y), W, Math.ceil(dh) + 1);
    // bordas da pista
    ctx.fillStyle = 'rgba(150, 190, 225, 0.25)';
    ctx.fillRect(0, 0, 3 * S, H); ctx.fillRect(W - 3 * S, 0, 3 * S, H);
  }

  function drawTrails() {
    ctx.strokeStyle = 'rgba(150, 180, 215, 0.5)';
    ctx.lineWidth = 4 * S; ctx.lineCap = 'round';
    for (let i = 1; i < trails.length; i++) {
      const a = trails[i - 1], b = trails[i];
      ctx.globalAlpha = b.life * 0.55;
      ctx.beginPath();
      ctx.moveTo(a.x - 5 * S, a.y); ctx.lineTo(b.x - 5 * S, b.y);
      ctx.moveTo(a.x + 5 * S, a.y); ctx.lineTo(b.x + 5 * S, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const now = () => performance.now();

  function drawCoin(c) {
    const fr = A.coins[Math.floor(now() / 90 + c.seed) % A.coins.length];
    const h = 30 * S, w = fr.width * h / fr.height;
    ctx.save();
    ctx.shadowColor = 'rgba(255, 200, 40, 0.6)'; ctx.shadowBlur = 10 * S;
    ctx.drawImage(fr, c.x - w / 2, c.y - h / 2, w, h);
    ctx.restore();
  }

  function drawPowerup(p) {
    const img = A.powers[p.name], def = POWER_DEFS[p.name];
    const bob = Math.sin(now() / 220 + p.phase) * 4 * S;
    const h = 42 * S, w = img.width * h / img.height;
    ctx.save();
    ctx.shadowColor = def.color; ctx.shadowBlur = 18 * S;
    ctx.drawImage(img, p.x - w / 2, p.y - h / 2 + bob, w, h);
    ctx.restore();
  }

  function drawObstacle(o) {
    const g = obGeom(o);
    const img = A.obstacles[o.idx];
    // sombra na base
    ctx.fillStyle = 'rgba(110, 140, 175, 0.28)';
    ctx.beginPath();
    ctx.ellipse(o.x, o.y + g.dispH * 0.40, g.dispW * 0.34, g.dispH * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, o.x - g.dispW / 2, o.y - g.dispH / 2, g.dispW, g.dispH);
  }

  function drawSkier() {
    const ghost = power.ghost > 0;
    // aura escudo/fantasma
    if (ghost || power.shield > 0) {
      const col = power.shield > 0 ? '#4aa6ff' : '#cdc8ff';
      ctx.save();
      ctx.globalAlpha = 0.32 + Math.sin(now() / 120) * 0.12;
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 22 * S;
      ctx.beginPath(); ctx.arc(skier.x, skier.y, 26 * S, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // sombra
    ctx.fillStyle = 'rgba(100, 130, 170, 0.22)';
    ctx.beginPath(); ctx.ellipse(skier.x, skier.y + 26 * S, 16 * S, 5 * S, 0, 0, Math.PI * 2); ctx.fill();

    // Seleção de sprite: usa animação direcional com os novos frames
    const absLean = Math.abs(skier.lean);
    let img;
    if (absLean > 0.15 && A.skier.left && A.skier.left.length > 0) {
      // Escolhe frame pela intensidade do lean: leve→0, médio→1, forte→2
      // Mas também anima ciclicamente para dar vida ao movimento
      const frames = skier.lean < 0 ? A.skier.left : A.skier.right;
      img = frames[skier.animFrame % frames.length];
    } else {
      img = A.skier.down;
    }
    const h = 72 * S, w = img.width * h / img.height;
    ctx.save();
    ctx.globalAlpha = ghost ? 0.55 : 1;
    ctx.translate(skier.x, skier.y);
    if (absLean <= 0.15) ctx.rotate(skier.lean * 0.12);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawParticles() {
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatingTexts() {
    for (const ft of floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.font = `900 ${Math.round(22 * S)}px 'Segoe UI', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Contorno
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3 * S;
      ctx.strokeText(ft.text, ft.x, ft.y);
      // Texto
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 12 * S;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  // ---------- Loop ----------
  function loop(t) {
    let dt = (t - last) / 1000; last = t;
    if (dt > 0.05) dt = 0.05;
    if (state === 'playing') { update(dt); render(); }
    else if (state === 'paused' || state === 'gameover' || state === 'countdown') { render(); }
    requestAnimationFrame(loop);
  }

  // ---------- Início ----------
  ui.startBtn.disabled = true;
  ui.startBtn.textContent = '⏳ Carregando…';
  loadAssets().then(() => {
    assetsReady = true;
    state = 'menu';
    ui.startBtn.disabled = false;
    ui.startBtn.textContent = '▶ Jogar';
    last = performance.now();
    requestAnimationFrame(loop);
  }).catch((err) => {
    ui.startBtn.textContent = '⚠ Erro ao carregar';
    console.error(err);
  });
})();
