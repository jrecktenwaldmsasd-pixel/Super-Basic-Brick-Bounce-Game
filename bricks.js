// ============================================================
// bricks.js: where the bricks are, and how they are drawn
// ============================================================

const BRICK_COLUMNS = 8;
const BRICK_ROWS = 4;
const BRICK_WIDTH = 60;
const BRICK_HEIGHT = 20;
const BRICK_GAP = 6;     // empty space between bricks
const BRICKS_TOP = 50;   // how far down the first row starts
const MAX_BRICK_ROWS = 7;
const BOSS_WAVE_INTERVAL = 5;

function isBossWaveLevel(level) {
  return level > 0 && level % BOSS_WAVE_INTERVAL === 0;
}

function makeBossWave(level = 1) {
  const list = [];
  const bossWidth = 180;
  const bossHeight = 30;
  const bossX = (WIDTH - bossWidth) / 2;
  const bossY = BRICKS_TOP + 14;
  const bossHits = 8 + Math.min(12, level * 2);

  list.push({
    component: {
      ...component,
      x: bossX,
      y: bossY,
      width: bossWidth,
      height: bossHeight,
      type: "boss",
      hitsRemaining: bossHits,
      maxHits: bossHits,
      dropChance: 0.9,
      movement: 1.1,
      attackCooldown: 150,
      attackWarningTimer: 0,
      attackPattern: "focused",
      attackTargets: [],
      attackCount: 0
    },
    startX: bossX
  });

  const supportRows = 2;
  const supportCols = 5;
  const supportWidth = 56;
  const supportHeight = 18;
  const supportGap = 10;
  const supportLeft = (WIDTH - (supportCols * supportWidth + (supportCols - 1) * supportGap)) / 2;

  for (let row = 0; row < supportRows; row++) {
    for (let col = 0; col < supportCols; col++) {
      const x = supportLeft + col * (supportWidth + supportGap);
      const y = bossY + bossHeight + 26 + row * (supportHeight + 12);
      list.push({
        component: {
          ...component,
          x,
          y,
          width: supportWidth,
          height: supportHeight,
          type: row === 0 ? "armored" : "moving",
          hitsRemaining: row === 0 ? 2 : 1,
          maxHits: row === 0 ? 2 : 1,
          dropChance: 0.35,
          movement: col % 2 === 0 ? 0.8 : -0.8
        },
        startX: x
      });
    }
  }

  return list;
}

// Builds the list of bricks. Each brick is an object with an
// x, y, width, and height.
function makeBricks(level = 1) {
  if (isBossWaveLevel(level)) {
    return makeBossWave(level);
  }

  const list = [];
  const rows = Math.min(BRICK_ROWS + level - 1, MAX_BRICK_ROWS);

  // Center the whole block of bricks on the screen.
  const totalWidth = BRICK_COLUMNS * BRICK_WIDTH + (BRICK_COLUMNS - 1) * BRICK_GAP;
  const left = (WIDTH - totalWidth) / 2;
  const movingColumns = challengeMode && dailyChallenge.id === "moving-bricks"
    ? [1, 2, BRICK_COLUMNS - 3, BRICK_COLUMNS - 2]
    : [1, BRICK_COLUMNS - 2];
  const movementSpeed = challengeMode && dailyChallenge.id === "moving-bricks" ? 1.15 : 0.8;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < BRICK_COLUMNS; col++) {
      const moving = row === 0 && movingColumns.includes(col);
      const armored = row === rows - 1 && col % 3 === 0;
      const powerDropper = row === 1 && col % 4 === 2;
      list.push({
        component: {
          ...component,
          x: left + col * (BRICK_WIDTH + BRICK_GAP),
          y: BRICKS_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          type: moving ? "moving" : armored ? "armored" : powerDropper ? "power" : "standard",
          hitsRemaining: armored ? 2 : 1,
          maxHits: armored ? 2 : 1,
          dropChance: powerDropper ? 0.8 : 0.22,
          movement: moving ? (col % 2 === 1 ? 1 : -1) * movementSpeed : 0
        },
        startX: left + col * (BRICK_WIDTH + BRICK_GAP)
      });
    }
  }

  return list;
}

function moveBricks() {
  for (const brick of bricks) {
    const data = brick.component;
    if (data.type !== "moving" && data.type !== "boss") {
      continue;
    }

    if (data.type === "boss") {
      data.x += data.movement;
      if (data.x < 20 || data.x + data.width > WIDTH - 20) {
        data.x = Math.max(20, Math.min(WIDTH - data.width - 20, data.x));
        data.movement = -data.movement;
      }
      continue;
    }

    data.x += data.movement;
    if (data.x < 0 || data.x + data.width > WIDTH) {
      data.x = Math.max(0, Math.min(WIDTH - data.width, data.x));
      data.movement = -data.movement;
    }
  }
}

// Draws every brick in the list.
function drawBricks() {
  const cycle = performance.now() * 0.0008;
  for (let i = 0; i < bricks.length; i++) {
    const brick = bricks[i];
    const data = brick.component;
    const colors = {
      armored: "#f97316",
      moving: "#22d3ee",
      power: "#facc15",
      boss: "#f472b6"
    };
    ctx.fillStyle = data.type === "boss" && data.attackWarningTimer > 0
      ? "#fb7185"
      : colors[data.type] || `hsl(${(cycle * 360 + i * 12) % 360}, 100%, 65%)`;
    ctx.fillRect(data.x, data.y, data.width, data.height);

    if (data.type === "armored") {
      ctx.strokeStyle = "#fff7ed";
      ctx.lineWidth = 2;
      ctx.strokeRect(data.x + 4, data.y + 4, data.width - 8, data.height - 8);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px Courier New";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(data.hitsRemaining), data.x + data.width / 2, data.y + data.height / 2);
    } else if (data.type === "moving") {
      ctx.strokeStyle = "#cffafe";
      ctx.lineWidth = 2;
      ctx.strokeRect(data.x + 2, data.y + 2, data.width - 4, data.height - 4);
      ctx.fillStyle = "#083344";
      ctx.font = "bold 12px Courier New";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("< >", data.x + data.width / 2, data.y + data.height / 2);
    } else if (data.type === "power") {
      ctx.fillStyle = "#713f12";
      ctx.font = "bold 12px Courier New";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", data.x + data.width / 2, data.y + data.height / 2);
    } else if (data.type === "boss") {
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(data.x, data.y - 12, data.width, 8);
      const healthRatio = Math.max(0, data.hitsRemaining / data.maxHits);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(data.x, data.y - 12, data.width * healthRatio, 8);
      ctx.strokeStyle = "#fdf2f8";
      ctx.lineWidth = 2;
      ctx.strokeRect(data.x, data.y - 12, data.width, 8);
      ctx.fillStyle = "#fdf2f8";
      ctx.font = "bold 12px Courier New";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        data.attackWarningTimer > 0 ? "AIMING" : "BOSS",
        data.x + data.width / 2,
        data.y + data.height / 2 + 1
      );
    }
  }
}
