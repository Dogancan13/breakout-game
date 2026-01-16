const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

/* ===================== HUD ===================== */
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const bestEl = document.getElementById("best");

/* ===================== OVERLAY ===================== */
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const toggleSoundBtn = document.getElementById("toggleSoundBtn");

/* ===================== SABİT OYUN DÜNYASI ===================== */
const W = canvas.width;   // 500
const H = canvas.height;  // 400

/* ===================== OYUN STATE ===================== */
let score = 0;
let lives = 3;
let level = 1;
let best = Number(localStorage.getItem("bestScore") || 0);
bestEl.textContent = best;

let isRunning = false;
let isPaused = false;
let isGameOver = false;
let soundOn = true;

/* ===================== INPUT ===================== */
let rightPressed = false;
let leftPressed = false;

/* ===================== AUDIO ===================== */
let audioCtx = null;
function beep(freq = 440, duration = 0.06) {
  if (!soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + duration);
  } catch {}
}

/* ===================== HELPERS ===================== */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/* ===================== PADDLE ===================== */
const paddle = {
  width: 92,
  baseWidth: 92,
  height: 12,
  x: W / 2 - 46,
  y: H - 22,
  speed: 9,
};

/* ===================== BALLS ===================== */
function makeBall(x, y, dx, dy) {
  return { x, y, r: 10, dx, dy };
}
let balls = [];

/* ===================== BRICKS ===================== */
let bricks = [];
let brickRowCount = 4;
let brickColumnCount = 7;

const brickPadding = 10;
const brickOffsetTop = 45;
const brickOffsetLeft = 20;
let brickWidth = 60;
const brickHeight = 20;

function createBricksForLevel() {
  brickRowCount = Math.min(4 + Math.floor((level - 1) / 2), 7);
  brickColumnCount = 7;

  brickWidth = Math.floor(
    (W - brickOffsetLeft * 2 - (brickColumnCount - 1) * brickPadding) / brickColumnCount
  );

  bricks = [];
  for (let c = 0; c < brickColumnCount; c++) {
    bricks[c] = [];
    for (let r = 0; r < brickRowCount; r++) {
      const hp = Math.min(1 + Math.floor(r / 2) + Math.floor((level - 1) / 2), 3);
      bricks[c][r] = { x: 0, y: 0, hp };
    }
  }
}

function bricksRemaining() {
  let n = 0;
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      if (bricks[c][r].hp > 0) n++;
    }
  }
  return n;
}

/* ===================== PARTICLES ===================== */
let particles = [];
function spawnParticles(x, y, count = 10) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 2;
    particles.push({ x, y, dx: Math.cos(a) * sp, dy: Math.sin(a) * sp, life: 16 });
  }
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.dy += 0.04;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles() {
  ctx.save();
  ctx.globalAlpha = 0.6;
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#9ecbff";
    ctx.fill();
  });
  ctx.restore();
}

/* ===================== POWER UPS ===================== */
let powerUps = [];
function spawnPowerUp(x, y) {
  if (Math.random() > 0.25) return;
  const types = ["expand", "multiball", "speed", "life"];
  const type = types[Math.floor(Math.random() * types.length)];
  powerUps.push({ x, y, w: 18, h: 18, dy: 3, type, active: true });
}

function applyPowerUp(type) {
  if (type === "expand") paddle.width = Math.min(paddle.width + 30, 160);
  if (type === "multiball") {
    const b = balls[0];
    if (b) {
      balls.push(makeBall(b.x, b.y, -b.dx, b.dy));
      balls.push(makeBall(b.x, b.y, b.dx * 0.8, -b.dy));
    }
  }
  if (type === "speed") balls.forEach(b => { b.dx *= 1.15; b.dy *= 1.15; });
  if (type === "life") {
    lives = Math.min(lives + 1, 9);
    livesEl.textContent = lives;
  }
}

function updatePowerUps() {
  powerUps.forEach(p => {
    if (!p.active) return;
    p.y += p.dy;

    if (
      p.y + p.h >= paddle.y &&
      p.x + p.w >= paddle.x &&
      p.x <= paddle.x + paddle.width &&
      p.y <= paddle.y + paddle.height
    ) {
      p.active = false;
      applyPowerUp(p.type);
      spawnParticles(p.x + 9, p.y + 9, 12);
    }
  });
  powerUps = powerUps.filter(p => p.active && p.y < H + 30);
}

/* ===================== INPUT EVENTS ===================== */
document.addEventListener("keydown", e => {
  if (e.key === "ArrowRight") rightPressed = true;
  if (e.key === "ArrowLeft") leftPressed = true;
  if (e.key === "Enter") startOrResume();
  if (e.key.toLowerCase() === "p") togglePause();
});
document.addEventListener("keyup", e => {
  if (e.key === "ArrowRight") rightPressed = false;
  if (e.key === "ArrowLeft") leftPressed = false;
});

// Mobil dokunmatik (CSS ölçek -> world)
canvas.addEventListener("touchstart", handleTouch, { passive: false });
canvas.addEventListener("touchmove", handleTouch, { passive: false });

function handleTouch(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / W;
  const x = (e.touches[0].clientX - rect.left) / scaleX;
  paddle.x = clamp(x - paddle.width / 2, 0, W - paddle.width);
  if (!isRunning || isPaused) startOrResume();
}

/* ===================== BUTTONS ===================== */
startBtn.onclick = startOrResume;
restartBtn.onclick = () => resetGame(true);
toggleSoundBtn.onclick = () => {
  soundOn = !soundOn;
  toggleSoundBtn.textContent = `Ses: ${soundOn ? "Açık" : "Kapalı"}`;
};

/* ===================== OVERLAY ===================== */
function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.style.display = "flex";
}
function hideOverlay() {
  overlay.style.display = "none";
}

/* ===================== GAME CONTROL ===================== */
function startOrResume() {
  if (isGameOver) {
    resetGame(true);
    hideOverlay();
    return;
  }
  if (!isRunning) isRunning = true;
  isPaused = false;
  hideOverlay();
}

function togglePause() {
  if (!isRunning) return;
  isPaused = !isPaused;
  if (isPaused) showOverlay("Duraklatıldı", "Devam için Enter");
  else hideOverlay();
}

function resetRound() {
  paddle.width = paddle.baseWidth;
  paddle.x = W / 2 - paddle.width / 2;
  powerUps = [];
  particles = [];

  const speed = 5 + (level - 1) * 0.7;
  const dir = Math.random() < 0.5 ? -1 : 1;
  balls = [makeBall(W / 2, H / 2, speed * dir, -speed)];
}

function resetGame(hard = false) {
  isGameOver = false;
  score = 0;
  lives = 3;
  level = 1;

  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;

  createBricksForLevel();
  resetRound();

  isRunning = false;
  isPaused = false;

  showOverlay("Breakout", "Başlat / Enter ile başla");
}

function gameOver() {
  if (score > best) {
    best = score;
    localStorage.setItem("bestScore", String(best));
    bestEl.textContent = best;
  }
  isRunning = false;
  isPaused = false;
  isGameOver = true;
  showOverlay("Game Over", "Enter = Yeniden Başla");
}

/* ===================== DRAW ===================== */
function drawBackground() {
  ctx.fillStyle = "#0b0f17";
  ctx.fillRect(0, 0, W, H);
}

function drawPaddle() {
  ctx.fillStyle = "#5aaaff";
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
}

function drawBall(b) {
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = "#ff4d4d";
  ctx.fill();
}

function drawBricks() {
  for (let c = 0; c < brickColumnCount; c++) {
    for (let r = 0; r < brickRowCount; r++) {
      const br = bricks[c][r];
      if (br.hp <= 0) continue;

      const x = c * (brickWidth + brickPadding) + brickOffsetLeft;
      const y = r * (brickHeight + brickPadding) + brickOffsetTop;
      br.x = x; br.y = y;

      ctx.fillStyle = br.hp === 3 ? "#ff6b6b" : br.hp === 2 ? "#ffd166" : "#5fffb0";
      ctx.fillRect(x, y, brickWidth, brickHeight);
    }
  }
}

function drawPowerUps() {
  for (const p of powerUps) {
    // Kutunun tipi farklı renk olsun
    let bg = "#aa6eff"; // default
    if (p.type === "life") bg = "#5fffb0";
    if (p.type === "expand") bg = "#5aaaff";
    if (p.type === "multiball") bg = "#ffd166";
    if (p.type === "speed") bg = "#ff6b6b";

    // Kutu
    ctx.fillStyle = bg;
    ctx.fillRect(p.x, p.y, p.w, p.h);

    // Harf
    const letter =
      p.type === "life" ? "+" :
      p.type === "expand" ? "E" :
      p.type === "multiball" ? "M" :
      "S";

    ctx.fillStyle = "#0b0f17";     // koyu yazı (açık kutuda görünür)
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, p.x + p.w / 2, p.y + p.h / 2);
  }

  // temizle (başka yerde kullanıyorsan sorun olmaz)
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

/* ===================== COLLISION ===================== */
function circleRectHit(ball, rx, ry, rw, rh) {
  const cx = clamp(ball.x, rx, rx + rw);
  const cy = clamp(ball.y, ry, ry + rh);
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  return dx * dx + dy * dy <= ball.r * ball.r;
}

function resolveBrickHit(ball, br) {
  ball.dy *= -1;
  br.hp--;
  score += 10;
  scoreEl.textContent = score;
  spawnParticles(ball.x, ball.y, 10);
  if (br.hp === 0) spawnPowerUp(br.x + brickWidth / 2 - 9, br.y + brickHeight / 2 - 9);
}

function paddleBounce(ball) {
  if (
    ball.dy > 0 &&
    ball.y + ball.r >= paddle.y &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.width
  ) {
    ball.dy = -Math.abs(ball.dy);
    spawnParticles(ball.x, paddle.y, 6);
  }
}

/* ===================== MAIN LOOP ===================== */
function gameLoop() {
  drawBackground();
  drawBricks();
  drawPowerUps();
  drawPaddle();
  balls.forEach(drawBall);
  updateParticles();
  drawParticles();

  if (!isRunning || isPaused) {
    requestAnimationFrame(gameLoop);
    return;
  }

  if (rightPressed) paddle.x += paddle.speed;
  if (leftPressed) paddle.x -= paddle.speed;
  paddle.x = clamp(paddle.x, 0, W - paddle.width);

  updatePowerUps();

  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    const steps = 2;

    for (let s = 0; s < steps; s++) {
      b.x += b.dx / steps;
      b.y += b.dy / steps;

      if (b.x - b.r < 0 || b.x + b.r > W) b.dx *= -1;
      if (b.y - b.r < 0) b.dy *= -1;

      for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
          const br = bricks[c][r];
          if (br.hp > 0 && circleRectHit(b, br.x, br.y, brickWidth, brickHeight)) {
            resolveBrickHit(b, br);
          }
        }
      }
      paddleBounce(b);
    }

    if (b.y - b.r > H) balls.splice(i, 1);
  }

  if (balls.length === 0) {
    lives--;
    livesEl.textContent = lives;
    if (lives <= 0) gameOver();
    else {
      resetRound();
      isPaused = true;
      showOverlay("Can gitti!", "Enter ile devam");
    }
  }

  if (bricksRemaining() === 0) {
    level++;
    levelEl.textContent = level;
    createBricksForLevel();
    resetRound();
    isPaused = true;
    showOverlay(`Level ${level}`, "Enter ile devam");
  }

  requestAnimationFrame(gameLoop);
}

/* ===================== START ===================== */
resetGame(false);
gameLoop();

