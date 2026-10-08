// ============================================================
// collisions.js: what happens when the ball touches something
//
// To "bounce", we flip the ball's speed:
//   hit something sideways -> vx = -vx
//   hit something above or below -> vy = -vy
// ============================================================

// Returns true if two rectangles (like the ball and a brick) overlap.
function boxesTouch(a, b) {
  a = a.component;
  b = b.component;
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}


// The ball bounces off the left, right, and top walls.
// (The bottom is not a wall: falling off the bottom resets the ball.)
function bounceOffWalls() {
  const data = ball.component;
  if (data.x < 0) {
    data.x = 0;
    data.vx = -data.vx;
    playWallSound();
  }
  if (data.x + data.width > WIDTH) {
    data.x = WIDTH - data.width;
    data.vx = -data.vx;
    playWallSound();
  }
  if (data.y < 0) {
    data.y = 0;
    data.vy = -data.vy;
    playWallSound();
  }
}


// The ball bounces off the top of the paddle.
// ball.vy > 0 means "the ball is moving down", so it only bounces
// when it is falling onto the paddle.
function bounceOffPaddle() {
  const ballData = ball.component;
  const paddleData = paddle.component;
  if (boxesTouch(ball, paddle) && ballData.vy > 0) {
    ballData.y = paddleData.y - ballData.height;  // sit on top of the paddle
    ballData.vy = -ballData.vy;
    playPaddleSound();
  }
}


// The ball bounces off and breaks the brick it touches.
function bounceOffBricks() {
  for (let index = 0; index < bricks.length; index++) {
    const brick = bricks[index];
    const ballData = ball.component;
    const brickData = brick.component;
    if (!boxesTouch(ball, brick)) {
      continue;  // not touching this brick, check the next one
    }

    // How far has the ball pushed into the brick on each side?
    const overlapX = Math.min(ballData.x + ballData.width, brickData.x + brickData.width) - Math.max(ballData.x, brickData.x);
    const overlapY = Math.min(ballData.y + ballData.height, brickData.y + brickData.height) - Math.max(ballData.y, brickData.y);

    if (overlapX < overlapY) {
      // The ball hit the brick's left or right side.
      ballData.vx = -ballData.vx;
      if (ballData.x < brickData.x) {
        ballData.x = brickData.x - ballData.width;     // left of the brick
      } else {
        ballData.x = brickData.x + brickData.width;    // right of the brick
      }
    } else {
      // The ball hit the brick's top or bottom.
      ballData.vy = -ballData.vy;
      if (ballData.y < brickData.y) {
        ballData.y = brickData.y - ballData.height;    // above the brick
      } else {
        ballData.y = brickData.y + brickData.height;   // below the brick
      }
    }

    createParticleBurst(
      brickData.x + brickData.width / 2,
      brickData.y + brickData.height / 2,
      rainbowColor((performance.now() * 0.0008) + index * 0.06)
    );
    playBrickSound();
    bricks.splice(index, 1);
    break;  // bounce off one brick per update, then stop looking
  }
}
