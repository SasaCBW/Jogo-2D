
"use strict";

// ============================================
// EXPEDIÇÃO DOS CRISTAIS
// Motor principal do jogo
// ============================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("scoreValue");
const livesElement = document.getElementById("livesValue");
const timerElement = document.getElementById("timerValue");
const levelElement = document.getElementById("levelValue");
const levelNameElement = document.getElementById("levelName");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const gameMessage = document.getElementById("gameMessage");

const overlay = document.getElementById("screenOverlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayDescription = document.getElementById("overlayDescription");
const overlayEyebrow = document.getElementById("overlayEyebrow");
const overlaySymbol = document.getElementById("overlaySymbol");
const mainActionButton = document.getElementById("mainActionButton");

const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const soundButton = document.getElementById("soundButton");

// Dimensões do mundo
const WORLD_WIDTH = canvas.width;
const WORLD_HEIGHT = canvas.height;

// Configuração das fases
const LEVELS = [
  {
    name: "FLORESTA MÁGICA",
    target: 10,
    enemies: 3,
    enemySpeed: 1.25,
    time: 60,
    ground: "#183a32",
    groundDetail: "#285344"
  },
  {
    name: "CAVERNA MISTERIOSA",
    target: 12,
    enemies: 5,
    enemySpeed: 1.65,
    time: 65,
    ground: "#282541",
    groundDetail: "#45406b"
  },
  {
    name: "TEMPLO DOS CRISTAIS",
    target: 15,
    enemies: 7,
    enemySpeed: 2,
    time: 75,
    ground: "#3b2844",
    groundDetail: "#67416e"
  }
];

// Estado do jogo
let gameState = "menu";
let currentLevel = 0;
let score = 0;
let lives = 3;
let timeLeft = 60;
let collected = 0;
let lastTime = 0;
let timerAccumulator = 0;
let soundEnabled = true;
let animationFrame = null;

// Controles
const keys = {
  up: false,
  down: false,
  left: false,
  right: false
};

// Objetos do jogo
let player;
let crystals = [];
let enemies = [];
let particles = [];
let decorations = [];
let portal = null;

// ============================================
// ÁUDIO
// ============================================

let audioContext = null;

function playSound(frequency = 440, duration = 0.1, type = "sine") {
  if (!soundEnabled) return;

  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.warn("Áudio indisponível:", error);
  }
}

soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.textContent = soundEnabled ? "🔊" : "🔇";

  if (soundEnabled) {
    playSound(650, 0.12);
  }
});

// ============================================
// UTILITÁRIOS
// ============================================

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function circleCollision(a, b) {
  return distance(a, b) < a.radius + b.radius;
}

function randomPosition(radius = 15) {
  return {
    x: random(55 + radius, WORLD_WIDTH - 55 - radius),
    y: random(55 + radius, WORLD_HEIGHT - 55 - radius)
  };
}

// ============================================
// JOGADOR
// ============================================

function createPlayer() {
  return {
    x: 100,
    y: WORLD_HEIGHT / 2,
    radius: 17,
    speed: 3.6,
    direction: 1,
    invulnerable: 0,
    animation: 0,
    moving: false
  };
}

function updatePlayer(delta) {
  if (!player || gameState !== "playing") return;

  let dx = 0;
  let dy = 0;

  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;

  const magnitude = Math.hypot(dx, dy);

  player.moving = magnitude > 0;

  if (magnitude > 0) {
    dx /= magnitude;
    dy /= magnitude;

    player.x += dx * player.speed * delta;
    player.y += dy * player.speed * delta;

    if (dx !== 0) {
      player.direction = dx > 0 ? 1 : -1;
    }

    player.animation += delta * 0.015;
  }

  player.x = clamp(player.x, 24, WORLD_WIDTH - 24);
  player.y = clamp(player.y, 24, WORLD_HEIGHT - 24);

  if (player.invulnerable > 0) {
    player.invulnerable -= delta;
  }
}

function drawPlayer() {
  if (!player) return;

  if (player.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
    return;
  }

  const bounce = player.moving
    ? Math.sin(player.animation) * 3
    : 0;

  ctx.save();
  ctx.translate(player.x, player.y + bounce);
  ctx.scale(player.direction, 1);

  // Sombra
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.ellipse(0, 17, 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Corpo
  ctx.fillStyle = "#e6b47b";
  ctx.fillRect(-11, -5, 22, 22);

  // Roupa
  ctx.fillStyle = "#7659d8";
  ctx.fillRect(-12, 3, 24, 14);

  // Capa
  ctx.fillStyle = "#513b9d";
  ctx.fillRect(-15, 5, 6, 13);

  // Cabeça
  ctx.fillStyle = "#f1c99d";
  ctx.fillRect(-10, -17, 20, 17);

  // Cabelo
  ctx.fillStyle = "#49302b";
  ctx.fillRect(-11, -20, 22, 8);
  ctx.fillRect(-13, -15, 5, 8);

  // Olho
  ctx.fillStyle = "#28243a";
  ctx.fillRect(5, -11, 3, 3);

  // Detalhe
  ctx.fillStyle = "#e5d3ff";
  ctx.fillRect(-5, 8, 10, 3);

  // Pernas
  ctx.fillStyle = "#d5a36d";
  ctx.fillRect(-9, 15, 7, 7);
  ctx.fillRect(3, 15, 7, 7);

  ctx.restore();
}

// ============================================
// CRISTAIS
// ============================================

function createCrystals() {
  crystals = [];

  const target = LEVELS[currentLevel].target;

  for (let i = 0; i < target; i++) {
    let position;
    let attempts = 0;

    do {
      position = randomPosition(12);
      attempts++;
    } while (
      attempts < 100 &&
      (
        distance(position, player) < 90 ||
        crystals.some(crystal => distance(position, crystal) < 35)
      )
    );

    crystals.push({
      ...position,
      radius: 11,
      collected: false,
      phase: random(0, Math.PI * 2),
      color: ["#73eaff", "#bd91ff", "#75ffc6"][i % 3]
    });
  }
}

function drawCrystal(crystal) {
  const pulse = Math.sin(Date.now() * 0.004 + crystal.phase) * 3;

  ctx.save();
  ctx.translate(crystal.x, crystal.y);

  ctx.shadowColor = crystal.color;
  ctx.shadowBlur = 18;

  ctx.fillStyle = crystal.color;

  ctx.beginPath();
  ctx.moveTo(0, -16 - pulse);
  ctx.lineTo(10, -3);
  ctx.lineTo(7, 12);
  ctx.lineTo(0, 17);
  ctx.lineTo(-7, 12);
  ctx.lineTo(-10, -3);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.beginPath();
  ctx.moveTo(-3, -9);
  ctx.lineTo(1, -12);
  ctx.lineTo(2, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function updateCrystals() {
  for (const crystal of crystals) {
    if (crystal.collected) continue;

    if (circleCollision(player, crystal)) {
      crystal.collected = true;
      collected++;
      score += 10;

      updateInterface();
      createParticles(crystal.x, crystal.y, crystal.color, 14);
      playSound(700 + collected * 20, 0.12);

      gameMessage.textContent = "Cristal mágico coletado!";

      if (collected >= LEVELS[currentLevel].target) {
        openPortal();
      }
    }
  }
}

// ============================================
// INIMIGOS
// ============================================

function createEnemies() {
  enemies = [];

  const config = LEVELS[currentLevel];

  for (let i = 0; i < config.enemies; i++) {
    let position;
    let attempts = 0;

    do {
      position = randomPosition(16);
      attempts++;
    } while (
      attempts < 100 &&
      distance(position, player) < 150
    );

    enemies.push({
      ...position,
      radius: 15,
      speed: config.enemySpeed * random(0.85, 1.15),
      direction: random(0, Math.PI * 2),
      changeDirection: random(1, 3),
      animation: random(0, 10),
      color: ["#ff6c85", "#f2a05c", "#b78aff"][i % 3]
    });
  }
}

function updateEnemies(delta) {
  for (const enemy of enemies) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);

    enemy.changeDirection -= delta / 1000;

    if (dist < 220 && dist > 0) {
      enemy.direction = Math.atan2(dy, dx);
    } else if (enemy.changeDirection <= 0) {
      enemy.direction = random(0, Math.PI * 2);
      enemy.changeDirection = random(1, 3);
    }

    const movementSpeed = enemy.speed * delta;

    enemy.x += Math.cos(enemy.direction) * movementSpeed;
    enemy.y += Math.sin(enemy.direction) * movementSpeed;

    if (enemy.x < 25 || enemy.x > WORLD_WIDTH - 25) {
      enemy.direction = Math.PI - enemy.direction;
    }

    if (enemy.y < 25 || enemy.y > WORLD_HEIGHT - 25) {
      enemy.direction = -enemy.direction;
    }

    enemy.x = clamp(enemy.x, 25, WORLD_WIDTH - 25);
    enemy.y = clamp(enemy.y, 25, WORLD_HEIGHT - 25);

    enemy.animation += delta * 0.012;

    if (
      circleCollision(player, enemy) &&
      player.invulnerable <= 0
    ) {
      damagePlayer();
    }
  }
}

function drawEnemy(enemy) {
  const bounce = Math.sin(enemy.animation) * 3;

  ctx.save();
  ctx.translate(enemy.x, enemy.y + bounce);

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.ellipse(0, 15, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = enemy.color;
  ctx.beginPath();
  ctx.arc(0, 0, 15, Math.PI, 0);
  ctx.lineTo(15, 9);
  ctx.quadraticCurveTo(0, 23, -15, 9);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.fillRect(-8, -1, 6, 8);
  ctx.fillRect(3, -1, 6, 8);

  ctx.fillStyle = "#292338";
  ctx.fillRect(-6, 2, 3, 4);
  ctx.fillRect(5, 2, 3, 4);

  ctx.restore();
}

// ============================================
// COLISÃO E VIDAS
// ============================================

function damagePlayer() {
  lives--;

  player.invulnerable = 1600;

  createParticles(player.x, player.y, "#ff708d", 18);

  playSound(170, 0.3, "sawtooth");

  gameMessage.textContent = "Cuidado! Você perdeu uma vida.";

  updateInterface();

  if (lives <= 0) {
    finishGame(false);
  }
}

// ============================================
// PORTAL
// ============================================

function openPortal() {
  if (portal) return;

  portal = {
    x: WORLD_WIDTH - 90,
    y: WORLD_HEIGHT / 2,
    radius: 28,
    phase: 0
  };

  gameMessage.textContent = "Portal aberto! Encontre a saída!";
  playSound(880, 0.5);
}

function drawPortal() {
  if (!portal) return;

  portal.phase += 0.04;

  const pulse = Math.sin(portal.phase) * 5;

  ctx.save();
  ctx.translate(portal.x, portal.y);

  ctx.shadowColor = "#ba85ff";
  ctx.shadowBlur = 25;

  ctx.strokeStyle = "#a67bff";
  ctx.lineWidth = 7;

  ctx.beginPath();
  ctx.ellipse(0, 0, 24 + pulse, 38 + pulse, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(145,93,255,.2)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();

  if (circleCollision(player, portal)) {
    nextLevel();
  }
}

// ============================================
// PARTÍCULAS
// ============================================

function createParticles(x, y, color, amount) {
  for (let i = 0; i < amount; i++) {
    const angle = random(0, Math.PI * 2);
    const speed = random(1, 4);

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: random(350, 800),
      maxLife: 800,
      size: random(2, 5),
      color
    });
  }
}

function updateParticles(delta) {
  particles = particles.filter(particle => {
    particle.x += particle.vx * delta / 16;
    particle.y += particle.vy * delta / 16;
    particle.vy += 0.02 * delta / 16;
    particle.life -= delta;

    return particle.life > 0;
  });
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;

    ctx.fillRect(
      particle.x,
      particle.y,
      particle.size,
      particle.size
    );
  }

  ctx.globalAlpha = 1;
}

// ============================================
// CENÁRIO
// ============================================

function createDecorations() {
  decorations = [];

  for (let i = 0; i < 100; i++) {
    decorations.push({
      x: random(0, WORLD_WIDTH),
      y: random(0, WORLD_HEIGHT),
      size: random(2, 5),
      type: Math.random() > 0.5 ? "grass" : "flower",
      color: randomColor()
    });
  }
}

function randomColor() {
  const palette = ["#a3d977", "#f6ce78", "#b78aff", "#75d7d0"];
  return palette[Math.floor(Math.random() * palette.length)];
}

function drawWorld() {
  const config = LEVELS[currentLevel];

  ctx.fillStyle = config.ground;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Textura do terreno
  ctx.fillStyle = config.groundDetail;

  for (let x = 0; x < WORLD_WIDTH; x += 48) {
    for (let y = 0; y < WORLD_HEIGHT; y += 48) {
      if ((x + y) % 96 === 0) {
        ctx.fillRect(x + 9, y + 12, 5, 5);
        ctx.fillRect(x + 27, y + 31, 3, 3);
      }
    }
  }

  // Decoração
  for (const decoration of decorations) {
    ctx.fillStyle = decoration.color;

    if (decoration.type === "grass") {
      ctx.fillRect(
        decoration.x,
        decoration.y,
        decoration.size,
        decoration.size * 2
      );
    } else {
      ctx.beginPath();
      ctx.arc(
        decoration.x,
        decoration.y,
        decoration.size,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // Bordas do mapa
  ctx.strokeStyle = "rgba(255,255,255,.13)";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, WORLD_WIDTH - 8, WORLD_HEIGHT - 8);
}

// ============================================
// INTERFACE
// ============================================

function updateInterface() {
  scoreElement.textContent = score;
  livesElement.textContent = lives;
  timerElement.textContent = Math.max(0, Math.ceil(timeLeft)) + "s";
  levelElement.textContent = (currentLevel + 1) + " / 3";

  progressText.textContent =
    collected + " / " + LEVELS[currentLevel].target;

  progressFill.style.width =
    (collected / LEVELS[currentLevel].target * 100) + "%";
}

// ============================================
// TEMPO
// ============================================

function updateTimer(delta) {
  timerAccumulator += delta;

  while (timerAccumulator >= 1000) {
    timerAccumulator -= 1000;
    timeLeft--;

    updateInterface();

    if (timeLeft <= 0) {
      finishGame(false);
      return;
    }
  }
}

// ============================================
// FASES
// ============================================

function startLevel() {
  const config = LEVELS[currentLevel];

  timeLeft = config.time;
  collected = 0;
  timerAccumulator = 0;

  player = createPlayer();
  crystals = [];
  enemies = [];
  particles = [];
  portal = null;

  createDecorations();
  createCrystals();
  createEnemies();

  levelNameElement.textContent = config.name;

  updateInterface();

  gameMessage.textContent = "Colete os cristais e encontre o portal!";
}

function nextLevel() {
  if (gameState !== "playing") return;

  if (currentLevel < LEVELS.length - 1) {
    currentLevel++;

    playSound(950, 0.4);

    startLevel();
  } else {
    finishGame(true);
  }
}

// ============================================
// ESTADOS DO JOGO
// ============================================

function showOverlay(symbol, eyebrow, title, description, buttonText) {
  overlaySymbol.textContent = symbol;
  overlayEyebrow.textContent = eyebrow;
  overlayTitle.textContent = title;
  overlayDescription.textContent = description;
  mainActionButton.innerHTML = buttonText + " <span>→</span>";

  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function startGame() {
  currentLevel = 0;
  score = 0;
  lives = 3;
  gameState = "playing";

  startLevel();
  hideOverlay();

  playSound(520, 0.15);

  lastTime = performance.now();
}

function togglePause() {
  if (gameState === "playing") {
    gameState = "paused";

    showOverlay(
      "Ⅱ",
      "JOGO PAUSADO",
      "Hora de respirar!",
      "Sua aventura está pausada. Quando estiver pronto, continue de onde parou.",
      "CONTINUAR"
    );

    gameMessage.textContent = "Jogo pausado.";
  } else if (gameState === "paused") {
    gameState = "playing";
    hideOverlay();

    gameMessage.textContent = "A aventura continua!";
    lastTime = performance.now();
  }
}

function finishGame(victory) {
  gameState = victory ? "victory" : "gameover";

  if (victory) {
    playSound(1000, 0.5);

    showOverlay(
      "🏆",
      "MISSÃO CONCLUÍDA",
      "Você venceu!",
      "Parabéns! Você completou as três fases e reuniu os cristais mágicos. Pontuação final: " + score,
      "JOGAR NOVAMENTE"
    );

    gameMessage.textContent = "Você concluiu a expedição!";
  } else {
    playSound(120, 0.5, "sawtooth");

    showOverlay(
      "💔",
      "FIM DE JOGO",
      "A aventura terminou!",
      "Não desista! Tente novamente e descubra todos os segredos dos cristais. Pontuação: " + score,
      "TENTAR NOVAMENTE"
    );

    gameMessage.textContent = "Sua expedição terminou.";
  }
}

// ============================================
// CONTROLES DE TECLADO
// ============================================

const keyMap = {
  ArrowUp: "up",
  w: "up",
  ArrowDown: "down",
  s: "down",
  ArrowLeft: "left",
  a: "left",
  ArrowRight: "right",
  d: "right"
};

window.addEventListener("keydown", event => {
  const direction = keyMap[event.key];

  if (direction) {
    event.preventDefault();
    keys[direction] = true;
  }

  if (event.key === "Escape") {
    if (gameState === "playing" || gameState === "paused") {
      togglePause();
    }
  }

  if (
    event.key === " " &&
    (gameState === "menu" || gameState === "gameover" || gameState === "victory")
  ) {
    event.preventDefault();
    startGame();
  }
});

window.addEventListener("keyup", event => {
  const direction = keyMap[event.key];

  if (direction) {
    keys[direction] = false;
  }
});

window.addEventListener("blur", () => {
  Object.keys(keys).forEach(key => {
    keys[key] = false;
  });

  if (gameState === "playing") {
    togglePause();
  }
});

// ============================================
// CONTROLES TOUCH
// ============================================

document.querySelectorAll("[data-direction]").forEach(button => {
  const direction = button.dataset.direction;

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    keys[direction] = true;
    button.setPointerCapture(event.pointerId);
  });

  function release() {
    keys[direction] = false;
  }

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});

// ============================================
// BOTÕES
// ============================================

mainActionButton.addEventListener("click", () => {
  if (gameState === "paused") {
    togglePause();
  } else {
    startGame();
  }
});

pauseButton.addEventListener("click", () => {
  if (gameState === "playing" || gameState === "paused") {
    togglePause();
  }
});

restartButton.addEventListener("click", () => {
  startGame();
});

fullscreenButton.addEventListener("click", async () => {
  const wrapper = document.getElementById("canvasWrapper");

  try {
    if (!document.fullscreenElement) {
      await wrapper.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    gameMessage.textContent = "Tela cheia não disponível neste navegador.";
  }
});

// ============================================
// ATUALIZAÇÃO DO JOGO
// ============================================

function update(delta) {
  if (gameState !== "playing") return;

  updatePlayer(delta);
  updateEnemies(delta);
  updateCrystals();
  updateParticles(delta);
  updateTimer(delta);
}

// ============================================
// DESENHO
// ============================================

function render() {
  drawWorld();

  crystals.forEach(crystal => {
    if (!crystal.collected) {
      drawCrystal(crystal);
    }
  });

  if (portal) {
    drawPortal();
  }

  enemies.forEach(drawEnemy);
  drawParticles();
  drawPlayer();
}

// ============================================
// LOOP PRINCIPAL
// ============================================

function gameLoop(timestamp) {
  const delta = lastTime
    ? Math.min(timestamp - lastTime, 40)
    : 16;

  lastTime = timestamp;

  if (gameState === "playing") {
    update(delta);
  }

  render();

  animationFrame = requestAnimationFrame(gameLoop);
}

// ============================================
// INICIALIZAÇÃO
// ============================================

function initializeGame() {
  player = createPlayer();

  createDecorations();

  render();

  showOverlay(
    "✦",
    "AVENTURA 2D",
    "Expedição dos Cristais",
    "Sua aventura começa em uma floresta cheia de mistérios. Colete cristais, evite os inimigos e descubra os portais.",
    "COMEÇAR A AVENTURA"
  );

  updateInterface();

  lastTime = performance.now();

  if (animationFrame === null) {
    animationFrame = requestAnimationFrame(gameLoop);
  }
}

initializeGame();
