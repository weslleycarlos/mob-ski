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

  // Linhas de neve roladas para dar sensação de movimento.
  let bgScroll = 0;
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#eaf6ff');
    g.addColorStop(1, '#dceefc');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    bgScroll = (bgScroll + game.speed * 0.016 * 0.4) % 80;
    ctx.fillStyle = 'rgba(180, 205, 235, 0.35)';
    for (let y = -80 + (bgScroll % 80); y < H; y += 80) {
      for (let x = 20; x < W; x += 90) {
        const ox = ((y / 80) % 2) * 45;
        ctx.beginPath();
        ctx.ellipse(x + ox, y, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Vinheta lateral suave (bordas da pista).
    ctx.fillStyle = 'rgba(160, 195, 230, 0.25)';
    ctx.fillRect(0, 0, 8, H);
    ctx.fillRect(W - 8, 0, 8, H);
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
    const s = 1 + Math.sin(c.pulse) * 0.08;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(s, s);
    ctx.shadowColor = 'rgba(255, 200, 40, 0.7)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe89a';
    ctx.beginPath();
    ctx.arc(0, 0, c.r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0a020';
    ctx.font = `bold ${c.r}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
    ctx.restore();
  }

  function drawPowerup(p) {
    const def = POWER_DEFS[p.name];
    const s = 1 + Math.sin(p.pulse) * 0.12;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(s, s);
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 0.74, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${p.r * 1.1}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, 0, 1);
    ctx.restore();
  }

  function drawObstacle(o) {
    ctx.save();
    ctx.translate(o.x, o.y);
    // sombra
    ctx.fillStyle = 'rgba(120, 150, 185, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, o.r * 0.6, o.r * 0.9, o.r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    if (o.type === 'tree') {
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(-3, 2, 6, 14);
      ctx.fillStyle = '#2f8f4e';
      for (let i = 0; i < 3; i++) {
        const yy = -o.r + i * 9;
        const ww = o.r - i * 3;
        ctx.beginPath();
        ctx.moveTo(0, yy - 4);
        ctx.lineTo(ww, yy + 10);
        ctx.lineTo(-ww, yy + 10);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(-4, -8, 3, 0, 6.28); ctx.arc(5, 2, 2.5, 0, 6.28); ctx.fill();
    } else if (o.type === 'rock') {
      ctx.fillStyle = '#8b95a3';
      ctx.beginPath();
      ctx.moveTo(-o.r, 6);
      ctx.lineTo(-o.r * 0.5, -o.r * 0.8);
      ctx.lineTo(o.r * 0.4, -o.r * 0.6);
      ctx.lineTo(o.r, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#aab4c2';
      ctx.beginPath();
      ctx.moveTo(-o.r * 0.5, -o.r * 0.8);
      ctx.lineTo(o.r * 0.4, -o.r * 0.6);
      ctx.lineTo(-o.r * 0.1, 0);
      ctx.closePath();
      ctx.fill();
    } else if (o.type === 'stump') {
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(-o.r * 0.6, -o.r * 0.5, o.r * 1.2, o.r);
      ctx.fillStyle = '#9c7b4f';
      ctx.beginPath();
      ctx.ellipse(0, -o.r * 0.5, o.r * 0.6, o.r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6b4423';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, -o.r * 0.5, o.r * 0.32, 0.15 * o.r, 0, 0, 6.28); ctx.stroke();
    } else { // snowman
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cfe0f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 6, o.r * 0.7, 0, 6.28); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -o.r * 0.5, o.r * 0.5, 0, 6.28); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(-3, -o.r * 0.6, 1.6, 0, 6.28); ctx.arc(3, -o.r * 0.6, 1.6, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#ff8c2b';
      ctx.beginPath(); ctx.moveTo(0, -o.r * 0.45); ctx.lineTo(7, -o.r * 0.35); ctx.lineTo(0, -o.r * 0.28); ctx.fill();
    }
    ctx.restore();
  }

  function drawSkier() {
    ctx.save();
    ctx.translate(skier.x, skier.y);
    const lean = skier.lean;
    ctx.rotate(lean * 0.35);

    // Aura de power-up.
    if (power.ghost > 0 || power.shield > 0) {
      const col = power.shield > 0 ? '#4fe3c2' : '#b69bff';
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 120) * 0.12;
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(0, 0, skier.radius + 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Sombra.
    ctx.fillStyle = 'rgba(100, 130, 170, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 20, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const ghost = power.ghost > 0;
    ctx.globalAlpha = ghost ? 0.55 : 1;

    // Esquis.
    ctx.strokeStyle = '#e23b50';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, -10); ctx.lineTo(-12, 22);
    ctx.moveTo(10, -10); ctx.lineTo(12, 22);
    ctx.stroke();

    // Corpo (casaco).
    ctx.fillStyle = '#2e6df0';
    ctx.beginPath();
    ctx.roundRect(-9, -12, 18, 22, 6);
    ctx.fill();

    // Braços.
    ctx.strokeStyle = '#2e6df0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-8, -4); ctx.lineTo(-15, 6);
    ctx.moveTo(8, -4); ctx.lineTo(15, 6);
    ctx.stroke();
    // Bastões.
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, 6); ctx.lineTo(-17, 20);
    ctx.moveTo(15, 6); ctx.lineTo(17, 20);
    ctx.stroke();

    // Cabeça + gorro.
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath();
    ctx.arc(0, -16, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5252';
    ctx.beginPath();
    ctx.arc(0, -18, 7.5, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-7.5, -18, 15, 3);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -25, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawParticles() {
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
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
