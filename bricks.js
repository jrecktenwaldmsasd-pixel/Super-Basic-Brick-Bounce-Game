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

// Builds the list of bricks. Each brick is an object with an
// x, y, width, and height.
function makeBricks(level = 1) {
  const list = [];
  const rows = Math.min(BRICK_ROWS + level - 1, MAX_BRICK_ROWS);

  // Center the whole block of bricks on the screen.
  const totalWidth = BRICK_COLUMNS * BRICK_WIDTH + (BRICK_COLUMNS - 1) * BRICK_GAP;
  const left = (WIDTH - totalWidth) / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < BRICK_COLUMNS; col++) {
      const moving = row === 0 && (col === 1 || col === BRICK_COLUMNS - 2);
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
          dropChance: powerDropper ? 0.8 : 0.22,
          movement: moving ? (col === 1 ? 1 : -1) * 0.8 : 0
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
    if (data.type !== "moving") {
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
      power: "#facc15"
    };
    ctx.fillStyle = colors[data.type] || `hsl(${(cycle * 360 + i * 12) % 360}, 100%, 65%)`;
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
    }
  }
}
