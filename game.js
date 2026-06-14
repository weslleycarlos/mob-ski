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
    const wrapW = window.innerWidth, wrapH = window.innerHeight;
    let cw = wrapW;
    let ch = wrapH;
    if (cw / ch > 0.65) {
      cw = ch * 0.65;
    }
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
    A.skier.gameOver = await loadImg('assets/' + m.skier.gameOver.file);
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
    // Warm-up texturas globais na GPU
    ctx.save();
    ctx.globalAlpha = 0.01;
    if (A.bg) ctx.drawImage(A.bg, 0, 0, 1, 1);
    A.coins.forEach(c => ctx.drawImage(c, 0, 0, 1, 1));
    A.obstacles.forEach(o => ctx.drawImage(o, 0, 0, 1, 1));
    for (const k in A.powers) ctx.drawImage(A.powers[k], 0, 0, 1, 1);
    ctx.drawImage(A.skier.down, 0, 0, 1, 1);
    ctx.restore();

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
    restartBtn: document.getElementById('restart-btn'),
    menuBtn: document.getElementById('menu-btn'),
    pause: document.getElementById('pause-screen'),
    pauseBtn: document.getElementById('pause-btn'),
    startBtn: document.getElementById('start-btn'),
    finalScore: document.getElementById('final-score'),
    finalCoins: document.getElementById('final-coins'),
    finalDist: document.getElementById('final-dist'),
    newRecord: document.getElementById('new-record'),
    muteBtn: document.getElementById('mute-btn'),
    countdown: document.getElementById('countdown'),
    shopBtn: document.getElementById('shop-btn'),
    shop: document.getElementById('shop-screen'),
    shopCloseBtn: document.getElementById('shop-close-btn'),
    shopCoins: document.getElementById('shop-coins'),
    skinList: document.getElementById('skin-list'),
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
  let skirush_users = JSON.parse(localStorage.getItem('skirush_users') || '{}');
  let playerName = localStorage.getItem('skirush_player_name') || '';

  const playerNameInput = document.getElementById('player-name');
  const playerPinInput = document.getElementById('player-pin');
  if (playerNameInput) {
    playerNameInput.value = playerName;
  }

  function updateRanking() {
    const list = document.getElementById('ranking-list');
    if (!list) return;
    const usersArr = Object.keys(skirush_users).map(k => ({ name: k, best: skirush_users[k].best || 0 }));
    usersArr.sort((a, b) => b.best - a.best);
    
    if (usersArr.length === 0) {
      list.innerHTML = '<li style="color:#888;">Nenhum recorde ainda</li>';
    } else {
      list.innerHTML = '';
      for (let i = 0; i < Math.min(3, usersArr.length); i++) {
        let medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : '🥉');
        list.innerHTML += `<li style="display:flex; justify-content:space-between; margin-bottom:4px;">
           <span>${medal} ${usersArr[i].name}</span> <span>${Math.floor(usersArr[i].best)} pts</span>
        </li>`;
      }
    }
  }
  updateRanking();

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
    // Combo de moedas
    coinCombo: 0, comboTimer: 0, maxCombo: 0,
  };

  const skier = { x: W / 2, y: 0, vx: 0, lean: 0, radius: 14, animTimer: 0, animFrame: 0, skin: 0 };
  const power = { magnet: 0, ghost: 0, turbo: 0, double: 0, shield: 0 };
  // Rastreia poderes coletados durante a partida
  let powersCollected = {};

  let obstacles = [], coins = [], powerups = [], particles = [], trails = [];

  // ---------- Biomas ----------
  const BIOMES = [
    { name: 'floresta', start: 0,   bgColor: '#dfeefc', edgeColor: 'rgba(150,190,225,0.25)', obstacleCats: ['tree','rock','mound','log'],    tint: [0,0,0] },
    { name: 'gelo',     start: 2000, bgColor: '#e8f4ff', edgeColor: 'rgba(180,220,255,0.3)', obstacleCats: ['rock','snowball','fence'], tint: [30,20,-10] },
    { name: 'caverna',  start: 5000, bgColor: '#2a2a3a', edgeColor: 'rgba(120,100,140,0.35)', obstacleCats: ['rock','stump','sign','deadtree'], tint: [-40,-30,-20] },
    { name: 'aurora',   start: 10000,bgColor: '#1a1a3a', edgeColor: 'rgba(100,180,255,0.25)', obstacleCats: ['tree','snowman','bush','log'],    tint: [50,0,30] },
  ];
  let currentBiome = 0;

  // ---------- Skins (recolor HSV) ----------
  const SKINS = [
    { id: 'classic',   name: 'Clássico',     price: 0,   hueShift: 0,   saturation: 1.0,  unlocked: true },
    { id: 'red',       name: 'Vermelho',     price: 200, hueShift: 0,   saturation: 1.2,  unlocked: false },
    { id: 'blue',      name: 'Azul',         price: 200, hueShift: 220, saturation: 1.0,  unlocked: false },
    { id: 'green',     name: 'Verde',        price: 300, hueShift: 100, saturation: 1.0,  unlocked: false },
    { id: 'purple',    name: 'Roxo',         price: 400, hueShift: 280, saturation: 1.1,  unlocked: false },
    { id: 'gold',      name: 'Dourado',      price: 800, hueShift: 45,  saturation: 1.3,  unlocked: false },
    { id: 'neon',      name: 'Neon',         price: 1200,hueShift: 180, saturation: 1.5,  unlocked: false },
  ];
  let ownedSkins = JSON.parse(localStorage.getItem('skirush_skins') || '["classic"]');
  let selectedSkin = localStorage.getItem('skirush_selected_skin') || 'classic';

  function getSkinDef(id) { return SKINS.find(s => s.id === id) || SKINS[0]; }
  function getSelectedSkin() { return getSkinDef(selectedSkin); }
  function unlockSkin(id) {
    if (!ownedSkins.includes(id)) {
      ownedSkins.push(id);
      if (playerName && skirush_users[playerName]) {
        skirush_users[playerName].skins = ownedSkins;
        saveUserDB();
      }
    }
  }
  function selectSkin(id) {
    if (ownedSkins.includes(id)) {
      selectedSkin = id;
      if (playerName && skirush_users[playerName]) {
        skirush_users[playerName].selectedSkin = id;
        saveUserDB();
      }
    }
  }

  // HSV recolor helper (draws skier frames to offscreen canvas with hue shift)
  const skinCache = new Map();
  function getSkierFrames(skinId) {
    if (skinCache.has(skinId)) return skinCache.get(skinId);
    const skin = getSkinDef(skinId);
    const frames = { down: null, left: [], right: [], gameOver: null };
    const hue = skin.hueShift, sat = skin.saturation;
    const applyTint = (img) => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (a < 10) continue;
        // RGB to HSV
        const max = Math.max(r,g,b), min = Math.min(r,g,b);
        const d = max - min;
        let h = 0, s = max === 0 ? 0 : d / max, v = max / 255;
        if (d !== 0) {
          if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h *= 60;
        }
        h = (h + hue) % 360;
        s = Math.min(1, s * sat);
        // HSV to RGB
        const c_ = v * s;
        const x = c_ * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c_;
        let r_, g_, b_;
        if (h < 60) { r_ = c_; g_ = x; b_ = 0; }
        else if (h < 120) { r_ = x; g_ = c_; b_ = 0; }
        else if (h < 180) { r_ = 0; g_ = c_; b_ = x; }
        else if (h < 240) { r_ = 0; g_ = x; b_ = c_; }
        else if (h < 300) { r_ = x; g_ = 0; b_ = c_; }
        else { r_ = c_; g_ = 0; b_ = x; }
        data[i] = Math.round((r_ + m) * 255);
        data[i+1] = Math.round((g_ + m) * 255);
        data[i+2] = Math.round((b_ + m) * 255);
      }
      ctx.putImageData(imgData, 0, 0);
      return c;
    };
    frames.down = applyTint(A.skier.down);
    frames.gameOver = applyTint(A.skier.gameOver);
    frames.left = A.skier.left.map(applyTint);
    frames.right = A.skier.right.map(applyTint);
    skinCache.set(skinId, frames);
    
    // Warm-up texturas na GPU para evitar travamentos durante a transição de frames
    ctx.save();
    ctx.globalAlpha = 0.01;
    ctx.drawImage(frames.down, 0, 0, 1, 1);
    ctx.drawImage(frames.gameOver, 0, 0, 1, 1);
    frames.left.forEach(f => ctx.drawImage(f, 0, 0, 1, 1));
    frames.right.forEach(f => ctx.drawImage(f, 0, 0, 1, 1));
    ctx.restore();

    return frames;
  }

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

  ui.startBtn.addEventListener('click', handleLoginAndStart);
  document.getElementById('restart-btn').addEventListener('click', handleLoginAndStart);
  document.getElementById('resume-btn').addEventListener('click', resumeGame);
  document.getElementById('quit-btn').addEventListener('click', toMenu);
  ui.pauseBtn.addEventListener('click', pauseGame);
  ui.muteBtn.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem('skirush_muted', muted ? '1' : '0');
    applyMute();
  });
  // Loja
  ui.shopBtn.addEventListener('click', openShop);
  ui.shopCloseBtn.addEventListener('click', closeShop);
  applyMute();
  
  ui.menuBtn.addEventListener('click', toMenu);

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function openShop() {
    ui.shopCoins.textContent = game.coins;
    renderSkinList();
    hide(ui.start); show(ui.shop);
  }
  function closeShop() { hide(ui.shop); show(ui.start); }

  function renderSkinList() {
    ui.skinList.innerHTML = '';
    SKINS.forEach(skin => {
      const owned = ownedSkins.includes(skin.id);
      const selected = selectedSkin === skin.id;
      const canAfford = game.coins >= skin.price;
      const card = document.createElement('div');
      card.className = `skin-card ${owned ? 'owned' : ''} ${selected ? 'selected' : ''} ${!owned ? 'locked' : ''}`;
      card.innerHTML = `
        <canvas class="skin-preview" width="80" height="80"></canvas>
        <div class="skin-name">${skin.name}</div>
        <div class="skin-price ${owned ? 'owned' : (canAfford ? '' : '')}">${owned ? 'Adquirida' : (skin.price === 0 ? 'Grátis' : skin.price + ' 🪙')}</div>
      `;
      // Draw preview
      const canvas = card.querySelector('.skin-preview');
      const ctx = canvas.getContext('2d');
      const frames = getSkierFrames(skin.id);
      const img = frames.down;
      const h = 60, w = img.width * h / img.height;
      ctx.drawImage(img, (80 - w) / 2, (80 - h) / 2, w, h);
      card.addEventListener('click', () => {
        if (!owned) {
          if (game.coins >= skin.price) {
            game.coins -= skin.price;
            if (playerName && skirush_users[playerName]) {
              skirush_users[playerName].coins = game.coins;
              saveUserDB();
            }
            unlockSkin(skin.id);
            selectSkin(skin.id);
            sfx('powerup');
            renderSkinList();
            updateHUD();
          }
        } else {
          selectSkin(skin.id);
          renderSkinList();
        }
      });
      ui.skinList.appendChild(card);
    });
  }

  function saveUserDB() {
    localStorage.setItem('skirush_users', JSON.stringify(skirush_users));
  }

  function handleLoginAndStart() {
    const name = playerNameInput.value.trim().toUpperCase();
    const pin = playerPinInput.value.trim();
    if (!name) { alert('Digite um nome para jogar!'); return; }
    if (!pin) { alert('Digite um PIN (senha) para sua conta!'); return; }
    
    if (skirush_users[name]) {
      if (skirush_users[name].pin !== pin) {
        alert('PIN incorreto para este usuário!');
        return;
      }
    } else {
      skirush_users[name] = { pin, best: 0, coins: 0, skins: ['classic'] };
      saveUserDB();
    }
    
    playerName = name;
    localStorage.setItem('skirush_player_name', name);
    
    // Carregar progresso
    const u = skirush_users[name];
    game.coins = u.coins || 0;
    ui.best.textContent = Math.floor(u.best || 0);
    ownedSkins = u.skins || ['classic'];
    if (!ownedSkins.includes(selectedSkin)) selectedSkin = 'classic';
    
    updateRanking();
    startGame();
  }

  // ---------- Fluxo de telas ----------
  function startGame() {
    if (!assetsReady) return;
    obstacles = []; coins = []; powerups = []; particles = []; trails = []; floatingTexts = [];
    game.distance = 0; game.score = 0; game.coins = 0;
    game.speed = game.baseSpeed;
    game.spawnTimer = 0; game.coinTimer = 0; game.powerTimer = 11;
    game.shakeTime = 0; game.flashTime = 0; game.slowMo = 0;
    game.coinCombo = 0; game.comboTimer = 0; game.maxCombo = 0;
    skier.x = W / 2; skier.vx = 0; skier.lean = 0; skier.y = H * 0.32;
    skier.animTimer = 0; skier.animFrame = 0;
    skier.skin = selectedSkin;
    powersCollected = {};
    currentBiome = 0;
    for (const k in power) power[k] = 0;
    hide(ui.start); hide(ui.gameover); hide(ui.pause); hide(ui.shop);
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
    // Maior combo
    const comboEl = document.getElementById('max-combo');
    if (comboEl) comboEl.textContent = '🔥 Melhor combo: ' + game.maxCombo + 'x';
    
    let isRecord = false;
    if (playerName && skirush_users[playerName]) {
      const u = skirush_users[playerName];
      u.coins = game.coins; // update total coins
      if (sc > (u.best || 0)) {
        u.best = sc;
        isRecord = true;
      }
      saveUserDB();
      updateRanking();
    }

    if (isRecord) {
      ui.best.textContent = skirush_users[playerName].best; show(ui.newRecord);
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
  function isPositionFree(x, y, radius) {
    for (let i = 0; i < obstacles.length; i++) {
      const g = obGeom(obstacles[i]);
      if (Math.hypot(obstacles[i].x - x, g.cy - y) < radius + g.rad + 20 * S) return false;
    }
    return true;
  }

  function spawnObstacle() {
    const biome = BIOMES[currentBiome];
    // Filter obstacles by biome category
    const allowedIndices = A.obMeta
      .map((o, i) => ({ idx: i, cat: o.cat }))
      .filter(o => biome.obstacleCats.includes(o.cat))
      .map(o => o.idx);
    if (allowedIndices.length === 0) return;
    // Weighted pick from allowed
    const pool = [];
    allowedIndices.forEach(i => { for (let k = 0; k < (A.obMeta[i].w8 || 1); k++) pool.push(i); });
    const idx = pool[(Math.random() * pool.length) | 0];
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
      if (!isPositionFree(cx, cy + oy, 16 * S)) continue; // Pula a moeda se cair na pedra
      coins.push({ x: cx, y: cy + oy, taken: false, seed: Math.random() * 10 });
    }
  }
  function spawnPowerup() {
    const names = Object.keys(POWER_DEFS);
    const name = names[(Math.random() * names.length) | 0];
    let px = 40 * S + Math.random() * (W - 80 * S);
    let py = H + 60 * S;
    for (let i = 0; i < 5; i++) {
      if (isPositionFree(px, py, 20 * S)) {
        powerups.push({ x: px, y: py, name, phase: Math.random() * 6.28 });
        break;
      }
      px = 40 * S + Math.random() * (W - 80 * S);
      py += 10 * S;
    }
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

    // ---- Biome update ----
    for (let i = BIOMES.length - 1; i >= 0; i--) {
      if (game.distance >= BIOMES[i].start) { currentBiome = i; break; }
    }

    // ---- Combo timer ----
    if (game.coinCombo > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) { game.coinCombo = 0; }
    }

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

    // ---- Rastro na neve ----
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
        c.taken = true; game.coins++; 
        // Combo logic
        game.coinCombo++;
        game.comboTimer = 1.5; // 1.5s to catch next coin
        if (game.coinCombo > game.maxCombo) game.maxCombo = game.coinCombo;
        const comboMult = Math.min(game.coinCombo, 10); // max 10x
        game.score += 10 * mult * comboMult;
        burst(c.x, c.y, '#ffcf3f', 8, 120); sfx('coin');
        // Floating combo text
        if (game.coinCombo > 1) {
          floatingTexts.push({
            x: c.x, y: c.y - 20 * S,
            text: 'x' + game.coinCombo, life: 1, color: '#ff9a3c',
          });
        }
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
          // Reset combo on crash
          game.coinCombo = 0;
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
    // ---- GC Otimizado: Filtro in-place ----
    let oIdx = 0; for(let i=0; i<obstacles.length; i++) if (obstacles[i].y > -260 * S) obstacles[oIdx++] = obstacles[i]; obstacles.length = oIdx;
    let cIdx = 0; for(let i=0; i<coins.length; i++) if (coins[i].y > -40 && !coins[i].taken) coins[cIdx++] = coins[i]; coins.length = cIdx;
    let pIdx = 0; for(let i=0; i<powerups.length; i++) if (powerups[i].y > -60 && !powerups[i].taken) powerups[pIdx++] = powerups[i]; powerups.length = pIdx;

    // ---- Partículas ----
    for (const pt of particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 200 * S * dt; pt.life -= pt.decay * dt; }
    let ptIdx = 0; for(let i=0; i<particles.length; i++) if (particles[i].life > 0) particles[ptIdx++] = particles[i]; particles.length = ptIdx;

    let tIdx = 0; for(let i=0; i<trails.length; i++) if (trails[i].life > 0) trails[tIdx++] = trails[i]; trails.length = tIdx;

    // ---- Textos flutuantes ----
    for (const ft of floatingTexts) { ft.y -= 60 * S * dt; ft.life -= dt * 1.2; }
    let ftIdx = 0; for(let i=0; i<floatingTexts.length; i++) if (floatingTexts[i].life > 0) floatingTexts[ftIdx++] = floatingTexts[i]; floatingTexts.length = ftIdx;

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
    // Combo display
    let comboEl = document.getElementById('combo-hud');
    if (game.coinCombo > 1) {
      if (!comboEl) {
        comboEl = document.createElement('div');
        comboEl.id = 'combo-hud';
        comboEl.style.cssText = 'position:absolute;top:60px;left:50%;transform:translateX(-50%);background:rgba(255,154,60,0.9);color:#fff;padding:4px 12px;border-radius:20px;font-weight:800;font-size:16px;z-index:15;pointer-events:none;box-shadow:0 4px 16px rgba(255,154,60,0.4);animation:pulse 0.5s infinite;';
        document.getElementById('game-wrapper').appendChild(comboEl);
        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = '@keyframes pulse { 0%,100%{transform:translateX(-50%) scale(1);} 50%{transform:translateX(-50%) scale(1.05);} }';
        document.head.appendChild(style);
      }
      comboEl.textContent = '🔥 x' + game.coinCombo + ' COMBO!';
      comboEl.style.display = 'block';
    } else if (comboEl) {
      comboEl.style.display = 'none';
    }
  }
  let powerbarCache = '';
  function updatePowerbar() {
    let structureHtml = '';
    let hasPower = false;
    for (const k in POWER_DEFS) {
      if (power[k] > 0) {
        hasPower = true;
        const def = POWER_DEFS[k];
        structureHtml += `<div class="power-chip" style="background:${def.color}dd">`
              + `<span>${def.icon} ${def.label}</span>`
              + `<span class="timer"></span></div>`;
      }
    }
    if (structureHtml !== powerbarCache) {
      ui.powerbar.innerHTML = structureHtml;
      powerbarCache = structureHtml;
      if (hasPower) show(ui.powerbar);
      else hide(ui.powerbar);
    }
    
    if (hasPower) {
      const chips = ui.powerbar.querySelectorAll('.power-chip .timer');
      let i = 0;
      for (const k in POWER_DEFS) {
        if (power[k] > 0 && chips[i]) {
          chips[i].textContent = Math.ceil(power[k]) + 's';
          i++;
        }
      }
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
    if (state === 'playing' || state === 'paused' || state === 'countdown') {
      drawSkier();
    } else if (state === 'gameover') {
      drawFallenSkier();
    }
    drawParticles();
    drawFloatingTexts();

    ctx.restore();
    if (game.flashTime > 0) { ctx.fillStyle = `rgba(255,255,255,${game.flashTime * 0.6})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawFallenSkier() {
    const frames = getSkierFrames(skier.skin);
    const img = frames.gameOver;
    if (!img) return;
    const h = 90 * S, w = img.width * h / img.height;
    // Fallen position (center bottom-ish)
    const fx = W / 2;
    const fy = H * 0.65;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(-Math.PI / 6); // tilted
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    // Snow burst around
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 30 * S + Math.random() * 40 * S;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * r, fy + Math.sin(a) * r, (2 + Math.random() * 4) * S, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.random() * 0.3})`;
      ctx.fill();
    }
  }

  function drawBackground() {
    const biome = BIOMES[currentBiome];
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    const baseColor = biome.bgColor;
    // Darken with distance
    const distFactor = Math.min(game.distance / 20000, 0.3);
    grad.addColorStop(0, shadeColor(baseColor, -20 * distFactor));
    grad.addColorStop(1, shadeColor(baseColor, 10 * distFactor));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Background image (snow_bg) with biome tint
    const img = A.bg;
    if (img) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      const dh = img.height * (W / img.width);
      let off = game.bgScroll % dh;
      for (let y = off - dh; y < H; y += dh) ctx.drawImage(img, 0, Math.round(y), W, Math.ceil(dh) + 1);
      ctx.restore();
    }

    // Track edges with biome color
    ctx.fillStyle = biome.edgeColor;
    ctx.fillRect(0, 0, 3 * S, H); ctx.fillRect(W - 3 * S, 0, 3 * S, H);

    // Biome name indicator (brief)
    if (game.distance < 300 || (game.distance % 5000 < 100 && game.distance > 100)) {
      ctx.save();
      ctx.font = `700 ${Math.round(16 * S)}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText(biome.name.toUpperCase(), W / 2, 50 * S);
      ctx.restore();
    }
  }

  function shadeColor(hex, percent) {
    const num = parseInt(hex.slice(1), 16);
    const amt = Math.round(percent);
    const r = Math.max(0, Math.min(255, (num >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amt));
    const b = Math.max(0, Math.min(255, (num & 0xFF) + amt));
    return `rgb(${r},${g},${b})`;
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
    const frames = getSkierFrames(skier.skin);
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
    if (absLean > 0.15 && frames.left && frames.left.length > 0) {
      const frameArr = skier.lean < 0 ? frames.left : frames.right;
      img = frameArr[skier.animFrame % frameArr.length];
    } else {
      img = frames.down;
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
    if (dt < 0) dt = 0;
    if (dt > 0.05) dt = 0.05;
    try {
      if (state === 'playing') { update(dt); render(); }
      else if (state === 'paused' || state === 'gameover' || state === 'countdown') { render(); }
    } catch(err) {
      console.error("Game loop error:", err);
      document.body.innerHTML = '<div style="color:white; background:red; padding:20px; font-size:18px; position:absolute; z-index:99999; top:0; left:0; width:100%; height:100%; font-family:monospace;"><h3>CRASH LOG:</h3><pre>' + err.stack + '</pre></div>';
      state = 'error';
    }
    if (state !== 'error') {
      requestAnimationFrame(loop);
    }
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
