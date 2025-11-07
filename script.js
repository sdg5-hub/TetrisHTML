// Simple Tetris implementation for browser.
// 10x20 board, arrow controls, space = hard drop.

const canvas = document.getElementById("tetris");
const ctx = canvas.getContext("2d");

const COLS = 10;
const ROWS = 20;
const BLOCK = canvas.width / COLS;

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const messageEl = document.getElementById("message");

const COLORS = {
  0: "#020817",
  1: "#00e0ff",
  2: "#ff4976",
  3: "#ffc857",
  4: "#7fff00",
  5: "#9370ff",
  6: "#ff7b00",
  7: "#ff00b8",
};

const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [2, 0, 0],
    [2, 2, 2],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 3],
    [3, 3, 3],
    [0, 0, 0],
  ],
  O: [
    [4, 4],
    [4, 4],
  ],
  S: [
    [0, 5, 5],
    [5, 5, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 6, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  Z: [
    [7, 7, 0],
    [0, 7, 7],
    [0, 0, 0],
  ],
};

const PIECE_TYPES = Object.keys(SHAPES);

function createMatrix(cols, rows) {
  const matrix = [];
  for (let y = 0; y < rows; y++) {
    matrix.push(new Array(cols).fill(0));
  }
  return matrix;
}

const board = createMatrix(COLS, ROWS);

function randomPiece() {
  const type = PIECE_TYPES[(PIECE_TYPES.length * Math.random()) | 0];
  const shape = SHAPES[type];
  return {
    x: ((COLS / 2) | 0) - ((shape[0].length / 2) | 0),
    y: 0,
    shape: shape.map((row) => row.slice()),
  };
}

let current = randomPiece();
let dropCounter = 0;
let lastTime = 0;
let dropInterval = 800; // ms
let score = 0;
let lines = 0;
let level = 1;
let paused = false;
let gameOver = false;

function collide(board, piece) {
  const m = piece.shape;
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x] !== 0) {
        const bx = piece.x + x;
        const by = piece.y + y;
        if (
          bx < 0 ||
          bx >= COLS ||
          by >= ROWS ||
          (by >= 0 && board[by][bx] !== 0)
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function merge(board, piece) {
  const m = piece.shape;
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x] !== 0) {
        const bx = piece.x + x;
        const by = piece.y + y;
        if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
          board[by][bx] = m[y][x];
        }
      }
    }
  }
}

function rotate(matrix, dir) {
  const N = matrix.length;
  const res = matrix.map((row) => row.slice());
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (dir > 0) {
        res[x][N - 1 - y] = matrix[y][x];
      } else {
        res[N - 1 - x][y] = matrix[y][x];
      }
    }
  }
  return res;
}

function playerRotate(dir) {
  const oldShape = current.shape;
  current.shape = rotate(current.shape, dir);
  if (collide(board, current)) {
    // simple wall kick: try shifting left/right
    current.x++;
    if (collide(board, current)) {
      current.x -= 2;
      if (collide(board, current)) {
        // revert if still bad
        current.x++;
        current.shape = oldShape;
      }
    }
  }
}

function clearLines() {
  let rowCount = 0;
  outer: for (let y = ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] === 0) continue outer;
    }
    // full row
    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    rowCount++;
    y++;
  }

  if (rowCount > 0) {
    const lineScores = [0, 40, 100, 300, 1200]; // Tetris-style
    score += lineScores[rowCount] * level;
    lines += rowCount;
    level = 1 + Math.floor(lines / 10);
    if (level > 15) level = 15;
    dropInterval = Math.max(120, 800 - (level - 1) * 40);
    updateHUD();
  }
}

function updateHUD() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function playerReset() {
  current = randomPiece();
  if (collide(board, current)) {
    gameOver = true;
    messageEl.textContent = "Game Over – press R to restart";
  }
}

function playerDrop() {
  if (gameOver || paused) return;
  current.y++;
  if (collide(board, current)) {
    current.y--;
    merge(board, current);
    clearLines();
    playerReset();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (gameOver || paused) return;
  while (!collide(board, { ...current, y: current.y + 1 })) {
    current.y++;
  }
  merge(board, current);
  clearLines();
  playerReset();
}

function drawCell(x, y, value) {
  ctx.fillStyle = COLORS[value];
  const px = x * BLOCK;
  const py = y * BLOCK;
  ctx.fillRect(px, py, BLOCK, BLOCK);
  if (value !== 0) {
    ctx.strokeStyle = "#020817";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, BLOCK - 1, BLOCK - 1);
  }
}

function draw() {
  ctx.fillStyle = COLORS[0];
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // board
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      drawCell(x, y, board[y][x]);
    }
  }

  // current piece
  const m = current.shape;
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x] !== 0) {
        const bx = current.x + x;
        const by = current.y + y;
        if (by >= 0) {
          drawCell(bx, by, m[y][x]);
        }
      }
    }
  }
}

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;

  if (!paused && !gameOver) {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      playerDrop();
    }
  }

  draw();
  requestAnimationFrame(update);
}

document.addEventListener("keydown", (e) => {
  if (e.code === "KeyP") {
    if (gameOver) return;
    paused = !paused;
    messageEl.textContent = paused ? "Paused" : "";
    return;
  }

  if (e.code === "KeyR") {
    // restart
    for (let y = 0; y < ROWS; y++) {
      board[y].fill(0);
    }
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 800;
    gameOver = false;
    paused = false;
    messageEl.textContent = "";
    updateHUD();
    current = randomPiece();
    return;
  }

  if (paused || gameOver) return;

  switch (e.code) {
    case "ArrowLeft":
      current.x--;
      if (collide(board, current)) current.x++;
      break;
    case "ArrowRight":
      current.x++;
      if (collide(board, current)) current.x--;
      break;
    case "ArrowDown":
      playerDrop();
      break;
    case "ArrowUp":
      playerRotate(1);
      break;
    case "Space":
    case "Spacebar":
      hardDrop();
      break;
  }
});

// init
updateHUD();
messageEl.textContent = "";
requestAnimationFrame(update);
