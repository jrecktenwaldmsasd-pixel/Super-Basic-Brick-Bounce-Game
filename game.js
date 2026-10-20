// ============================================================
// BLOCK BREAKER (base game)
//
// game.js  = the canvas, the ball, the paddle, and the game loop
// bricks.js     = where the bricks are and how they are drawn
// collisions.js = what happens when the ball touches things
// ============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;   // 600
const HEIGHT = canvas.height; // 450

const GameState = {
  score: 0,
  lives: 3
};

let audioContext = null;

function ensureAudioContext() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }
    audioContext = new AudioCtor();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playTone(frequency, duration = 0.08, volume = 0.05, type = "sine", sweep = 0) {
  if (soundMuted) {
    return;
  }

  const context = ensureAudioContext();
  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  if (sweep !== 0) {
    oscillator.frequency.linearRampToValueAtTime(
      frequency + sweep,
      context.currentTime + duration
    );
  }

  gainNode.gain.setValueAtTime(0.0001, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

function playPaddleSound() {
  playTone(220, 0.08, 0.05, "triangle", 90);
}

function playWallSound() {
  playTone(170, 0.05, 0.04, "square", -60);
}

function playBrickSound() {
  playTone(390, 0.07, 0.05, "square", 160);
}

function playWinSound() {
  playTone(523.25, 0.12, 0.06, "triangle", 100);
  setTimeout(() => playTone(659.25, 0.12, 0.06, "triangle", 120), 70);
  setTimeout(() => playTone(783.99, 0.16, 0.06, "triangle", 140), 140);
}

function playLoseSound() {
  playTone(220, 0.18, 0.06, "sawtooth", -180);
  setTimeout(() => playTone(130.81, 0.28, 0.06, "sawtooth", -120), 120);
}


// ------------------------------------------------------------
// THE BALL
// x and y are the top-left corner. vx and vy are how many pixels
// the ball moves each update (vx = sideways, vy = up/down).
// A positive vy means the ball is moving DOWN the screen.
// ------------------------------------------------------------
const BALL_SPEED = 4;
const MAX_BALL_SPEED = 7;
const BASE_PADDLE_WIDTH = 90;
const POWER_UP_TYPES = ["life", "paddle", "slow", "multi"];
const DIFFICULTIES = {
  easy: { speedMultiplier: 0.8, startingLives: 5 },
  normal: { speedMultiplier: 1, startingLives: 3 },
  hard: { speedMultiplier: 1.2, startingLives: 2 }
};
let selectedDifficulty = "normal";
let level = 1;

function getCurrentBallSpeed() {
  return Math.min(
    (BALL_SPEED + (level - 1) * 0.4) * DIFFICULTIES[selectedDifficulty].speedMultiplier,
    MAX_BALL_SPEED
  );
}

function makeBall(
  x = WIDTH / 2,
  y = HEIGHT / 2,
  vx = BALL_SPEED,
  vy = BALL_SPEED,
  speedMultiplier = 1
) {
  return {
    component: {
      ...component,
      x,
      y,
      width: 12,
      height: 12,
      vx,
      vy,
      speedMultiplier
    }
  };
}

const ball = makeBall();
let balls = [ball];
let ballLaunched = false;
let paddleBoostTimer = 0;
let slowBallTimer = 0;
const powerUps = [];

function resetBall() {
  const nextBall = makeBall(
    paddle.component.x + (paddle.component.width - 12) / 2,
    paddle.component.y - 12,
    0,
    0
  );
  ball.component = nextBall.component;
  balls = [ball];
  ballLaunched = false;
}

function applyBallSpeedSettings() {
  const baseSpeed = getCurrentBallSpeed();

  for (const activeBall of balls) {
    const ballData = activeBall.component;
    const currentSpeed = Math.hypot(ballData.vx, ballData.vy);
    const angle = currentSpeed === 0
      ? Math.PI / 4
      : Math.atan2(ballData.vy, ballData.vx);
    const targetSpeed = Math.min(
      MAX_BALL_SPEED,
      baseSpeed * (slowBallTimer > 0 ? 0.7 : 1) * ballData.speedMultiplier
    );
    ballData.vx = Math.cos(angle) * targetSpeed;
    ballData.vy = Math.sin(angle) * targetSpeed;
  }
}

function spawnMultiball() {
  const newBalls = [];
  const currentBalls = [...balls];

  for (const activeBall of currentBalls) {
    const ballData = activeBall.component;
    const angle = Math.atan2(ballData.vy, ballData.vx);
    const speed = Math.hypot(ballData.vx, ballData.vy) || BALL_SPEED;
    const leftAngle = angle - 0.65;
    const rightAngle = angle + 0.65;

    newBalls.push(makeBall(
      ballData.x,
      ballData.y,
      Math.cos(leftAngle) * speed,
      Math.sin(leftAngle) * speed,
      ballData.speedMultiplier
    ));
    newBalls.push(makeBall(
      ballData.x,
      ballData.y,
      Math.cos(rightAngle) * speed,
      Math.sin(rightAngle) * speed,
      ballData.speedMultiplier
    ));
  }

  balls.push(...newBalls);
}


// ------------------------------------------------------------
// THE PADDLE
// ------------------------------------------------------------
const paddle = {
  component: {
    ...component,
    x: WIDTH / 2 - 45,
    y: HEIGHT - 30,
    width: BASE_PADDLE_WIDTH,
    height: 12,
    speed: 6,
    controlled: true
  }
};

function centerPaddle() {
  paddle.component.x = (WIDTH - paddle.component.width) / 2;
}

const stars = [];
for (let i = 0; i < 220; i++) {
  stars.push({
    x: Math.random() * WIDTH,
    y: Math.random() * HEIGHT,
    radius: Math.random() * 2.4 + 0.8,
    alpha: Math.random() * 0.9 + 0.2
  });
}

const moon = {
  radius: 30,
  orbitRadius: 180,
  angle: 0.9,
  speed: 0.0024,
  wobble: 0
};

const shootingStars = [];
for (let i = 0; i < 6; i++) {
  shootingStars.push({
    x: Math.random() * WIDTH,
    y: Math.random() * HEIGHT * 0.55,
    length: 40 + Math.random() * 80,
    speed: 5 + Math.random() * 5,
    angle: -Math.PI / 2 - (Math.random() * 0.5 - 0.25),
    active: false,
    timer: Math.random() * 300
  });
}

const particles = [];
let shakeTimer = 0;

function rainbowColor(t) {
  const hue = (t * 360) % 360;
  return `hsl(${hue}, 100%, 65%)`;
}

function createParticleBurst(x, y, color) {
  for (let i = 0; i < 18; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      size: Math.random() * 3 + 2,
      life: 24 + Math.random() * 20,
      color
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.08;
    particle.life -= 1;

    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function spawnPowerUp(x, y) {
  const type = POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
  powerUps.push({
    type,
    x,
    y,
    size: 12,
    speed: 1.5,
    color: {
      life: "#fbbf24",
      paddle: "#34d399",
      slow: "#60a5fa",
      multi: "#f472b6"
    }[type]
  });
}

function updatePowerUps() {
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const powerUp = powerUps[i];
    powerUp.y += powerUp.speed;

    if (powerUp.y > HEIGHT + powerUp.size) {
      powerUps.splice(i, 1);
    }
  }
}

function activatePowerUp(type) {
  if (type === "life") {
    GameState.lives += 1;
    updateLivesDisplay();
    return;
  }

  if (type === "paddle") {
    paddle.component.width = BASE_PADDLE_WIDTH * 1.5;
    paddleBoostTimer = 600;
    paddle.component.x = Math.min(paddle.component.x, WIDTH - paddle.component.width);
    return;
  }

  if (type === "slow") {
    slowBallTimer = 600;
    return;
  }

  if (type === "multi") {
    spawnMultiball();
  }
}

function drawPowerUps() {
  for (const powerUp of powerUps) {
    ctx.fillStyle = powerUp.color;
    ctx.fillRect(powerUp.x - powerUp.size / 2, powerUp.y - powerUp.size / 2, powerUp.size, powerUp.size);

    ctx.fillStyle = "#020617";
    ctx.font = "bold 10px Courier New";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const labels = {
      life: "+",
      paddle: "P",
      slow: "S",
      multi: "M"
    };

    ctx.fillText(labels[powerUp.type], powerUp.x, powerUp.y + 1);
  }
}

// ------------------------------------------------------------
// THE BRICKS (the list is filled in by makeBricks() in bricks.js)
// ------------------------------------------------------------
let bricks = [];
let paused = false;
let won = false;
let state = "start";
let soundMuted = localStorage.getItem("brick-breaker-muted") === "true";

const overlay = document.getElementById("gameOverlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const overlayButton = document.getElementById("overlayButton");
const livesValue = document.getElementById("livesValue");
const scoreValue = document.getElementById("scoreValue");
const bestScoreValue = document.getElementById("bestScoreValue");
const levelValue = document.getElementById("levelValue");
const difficultySelect = document.getElementById("difficultySelect");
const difficultyControl = difficultySelect.closest(".difficulty-control");
const muteButton = document.getElementById("muteButton");

function updateMuteButton() {
  muteButton.textContent = soundMuted ? "Sound: Off" : "Sound: On";
  muteButton.setAttribute("aria-pressed", String(soundMuted));
}

muteButton.addEventListener("click", function () {
  soundMuted = !soundMuted;
  localStorage.setItem("brick-breaker-muted", String(soundMuted));
  updateMuteButton();
});

let bestScore = Number(localStorage.getItem("brick-breaker-best-score") || 0);

function updateLivesDisplay() {
  if (livesValue) {
    livesValue.textContent = String(GameState.lives);
  }
}

function updateScoreDisplay() {
  if (scoreValue) {
    scoreValue.textContent = String(GameState.score);
  }

  if (bestScoreValue) {
    bestScoreValue.textContent = String(bestScore);
  }
}

function updateLevelDisplay() {
  if (levelValue) {
    levelValue.textContent = String(level);
  }
}

function updateBestScore() {
  if (GameState.score > bestScore) {
    bestScore = GameState.score;
    localStorage.setItem("brick-breaker-best-score", String(bestScore));
  }
  updateScoreDisplay();
}

function showOverlay(title, message, buttonText) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlayButton.textContent = buttonText;
  difficultyControl.hidden = title !== "READY?" && title !== "GAME OVER";
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function startNewGame() {
  selectedDifficulty = difficultySelect.value;
  GameState.lives = DIFFICULTIES[selectedDifficulty].startingLives;
  GameState.score = 0;
  level = 1;
  paddleBoostTimer = 0;
  slowBallTimer = 0;
  shakeTimer = 0;
  paddle.component.width = BASE_PADDLE_WIDTH;
  centerPaddle();
  powerUps.length = 0;
  updateLivesDisplay();
  updateScoreDisplay();
  updateLevelDisplay();
  updateMuteButton();
  paused = false;
  won = false;
  state = "playing";
  bricks = makeBricks(level);
  resetBall();
  hideOverlay();
}

function startNextLevel() {
  level += 1;
  updateLevelDisplay();
  bricks = makeBricks(level);
  powerUps.length = 0;
  resetBall();
  state = "playing";
  hideOverlay();
}

function launchBall(shouldLaunch = true) {
  if (state === "start" || state === "gameOver") {
    startNewGame();
  } else if (state === "levelComplete") {
    startNextLevel();
  } else if (state === "paused") {
    paused = false;
    state = "playing";
    hideOverlay();
  }

  if (!shouldLaunch || state !== "playing" || ballLaunched) {
    return;
  }

  const horizontalSpeed = (Math.random() < 0.5 ? -0.35 : 0.35) * getCurrentBallSpeed();
  ball.component.vx = horizontalSpeed;
  ball.component.vy = -Math.sqrt(getCurrentBallSpeed() ** 2 - horizontalSpeed ** 2);
  ballLaunched = true;
}

// ------------------------------------------------------------
// KEYBOARD
// keys["arrowleft"] is true while the left arrow is held down.
// ------------------------------------------------------------
const keys = {};
let pointerControlId = null;
let pointerPaddleX = null;

function getCanvasX(event) {
  const bounds = canvas.getBoundingClientRect();
  return (event.clientX - bounds.left) * (WIDTH / bounds.width);
}

function movePaddleToPointer() {
  if (pointerPaddleX !== null) {
    paddle.component.x = Math.max(
      0,
      Math.min(WIDTH - paddle.component.width, pointerPaddleX - paddle.component.width / 2)
    );
  }
}

canvas.addEventListener("pointerdown", function (event) {
  pointerControlId = event.pointerId;
  pointerPaddleX = getCanvasX(event);
  movePaddleToPointer();
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", function (event) {
  if (event.pointerId === pointerControlId) {
    pointerPaddleX = getCanvasX(event);
    movePaddleToPointer();
  }
});

function stopPointerControl(event) {
  if (event.pointerId === pointerControlId) {
    pointerControlId = null;
    pointerPaddleX = null;
  }
}

canvas.addEventListener("pointerup", stopPointerControl);
canvas.addEventListener("pointercancel", stopPointerControl);

document.addEventListener("keydown", function (event) {
  const key = event.key.toLowerCase();
  keys[key] = true;
  if (!event.repeat && event.code === "Space") {
    launchBall();
    event.preventDefault();
  }
  if (!event.repeat && key === "r" && state === "gameOver") {
    startNewGame();
  }
  if (!event.repeat && key === "p") {
    if (state === "playing") {
      paused = true;
      state = "paused";
      showOverlay("PAUSED", "Press P to resume, or use the button below.", "Resume Game");
    } else if (state === "paused") {
      paused = false;
      state = "playing";
      hideOverlay();
    }
  }
  // Stop the arrow keys from scrolling the page.
  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
  }
});

document.addEventListener("keyup", function (event) {
  keys[event.key.toLowerCase()] = false;
});


// ------------------------------------------------------------
// UPDATE: runs 60 times every second. Move things, then check
// what they touched.
// ------------------------------------------------------------
function update() {
  updateParticles();
  updateShootingStars();
  updatePowerUps();

  if (state !== "playing" || paused || won) {
    if (shakeTimer > 0) {
      shakeTimer -= 1;
    }
    return;
  }

  if (shakeTimer > 0) {
    shakeTimer -= 1;
  }

  if (paddleBoostTimer > 0) {
    paddleBoostTimer -= 1;
    if (paddleBoostTimer <= 0) {
      paddle.component.width = BASE_PADDLE_WIDTH;
      paddle.component.x = Math.min(paddle.component.x, WIDTH - paddle.component.width);
    }
  }

  if (slowBallTimer > 0) {
    slowBallTimer -= 1;
  }

  if (ballLaunched) {
    applyBallSpeedSettings();
  }
  moveBricks();
  system();

  for (const activeBall of [...balls]) {
    bounceOffWalls(activeBall); // collisions.js
    bounceOffPaddle(activeBall); // collisions.js
  }

  for (const activeBall of [...balls]) {
    bounceOffBricks(activeBall); // collisions.js
  }

  for (const powerUp of [...powerUps]) {
    const powerUpBox = {
      component: {
        x: powerUp.x,
        y: powerUp.y,
        width: powerUp.size,
        height: powerUp.size
      }
    };
    if (boxesTouch(powerUpBox, paddle)) {
      activatePowerUp(powerUp.type);
      powerUps.splice(powerUps.indexOf(powerUp), 1);
    }
  }

  if (bricks.length === 0) {
    powerUps.length = 0;
    state = "levelComplete";
    playWinSound();
    showOverlay(
      "LEVEL COMPLETE",
      `Get ready for level ${level + 1}. The ball gets faster and the brick wall grows.`,
      "Next Level"
    );
    return;
  }

  const fallenBalls = balls.filter((activeBall) => activeBall.component.y > HEIGHT);
  if (fallenBalls.length > 0) {
    balls = balls.filter((activeBall) => activeBall.component.y <= HEIGHT);
    if (balls.length === 0) {
      powerUps.length = 0;
      GameState.lives -= 1;
      shakeTimer = 24;
      createParticleBurst(
        paddle.component.x + paddle.component.width / 2,
        HEIGHT - 10,
        "#f87171"
      );
      centerPaddle();
      updateLivesDisplay();

      if (GameState.lives <= 0) {
        state = "gameOver";
        playLoseSound();
        showOverlay("GAME OVER", "The moon won this round. Press R or use the button to try again.", "Restart Game");
        return;
      }

      bricks = makeBricks(level);
      resetBall();
    }
  }
}

function updateShootingStars() {
  for (const star of shootingStars) {
    star.timer -= 1;
    if (star.timer <= 0) {
      star.active = true;
      star.timer = 180 + Math.random() * 240;
      star.x = Math.random() * WIDTH;
      star.y = Math.random() * HEIGHT * 0.55;
      star.length = 40 + Math.random() * 70;
      star.speed = 5 + Math.random() * 4;
      star.angle = -Math.PI / 2 - (Math.random() * 0.5 - 0.25);
    }

    if (star.active) {
      star.x += Math.cos(star.angle) * star.speed;
      star.y += Math.sin(star.angle) * star.speed;

      if (star.x > WIDTH + 100 || star.y > HEIGHT + 100 || star.x < -100 || star.y < -100) {
        star.active = false;
      }
    }
  }
}

function drawGalaxyBackground() {
  const nebulaA = ctx.createRadialGradient(
    WIDTH * 0.2,
    HEIGHT * 0.18,
    10,
    WIDTH * 0.2,
    HEIGHT * 0.18,
    WIDTH * 0.6
  );
  nebulaA.addColorStop(0, "rgba(168, 85, 247, 0.35)");
  nebulaA.addColorStop(0.35, "rgba(59, 130, 246, 0.14)");
  nebulaA.addColorStop(1, "rgba(2, 6, 23, 0)");

  const nebulaB = ctx.createRadialGradient(
    WIDTH * 0.74,
    HEIGHT * 0.28,
    12,
    WIDTH * 0.74,
    HEIGHT * 0.28,
    WIDTH * 0.52
  );
  nebulaB.addColorStop(0, "rgba(236, 72, 153, 0.28)");
  nebulaB.addColorStop(0.4, "rgba(59, 130, 246, 0.12)");
  nebulaB.addColorStop(1, "rgba(2, 6, 23, 0)");

  const galaxy = ctx.createRadialGradient(
    WIDTH * 0.68,
    HEIGHT * 0.3,
    20,
    WIDTH * 0.68,
    HEIGHT * 0.3,
    WIDTH * 0.8
  );
  galaxy.addColorStop(0, "#312e81");
  galaxy.addColorStop(0.35, "#111827");
  galaxy.addColorStop(1, "#020617");

  ctx.fillStyle = galaxy;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = nebulaA;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = nebulaB;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const star of stars) {
    ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const star of shootingStars) {
    if (!star.active) {
      continue;
    }

    const tailX = star.x - Math.cos(star.angle) * star.length;
    const tailY = star.y - Math.sin(star.angle) * star.length;

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(star.x, star.y);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.arc(star.x, star.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(WIDTH / 2, HEIGHT / 2, moon.orbitRadius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMoon() {
  moon.wobble = Math.sin(moon.angle * 4) * 18;
  const radius = moon.orbitRadius + moon.wobble * 0.5;
  const moonX = WIDTH / 2 + Math.cos(moon.angle) * radius;
  const moonY = HEIGHT / 2 + Math.sin(moon.angle) * radius;

  ctx.save();
  ctx.translate(moonX, moonY);

  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, moon.radius + 32);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  glow.addColorStop(0.35, "rgba(191, 219, 254, 0.75)");
  glow.addColorStop(1, "rgba(148, 163, 184, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, moon.radius + 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  ctx.arc(0, 0, moon.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
  ctx.beginPath();
  ctx.arc(-10, -10, 8, 0, Math.PI * 2);
  ctx.arc(10, -5, 6, 0, Math.PI * 2);
  ctx.arc(0, 12, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  moon.angle += moon.speed;
}

// ------------------------------------------------------------
// DRAW: paints everything on the canvas. Black background,
// white shapes.
// ------------------------------------------------------------
function draw() {
  ctx.save();
  if (shakeTimer > 0) {
    const shakeStrength = shakeTimer * 0.65;
    ctx.translate(
      (Math.random() - 0.5) * shakeStrength,
      (Math.random() - 0.5) * shakeStrength
    );
  }

  drawGalaxyBackground();
  drawMoon();

  const hueTime = performance.now() * 0.0007;

  ctx.save();
  ctx.shadowBlur = 26;
  ctx.shadowColor = rainbowColor(hueTime);
  ctx.fillStyle = rainbowColor(hueTime);
  ctx.fillRect(
    paddle.component.x,
    paddle.component.y,
    paddle.component.width,
    paddle.component.height
  );
  ctx.restore();

  for (const activeBall of balls) {
    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = rainbowColor(hueTime + 0.18);
    ctx.fillStyle = rainbowColor(hueTime + 0.18);
    ctx.fillRect(
      activeBall.component.x,
      activeBall.component.y,
      activeBall.component.width,
      activeBall.component.height
    );
    ctx.restore();
  }

  drawBricks();  // bricks.js
  drawPowerUps();

  for (const particle of particles) {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.life / 36);
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  const instructions = document.getElementById("instructions");
  if (instructions) {
    instructions.style.color = rainbowColor(hueTime + 0.42);
    instructions.style.textShadow = `0 0 8px ${rainbowColor(hueTime + 0.42)}`;
  }
}


// ------------------------------------------------------------
// THE GAME LOOP
// The browser calls frame() every time it is ready to draw.
// Some screens are faster than others, so we make sure update()
// always runs exactly 60 times per second on every computer.
// ------------------------------------------------------------
const STEP = 1000 / 60;
let lastTime = 0;
let leftover = 0;

function frame(now) {
  leftover = leftover + (now - lastTime);
  lastTime = now;

  // If the tab was hidden for a while, don't try to catch up.
  if (leftover > 250) {
    leftover = 250;
  }

  while (leftover >= STEP) {
    update();
    leftover = leftover - STEP;
  }

  draw();
  requestAnimationFrame(frame);
}

function start() {
  bricks = makeBricks();  // bricks.js
  resetBall();
  lastTime = performance.now();
  state = "start";
  paused = false;
  won = false;
  GameState.lives = DIFFICULTIES[selectedDifficulty].startingLives;
  GameState.score = 0;
  level = 1;
  powerUps.length = 0;
  paddle.component.width = BASE_PADDLE_WIDTH;
  updateLivesDisplay();
  updateScoreDisplay();
  updateLevelDisplay();
  showOverlay("READY?", "Move with the arrow keys or A and D. Press Space to launch. Press P to pause or resume.", "Start Game");
  requestAnimationFrame(frame);
}

overlayButton.addEventListener("click", function () {
  launchBall(false);
});

// Wait until all three script files have loaded, then start.
window.addEventListener("load", start);
