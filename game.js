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

const ball = {
  component: {
    ...component,
    width: 12,
    height: 12
  }
};

// Put the ball in the center and reset its speed and direction.
function resetBall() {
  ball.component.x = WIDTH / 2 - ball.component.width / 2;
  ball.component.y = HEIGHT / 2 - ball.component.height / 2;
  ball.component.vx = BALL_SPEED;  // right
  ball.component.vy = BALL_SPEED;  // down
}


// ------------------------------------------------------------
// THE PADDLE
// ------------------------------------------------------------
const paddle = {
  component: {
    ...component,
    x: WIDTH / 2 - 45,
    y: HEIGHT - 30,
    width: 90,
    height: 12,
    speed: 6,
    controlled: true
  }
};

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

// ------------------------------------------------------------
// THE BRICKS (the list is filled in by makeBricks() in bricks.js)
// ------------------------------------------------------------
let bricks = [];
let paused = false;
let won = false;
let state = "start";
let lives = 3;

const overlay = document.getElementById("gameOverlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const overlayButton = document.getElementById("overlayButton");

function showOverlay(title, message, buttonText) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlayButton.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function startNewGame() {
  lives = 3;
  paused = false;
  won = false;
  state = "playing";
  bricks = makeBricks();
  resetBall();
  hideOverlay();
}

// ------------------------------------------------------------
// KEYBOARD
// keys["arrowleft"] is true while the left arrow is held down.
// ------------------------------------------------------------
const keys = {};

document.addEventListener("keydown", function (event) {
  const key = event.key.toLowerCase();
  keys[key] = true;
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

  if (state !== "playing" || paused || won) {
    return;
  }

  system();

  bounceOffWalls();   // collisions.js
  bounceOffPaddle();  // collisions.js
  bounceOffBricks();  // collisions.js

  if (bricks.length === 0) {
    won = true;
    state = "won";
    playWinSound();
    showOverlay("YOU WIN!", "All blocks broken — the galaxy is yours.", "Play Again");
    return;
  }

  // The ball fell off the bottom: back to the center.
  if (ball.component.y > HEIGHT) {
    lives = lives - 1;

    if (lives <= 0) {
      state = "gameOver";
      playLoseSound();
      showOverlay("GAME OVER", "The moon won this round. Press R or use the button to try again.", "Restart Game");
      return;
    }

    bricks = makeBricks();
    resetBall();
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

  ctx.save();
  ctx.shadowBlur = 30;
  ctx.shadowColor = rainbowColor(hueTime + 0.18);
  ctx.fillStyle = rainbowColor(hueTime + 0.18);
  ctx.fillRect(
    ball.component.x,
    ball.component.y,
    ball.component.width,
    ball.component.height
  );
  ctx.restore();

  drawBricks();  // bricks.js

  for (const particle of particles) {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.life / 36);
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;

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
  lives = 3;
  showOverlay("READY?", "Move with the arrow keys or A and D. Press P to pause or resume. Press R to restart after game over.", "Start Game");
  requestAnimationFrame(frame);
}

overlayButton.addEventListener("click", function () {
  if (state === "start" || state === "gameOver" || state === "won") {
    startNewGame();
    return;
  }

  if (state === "paused") {
    paused = false;
    state = "playing";
    hideOverlay();
  }
});

// Wait until all three script files have loaded, then start.
window.addEventListener("load", start);
