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
  lives: 3,
  combo: 0
};

const STATS_KEY = "brick-breaker-stats-v1";
const defaultStats = {
  bestScore: 0,
  challengeBestScores: {},
  wins: 0,
  losses: 0,
  achievements: [],
  unlockedCosmetics: ["rainbow", "off"],
  paddleSkin: "rainbow",
  ballTrail: "off"
};

let stats = { ...defaultStats };
let audioContext = null;
const COSMETICS = {
  paddle: [
    { id: "rainbow", label: "Rainbow", requirement: "Always unlocked", unlocked: () => true },
    { id: "solar", label: "Solar", requirement: "Win a run", unlocked: () => stats.wins >= 1 },
    { id: "ice", label: "Ice", requirement: "Best score: 500", unlocked: () => stats.bestScore >= 500 },
    { id: "nova", label: "Nova", requirement: "Defeat a boss", unlocked: () => stats.achievements.includes("boss-breaker") }
  ],
  trail: [
    { id: "off", label: "Off", requirement: "Always unlocked", unlocked: () => true },
    { id: "comet", label: "Comet", requirement: "Win a run", unlocked: () => stats.wins >= 1 },
    { id: "spark", label: "Spark", requirement: "Best score: 1,000", unlocked: () => stats.bestScore >= 1000 },
    { id: "flare", label: "Flare", requirement: "Reach a 12x combo", unlocked: () => stats.achievements.includes("combo-master") }
  ]
};
const ACHIEVEMENTS = [
  { id: "combo-master", name: "Combo Master", description: "Reach a 12x combo.", reward: "Flare ball trail" },
  { id: "boss-breaker", name: "Boss Breaker", description: "Defeat a boss wave.", reward: "Nova paddle" },
  { id: "flawless-level", name: "Untouchable", description: "Clear a level without losing a life.", reward: "Achievement badge" }
];

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) {
      return { ...defaultStats };
    }
    const parsed = JSON.parse(raw);
    return {
      ...defaultStats,
      ...parsed,
      challengeBestScores: parsed.challengeBestScores
        && typeof parsed.challengeBestScores === "object"
        && !Array.isArray(parsed.challengeBestScores)
        ? parsed.challengeBestScores
        : {},
      achievements: Array.isArray(parsed.achievements)
        ? [...new Set(parsed.achievements)]
        : [],
      unlockedCosmetics: Array.isArray(parsed.unlockedCosmetics)
        ? [...new Set(parsed.unlockedCosmetics)]
        : [...defaultStats.unlockedCosmetics]
    };
  } catch (error) {
    return { ...defaultStats };
  }
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function updateStatsDisplay() {
  const winsValue = document.getElementById("winsValue");
  const lossesValue = document.getElementById("lossesValue");
  if (winsValue) {
    winsValue.textContent = String(stats.wins);
  }
  if (lossesValue) {
    lossesValue.textContent = String(stats.losses);
  }
}

function recordRunResult(isWin) {
  if (isWin) {
    stats.wins += 1;
  } else {
    stats.losses += 1;
  }
  if (!challengeMode && GameState.score > stats.bestScore) {
    stats.bestScore = GameState.score;
  }
  refreshCosmeticUnlocks();
  saveStats();
  updateStatsDisplay();
  updateScoreDisplay();
}

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
const POWER_UP_TYPES = ["life", "paddle", "slow", "multi", "shield", "laser"];
const DIFFICULTIES = {
  easy: { speedMultiplier: 0.8, startingLives: 5 },
  normal: { speedMultiplier: 1, startingLives: 3 },
  hard: { speedMultiplier: 1.2, startingLives: 2 }
};
const CHALLENGE_MODIFIERS = [
  { id: "quick-ball", name: "Quick Ball", description: "Ball speed is increased by 25%." },
  { id: "tiny-paddle", name: "Tiny Paddle", description: "Your paddle is 30% narrower." },
  { id: "moving-bricks", name: "Moving Bricks", description: "More bricks move from side to side." }
];
const dailyChallengeDate = new Date().toISOString().slice(0, 10);
const dailyChallengeDay = Math.floor(Date.parse(`${dailyChallengeDate}T00:00:00Z`) / 86400000);
const dailyChallenge = CHALLENGE_MODIFIERS[dailyChallengeDay % CHALLENGE_MODIFIERS.length];
let selectedDifficulty = "normal";
let challengeMode = false;
let level = 1;
let levelWithoutLifeLoss = true;

function getCurrentBallSpeed() {
  return Math.min(
    (BALL_SPEED + (level - 1) * 0.4)
      * DIFFICULTIES[selectedDifficulty].speedMultiplier
      * (challengeMode && dailyChallenge.id === "quick-ball" ? 1.25 : 1),
    MAX_BALL_SPEED
  );
}

function getBasePaddleWidth() {
  return BASE_PADDLE_WIDTH * (
    challengeMode && dailyChallenge.id === "tiny-paddle" ? 0.7 : 1
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
    trail: [],
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
let shieldTimer = 0;
let laserCharges = 0;
const laserShots = [];
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
    width: getBasePaddleWidth(),
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
      multi: "#f472b6",
      shield: "#38bdf8",
      laser: "#f87171"
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
    createParticleBurst(paddle.component.x + paddle.component.width / 2, paddle.component.y, "#fbbf24");
    return;
  }

  if (type === "paddle") {
    paddle.component.width = getBasePaddleWidth() * 1.5;
    paddleBoostTimer = 600;
    paddle.component.x = Math.min(paddle.component.x, WIDTH - paddle.component.width);
    createParticleBurst(paddle.component.x + paddle.component.width / 2, paddle.component.y, "#34d399");
    return;
  }

  if (type === "slow") {
    slowBallTimer = 600;
    createParticleBurst(paddle.component.x + paddle.component.width / 2, paddle.component.y, "#60a5fa");
    return;
  }

  if (type === "multi") {
    spawnMultiball();
    createParticleBurst(paddle.component.x + paddle.component.width / 2, paddle.component.y, "#f472b6");
    return;
  }

  if (type === "shield") {
    shieldTimer = 360;
    createParticleBurst(paddle.component.x + paddle.component.width / 2, paddle.component.y, "#38bdf8");
    return;
  }

  if (type === "laser") {
    laserCharges = Math.min(5, laserCharges + 3);
    updateAbilityControls();
    createParticleBurst(paddle.component.x + paddle.component.width / 2, paddle.component.y, "#f87171");
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
      multi: "M",
      shield: "S",
      laser: "L"
    };

    ctx.fillText(labels[powerUp.type], powerUp.x, powerUp.y + 1);
  }
}

function updateLaserShots() {
  for (let shotIndex = laserShots.length - 1; shotIndex >= 0; shotIndex--) {
    const shot = laserShots[shotIndex];
    shot.y -= shot.speed;

    if (shot.y + shot.height < 0) {
      laserShots.splice(shotIndex, 1);
      continue;
    }

    for (let brickIndex = 0; brickIndex < bricks.length; brickIndex++) {
      if (boxesTouch({ component: shot }, bricks[brickIndex])) {
        hitBrick(bricks[brickIndex], brickIndex);
        laserShots.splice(shotIndex, 1);
        break;
      }
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
let soundMuted = localStorage.getItem("brick-breaker-muted") === "true";

const overlay = document.getElementById("gameOverlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const overlayButton = document.getElementById("overlayButton");
const levelSelectForm = document.getElementById("levelSelectForm");
const levelSelectInput = document.getElementById("levelSelectInput");
const cancelLevelSelect = document.getElementById("cancelLevelSelect");
const livesValue = document.getElementById("livesValue");
const scoreValue = document.getElementById("scoreValue");
const bestScoreValue = document.getElementById("bestScoreValue");
const comboValue = document.getElementById("comboValue");
const levelValue = document.getElementById("levelValue");
const difficultySelect = document.getElementById("difficultySelect");
const difficultyControl = difficultySelect.closest(".difficulty-control");
const challengeControl = document.getElementById("challengeControl");
const challengeModeSelect = document.getElementById("challengeModeSelect");
const challengeInfo = document.getElementById("challengeInfo");
const bestScoreLabel = document.getElementById("bestScoreLabel");
const muteButton = document.getElementById("muteButton");
const laserButton = document.getElementById("laserButton");
const paddleSkinSelect = document.getElementById("paddleSkinSelect");
const ballTrailSelect = document.getElementById("ballTrailSelect");
const unlockStatus = document.getElementById("unlockStatus");
const achievementStatus = document.getElementById("achievementStatus");
const achievementList = document.getElementById("achievementList");

function refreshAchievementDisplay() {
  achievementList.replaceChildren();
  for (const achievement of ACHIEVEMENTS) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const description = document.createElement("span");
    const reward = document.createElement("small");
    const unlocked = stats.achievements.includes(achievement.id);

    item.className = unlocked ? "achievement unlocked" : "achievement";
    title.textContent = `${achievement.name} - ${unlocked ? "Unlocked" : "Locked"}`;
    description.textContent = achievement.description;
    reward.textContent = `Reward: ${achievement.reward}`;
    item.append(title, description, reward);
    achievementList.append(item);
  }

  const unlockedCount = ACHIEVEMENTS.filter((achievement) =>
    stats.achievements.includes(achievement.id)
  ).length;
  achievementStatus.textContent = `${unlockedCount} of ${ACHIEVEMENTS.length} achievements unlocked.`;
}

function unlockAchievements(ids) {
  const newlyUnlocked = ACHIEVEMENTS.filter((achievement) =>
    ids.includes(achievement.id) && !stats.achievements.includes(achievement.id)
  );
  if (newlyUnlocked.length === 0) {
    return;
  }

  stats.achievements.push(...newlyUnlocked.map((achievement) => achievement.id));
  refreshCosmeticUnlocks();
  saveStats();
  refreshAchievementDisplay();
  achievementStatus.textContent = `Achievement unlocked: ${newlyUnlocked
    .map((achievement) => `${achievement.name} (${achievement.reward})`)
    .join("; ")}.`;
}

function updateCosmeticControls() {
  for (const [select, cosmetics, selectedId] of [
    [paddleSkinSelect, COSMETICS.paddle, stats.paddleSkin],
    [ballTrailSelect, COSMETICS.trail, stats.ballTrail]
  ]) {
    select.replaceChildren();
    for (const cosmetic of cosmetics) {
      const option = document.createElement("option");
      option.value = cosmetic.id;
      option.textContent = stats.unlockedCosmetics.includes(cosmetic.id)
        ? cosmetic.label
        : `${cosmetic.label} (${cosmetic.requirement})`;
      option.disabled = !stats.unlockedCosmetics.includes(cosmetic.id);
      select.append(option);
    }
    if (!stats.unlockedCosmetics.includes(selectedId)) {
      if (select === paddleSkinSelect) {
        stats.paddleSkin = "rainbow";
      } else {
        stats.ballTrail = "off";
      }
    }
    select.value = select === paddleSkinSelect ? stats.paddleSkin : stats.ballTrail;
  }
}

function refreshCosmeticUnlocks() {
  const newlyUnlocked = [];
  for (const cosmetic of [...COSMETICS.paddle, ...COSMETICS.trail]) {
    if (cosmetic.unlocked() && !stats.unlockedCosmetics.includes(cosmetic.id)) {
      stats.unlockedCosmetics.push(cosmetic.id);
      if (cosmetic.id !== "rainbow" && cosmetic.id !== "off") {
        newlyUnlocked.push(cosmetic.label);
      }
    }
  }

  if (newlyUnlocked.length > 0) {
    saveStats();
    unlockStatus.textContent = `Achievement unlocked: ${newlyUnlocked.join(" and ")}.`;
  } else if (stats.wins < 1) {
    unlockStatus.textContent = "Win a run to unlock the Solar paddle and Comet trail.";
  } else if (stats.bestScore < 1000) {
    unlockStatus.textContent = "Reach a best score of 500 for Ice and 1,000 for Spark.";
  } else {
    unlockStatus.textContent = "All cosmetics unlocked.";
  }

  updateCosmeticControls();
}

function updateAbilityControls() {
  laserButton.textContent = `Laser: ${laserCharges}`;
  laserButton.disabled = laserCharges === 0 || state !== "playing";
  laserButton.setAttribute("aria-label", `Fire laser, ${laserCharges} shots available`);
}

function fireLaser() {
  if (state !== "playing" || laserCharges <= 0) {
    return;
  }

  laserCharges -= 1;
  for (const offset of [0.28, 0.72]) {
    laserShots.push({
      x: paddle.component.x + paddle.component.width * offset - 2,
      y: paddle.component.y - 14,
      width: 4,
      height: 14,
      speed: 9
    });
  }
  playTone(680, 0.08, 0.04, "square", -180);
  updateAbilityControls();
}

paddleSkinSelect.addEventListener("change", function () {
  stats.paddleSkin = paddleSkinSelect.value;
  saveStats();
});

ballTrailSelect.addEventListener("change", function () {
  stats.ballTrail = ballTrailSelect.value;
  saveStats();
});

laserButton.addEventListener("click", fireLaser);

challengeModeSelect.addEventListener("change", function () {
  difficultySelect.disabled = challengeModeSelect.checked;
  if (challengeModeSelect.checked) {
    difficultySelect.value = "normal";
  }
  updateChallengeDisplay();
});

function updateMuteButton() {
  muteButton.textContent = soundMuted ? "Sound: Off" : "Sound: On";
  muteButton.setAttribute("aria-pressed", String(soundMuted));
}

muteButton.addEventListener("click", function () {
  soundMuted = !soundMuted;
  localStorage.setItem("brick-breaker-muted", String(soundMuted));
  updateMuteButton();
});

let bestScore = stats.bestScore;
let challengeBestScore = 0;

function updateChallengeDisplay() {
  challengeBestScore = Number.isFinite(stats.challengeBestScores[dailyChallengeDate])
    ? stats.challengeBestScores[dailyChallengeDate]
    : 0;
  updateChallengeInfo();
  bestScoreLabel.textContent = getDisplayedChallengeMode() ? "Ch Best" : "Best";
  updateScoreDisplay();
}

function updateChallengeInfo() {
  challengeInfo.textContent = `Daily challenge (${dailyChallengeDate}): ${dailyChallenge.name} — ${dailyChallenge.description} Daily best: ${challengeBestScore}.`;
}

function getDisplayedChallengeMode() {
  return challengeMode || (state !== "playing" && challengeModeSelect.checked);
}

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
    bestScoreValue.textContent = String(getDisplayedChallengeMode() ? challengeBestScore : bestScore);
  }

  if (comboValue) {
    comboValue.textContent = `x${Math.max(1, GameState.combo)}`;
  }
}

function updateLevelDisplay() {
  if (levelValue) {
    levelValue.textContent = String(level);
  }
}

function updateBestScore() {
  if (challengeMode && GameState.score > challengeBestScore) {
    challengeBestScore = GameState.score;
    stats.challengeBestScores[dailyChallengeDate] = challengeBestScore;
    saveStats();
    updateChallengeInfo();
  } else if (!challengeMode && GameState.score > bestScore) {
    bestScore = GameState.score;
    stats.bestScore = bestScore;
    saveStats();
  }
  refreshCosmeticUnlocks();
  updateScoreDisplay();
}

function showOverlay(title, message, buttonText) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlayButton.textContent = buttonText;
  difficultyControl.hidden = title !== "READY?" && title !== "GAME OVER";
  challengeControl.hidden = difficultyControl.hidden;
  levelSelectForm.hidden = true;
  overlayButton.hidden = false;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  levelSelectForm.hidden = true;
  overlayButton.hidden = false;
  overlay.classList.add("hidden");
}

function startNewGame() {
  challengeMode = challengeModeSelect.checked;
  if (challengeMode) {
    difficultySelect.value = "normal";
  }
  difficultySelect.disabled = challengeMode;
  selectedDifficulty = challengeMode ? "normal" : difficultySelect.value;
  updateChallengeDisplay();
  GameState.lives = DIFFICULTIES[selectedDifficulty].startingLives;
  GameState.score = 0;
  GameState.combo = 0;
  level = 1;
  levelWithoutLifeLoss = true;
  paddleBoostTimer = 0;
  slowBallTimer = 0;
  shieldTimer = 0;
  laserCharges = 0;
  laserShots.length = 0;
  shakeTimer = 0;
  paddle.component.width = getBasePaddleWidth();
  centerPaddle();
  powerUps.length = 0;
  updateLivesDisplay();
  updateScoreDisplay();
  updateLevelDisplay();
  updateMuteButton();
  paused = false;
  won = false;
  state = "playing";
  updateAbilityControls();
  bricks = makeBricks(level);
  resetBall();
  hideOverlay();
}

function startNextLevel() {
  level += 1;
  levelWithoutLifeLoss = true;
  GameState.combo = 0;
  updateLevelDisplay();
  updateScoreDisplay();
  bricks = makeBricks(level);
  powerUps.length = 0;
  resetBall();
  state = "playing";
  hideOverlay();
}

function openLevelSelect() {
  if (challengeMode || challengeModeSelect.checked) {
    return;
  }
  if (state === "playing") {
    paused = true;
  }
  overlayTitle.textContent = "LEVEL SELECT";
  overlayMessage.textContent = "Choose any level to jump straight to it.";
  difficultyControl.hidden = true;
  challengeControl.hidden = true;
  overlayButton.hidden = true;
  levelSelectForm.hidden = false;
  levelSelectInput.value = String(level);
  overlay.classList.remove("hidden");
  levelSelectInput.focus();
  levelSelectInput.select();
}

function goToLevel(targetLevel) {
  if (state === "start" || state === "gameOver" || state === "bossComplete") {
    startNewGame();
  }

  level = targetLevel;
  levelWithoutLifeLoss = true;
  GameState.combo = 0;
  updateLevelDisplay();
  updateScoreDisplay();
  bricks = makeBricks(level);
  powerUps.length = 0;
  resetBall();
  paused = false;
  won = false;
  state = "playing";
  hideOverlay();
}

function launchBall(shouldLaunch = true) {
  if (state === "start" || state === "gameOver") {
    startNewGame();
  } else if (state === "levelComplete") {
    if (isBossWaveLevel(level)) {
      startNewGame();
    } else {
      startNextLevel();
    }
  } else if (state === "paused") {
    paused = false;
    state = "playing";
    hideOverlay();
  } else if (state === "bossComplete") {
    startNewGame();
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
let cheatSequence = "";

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
  const target = event.target;
  const isTextEntry = target instanceof HTMLElement
    && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
  if (event.code === "Space" && !isTextEntry) {
    event.preventDefault();
  }
  if (!levelSelectForm.hidden) {
    if (key === "escape") {
      cancelLevelSelect.click();
    }
    return;
  }
  if (!event.repeat && !isTextEntry) {
    cheatSequence = /^[1-4]$/.test(key) ? `${cheatSequence}${key}`.slice(-4) : "";
    if (cheatSequence === "1234") {
      cheatSequence = "";
      openLevelSelect();
    }
  }
  if (!event.repeat && event.code === "Space") {
    launchBall();
  }
  if (!event.repeat && key === "f" && !isTextEntry) {
    fireLaser();
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
  updateAbilityControls();

  if (state !== "playing" || paused || won) {
    if (shakeTimer > 0) {
      shakeTimer -= 1;
    }
    return;
  }

  GameState.combo = Math.max(0, GameState.combo);
  updateScoreDisplay();

  if (shakeTimer > 0) {
    shakeTimer -= 1;
  }

  if (paddleBoostTimer > 0) {
    paddleBoostTimer -= 1;
    if (paddleBoostTimer <= 0) {
      paddle.component.width = getBasePaddleWidth();
      paddle.component.x = Math.min(paddle.component.x, WIDTH - paddle.component.width);
    }
  }

  if (slowBallTimer > 0) {
    slowBallTimer -= 1;
  }

  if (shieldTimer > 0) {
    shieldTimer -= 1;
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

  updateLaserShots();

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
    unlockAchievements([
      ...(levelWithoutLifeLoss ? ["flawless-level"] : []),
      ...(isBossWaveLevel(level) ? ["boss-breaker"] : [])
    ]);
    if (isBossWaveLevel(level)) {
      recordRunResult(true);
      state = "bossComplete";
      playWinSound();
      showOverlay(
        "BOSS DEFEATED",
        `You cleared the boss wave on level ${level}. Press the button to start a fresh run.`,
        "New Run"
      );
      return;
    }

    state = "levelComplete";
    playWinSound();
    showOverlay(
      "LEVEL COMPLETE",
      `Get ready for level ${level + 1}. The ball gets faster and the brick wall grows.`,
      "Next Level"
    );
    return;
  }

  let fallenBalls = balls.filter((activeBall) => activeBall.component.y > HEIGHT);
  if (fallenBalls.length > 0 && shieldTimer > 0) {
    const savedBall = fallenBalls[0].component;
    savedBall.y = HEIGHT - savedBall.height;
    savedBall.vy = -Math.abs(savedBall.vy || getCurrentBallSpeed());
    shieldTimer = 0;
    createParticleBurst(savedBall.x + savedBall.width / 2, HEIGHT - 8, "#38bdf8");
    fallenBalls = balls.filter((activeBall) => activeBall.component.y > HEIGHT);
  }
  if (fallenBalls.length > 0) {
    balls = balls.filter((activeBall) => activeBall.component.y <= HEIGHT);
    if (balls.length === 0) {
      powerUps.length = 0;
      GameState.lives -= 1;
      levelWithoutLifeLoss = false;
      GameState.combo = 0;
      shakeTimer = 24;
      createParticleBurst(
        paddle.component.x + paddle.component.width / 2,
        HEIGHT - 10,
        "#f87171"
      );
      centerPaddle();
      updateLivesDisplay();
      updateScoreDisplay();

      if (GameState.lives <= 0) {
        recordRunResult(false);
        state = "gameOver";
        playLoseSound();
        showOverlay(
          "GAME OVER",
          `Final score: ${GameState.score}. Best score: ${getDisplayedChallengeMode() ? challengeBestScore : bestScore}. Press R or use the button to try again.`,
          "Restart Game"
        );
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

  if (shieldTimer > 0) {
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#38bdf8";
    ctx.fillStyle = "rgba(56, 189, 248, 0.85)";
    ctx.fillRect(0, HEIGHT - 6, WIDTH, 3);
    ctx.restore();
  }

  ctx.save();
  ctx.shadowBlur = 26;
  const paddleColor = stats.paddleSkin === "solar"
    ? "#facc15"
    : stats.paddleSkin === "ice"
      ? "#67e8f9"
      : rainbowColor(hueTime);
  ctx.shadowColor = paddleColor;
  ctx.fillStyle = paddleColor;
  ctx.fillRect(
    paddle.component.x,
    paddle.component.y,
    paddle.component.width,
    paddle.component.height
  );
  ctx.restore();

  for (const activeBall of balls) {
    ctx.save();
    for (let trailIndex = 0; trailIndex < activeBall.trail.length; trailIndex++) {
      const point = activeBall.trail[trailIndex];
      ctx.globalAlpha = (trailIndex + 1) / (activeBall.trail.length + 1) * 0.5;
      ctx.fillStyle = stats.ballTrail === "comet"
        ? "#60a5fa"
        : stats.ballTrail === "spark"
          ? rainbowColor(hueTime + trailIndex * 0.08)
          : "transparent";
      ctx.fillRect(point.x - 3, point.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
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
  for (const shot of laserShots) {
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#f87171";
    ctx.fillStyle = "#fecaca";
    ctx.fillRect(shot.x, shot.y, shot.width, shot.height);
    ctx.restore();
  }
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
  stats = loadStats();
  bestScore = stats.bestScore;
  challengeModeSelect.checked = false;
  difficultySelect.disabled = false;
  updateChallengeDisplay();
  refreshCosmeticUnlocks();
  refreshAchievementDisplay();
  updateStatsDisplay();
  bricks = makeBricks();  // bricks.js
  resetBall();
  lastTime = performance.now();
  state = "start";
  paused = false;
  won = false;
  GameState.lives = DIFFICULTIES[selectedDifficulty].startingLives;
  GameState.score = 0;
  GameState.combo = 0;
  level = 1;
  levelWithoutLifeLoss = true;
  powerUps.length = 0;
  shieldTimer = 0;
  laserCharges = 0;
  laserShots.length = 0;
  paddle.component.width = getBasePaddleWidth();
  updateLivesDisplay();
  updateScoreDisplay();
  updateLevelDisplay();
  updateAbilityControls();
  showOverlay("READY?", "Move with the arrow keys or A and D. Press Space to launch. Press P to pause or resume. Every 5th level is a boss wave.", "Start Game");
  requestAnimationFrame(frame);
}

overlayButton.addEventListener("click", function () {
  launchBall(false);
});

levelSelectForm.addEventListener("submit", function (event) {
  event.preventDefault();
  const targetLevel = levelSelectInput.valueAsNumber;
  if (!Number.isSafeInteger(targetLevel) || targetLevel < 1) {
    levelSelectInput.setCustomValidity("Enter a whole-number level greater than zero.");
    levelSelectInput.reportValidity();
    return;
  }
  levelSelectInput.setCustomValidity("");
  goToLevel(targetLevel);
});

levelSelectInput.addEventListener("input", function () {
  levelSelectInput.setCustomValidity("");
});

cancelLevelSelect.addEventListener("click", function () {
  if (state === "playing") {
    paused = false;
    hideOverlay();
    return;
  }
  if (state === "start") {
    showOverlay(
      "READY?",
      "Move with the arrow keys or A and D. Press Space to launch. Press P to pause or resume. Every 5th level is a boss wave.",
      "Start Game"
    );
  } else if (state === "paused") {
    showOverlay("PAUSED", "Press P to resume, or use the button below.", "Resume Game");
  } else if (state === "gameOver") {
    showOverlay(
      "GAME OVER",
      `Final score: ${GameState.score}. Best score: ${getDisplayedChallengeMode() ? challengeBestScore : bestScore}. Press R or use the button to try again.`,
      "Restart Game"
    );
  } else if (state === "bossComplete") {
    showOverlay(
      "BOSS DEFEATED",
      `You cleared the boss wave on level ${level}. Press the button to start a fresh run.`,
      "New Run"
    );
  } else if (state === "levelComplete") {
    showOverlay(
      "LEVEL COMPLETE",
      `Get ready for level ${level + 1}. The ball gets faster and the brick wall grows.`,
      "Next Level"
    );
  } else {
    hideOverlay();
  }
});

// Wait until all three script files have loaded, then start.
window.addEventListener("load", start);
