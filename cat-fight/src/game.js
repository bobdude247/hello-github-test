const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const p1StaminaEl = document.getElementById("p1Stamina");
const p2StaminaEl = document.getElementById("p2Stamina");
const timerEl = document.getElementById("timer");
const announcementEl = document.getElementById("announcement");
const resetButton = document.getElementById("resetButton");

const FLOOR_Y = 440;
const GRAVITY = 0.75;
const ROUND_TIME = 60;
const MELEE_STAMINA_DRAIN = 8;
const PROJECTILE_STAMINA_DRAIN = 6;

const keys = new Set();
const projectiles = [];
let roundOver = false;
let timeLeft = ROUND_TIME;
let timerTick = 0;
let popups = [];

const sfxWords = ["BOP!", "POOF!", "BOING!", "MEOW!", "FLOOF!"];

function makeCat({ name, color, x, controls, facing }) {
  return {
    name,
    color,
    x,
    y: FLOOR_Y,
    w: 68,
    h: 80,
    vx: 0,
    vy: 0,
    speed: 4,
    jumpPower: 14,
    facing,
    stamina: 100,
    attackCooldown: 0,
    rangedCooldown: 0,
    controls
  };
}

const player1 = makeCat({
  name: "Sunny Tabby",
  color: "#ffb347",
  x: 180,
  controls: {
    left: "KeyA",
    right: "KeyD",
    jump: "KeyW",
    attack: "KeyF",
    ranged: "KeyG"
  },
  facing: 1
});

const player2 = makeCat({
  name: "Misty Shorthair",
  color: "#b8c1cc",
  x: 710,
  controls: {
    left: "ArrowLeft",
    right: "ArrowRight",
    jump: "ArrowUp",
    attack: "KeyK",
    ranged: "KeyL"
  },
  facing: -1
});

function resetRound() {
  Object.assign(player1, makeCat({
    name: "Sunny Tabby",
    color: "#ffb347",
    x: 180,
    controls: player1.controls,
    facing: 1
  }));
  Object.assign(player2, makeCat({
    name: "Misty Shorthair",
    color: "#b8c1cc",
    x: 710,
    controls: player2.controls,
    facing: -1
  }));
  projectiles.length = 0;
  popups = [];
  roundOver = false;
  timeLeft = ROUND_TIME;
  timerTick = 0;
  announce("Round Start! 🐾", 120);
}

let announceFrames = 0;
function announce(text, frames = 50) {
  announcementEl.textContent = text;
  announceFrames = frames;
}

function addPopup(text, x, y) {
  popups.push({ text, x, y, life: 45 });
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function overlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function handleInput(cat, enemy) {
  cat.vx = 0;
  if (keys.has(cat.controls.left)) {
    cat.vx = -cat.speed;
    cat.facing = -1;
  }
  if (keys.has(cat.controls.right)) {
    cat.vx = cat.speed;
    cat.facing = 1;
  }
  if (keys.has(cat.controls.jump) && cat.y >= FLOOR_Y) {
    cat.vy = -cat.jumpPower;
  }

  if (cat.attackCooldown > 0) cat.attackCooldown--;
  if (cat.rangedCooldown > 0) cat.rangedCooldown--;

  if (keys.has(cat.controls.attack) && cat.attackCooldown === 0) {
    cat.attackCooldown = 28;
    const range = 55;
    const hitBox = {
      x: cat.facing === 1 ? cat.x + cat.w : cat.x - range,
      y: cat.y + 14,
      w: range,
      h: cat.h - 22
    };
    if (overlap(hitBox, enemy)) {
      enemy.stamina = clamp(enemy.stamina - MELEE_STAMINA_DRAIN, 0, 100);
      addPopup(sfxWords[(Math.random() * sfxWords.length) | 0], enemy.x + 20, enemy.y);
    } else {
      addPopup("SWISH!", cat.x + cat.w / 2, cat.y + 14);
    }
  }

  if (keys.has(cat.controls.ranged) && cat.rangedCooldown === 0) {
    cat.rangedCooldown = 50;
    projectiles.push({
      owner: cat,
      x: cat.facing === 1 ? cat.x + cat.w + 4 : cat.x - 16,
      y: cat.y + 26,
      vx: cat.facing * 6,
      size: 14
    });
    addPopup("YARN!", cat.x + cat.w / 2, cat.y);
  }
}

function updateCat(cat) {
  cat.vy += GRAVITY;
  cat.x += cat.vx;
  cat.y += cat.vy;

  cat.x = clamp(cat.x, 8, canvas.width - cat.w - 8);
  if (cat.y > FLOOR_Y) {
    cat.y = FLOOR_Y;
    cat.vy = 0;
  }
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx;
    const target = p.owner === player1 ? player2 : player1;
    const hitBox = { x: p.x, y: p.y, w: p.size, h: p.size };
    if (overlap(hitBox, target)) {
      target.stamina = clamp(target.stamina - PROJECTILE_STAMINA_DRAIN, 0, 100);
      addPopup("PLOP!", target.x + 22, target.y + 8);
      projectiles.splice(i, 1);
      continue;
    }
    if (p.x < -20 || p.x > canvas.width + 20) {
      projectiles.splice(i, 1);
    }
  }
}

function updatePopups() {
  popups = popups.filter((p) => {
    p.y -= 0.6;
    p.life--;
    return p.life > 0;
  });
}

function decideWinner() {
  if (player1.stamina <= 0 && player2.stamina <= 0) return "Double Cat Nap! 😴";
  if (player1.stamina <= 0) return `${player2.name} wins by Cat Nap! 😴`;
  if (player2.stamina <= 0) return `${player1.name} wins by Cat Nap! 😴`;
  if (player1.stamina === player2.stamina) return "Draw! Friendship wins! 🧶";
  if (player1.stamina > player2.stamina) return `${player1.name} wins! 🏆`;
  return `${player2.name} wins! 🏆`;
}

function updateHud() {
  p1StaminaEl.textContent = `P1 Stamina: ${player1.stamina}`;
  p2StaminaEl.textContent = `P2 Stamina: ${player2.stamina}`;
  timerEl.textContent = `Time: ${timeLeft}`;
}

function drawCat(cat) {
  ctx.save();
  ctx.translate(cat.x, cat.y);

  ctx.fillStyle = cat.color;
  ctx.fillRect(8, 24, 52, 44);

  ctx.beginPath();
  ctx.arc(34, 24, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(16, 7);
  ctx.lineTo(22, -8);
  ctx.lineTo(29, 10);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(40, 10);
  ctx.lineTo(47, -8);
  ctx.lineTo(52, 8);
  ctx.fill();

  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(27, 22, 2.6, 0, Math.PI * 2);
  ctx.arc(41, 22, 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff89ad";
  ctx.beginPath();
  ctx.arc(34, 30, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillRect(cat.facing === 1 ? 53 : -8, 34, 10, 6);

  ctx.restore();
}

function drawArena() {
  ctx.fillStyle = "#97d88f";
  ctx.fillRect(0, FLOOR_Y + 80, canvas.width, 30);

  ctx.fillStyle = "#ffffff88";
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(90 + i * 180, 80 + (i % 2) * 20, 36, 0, Math.PI * 2);
    ctx.arc(120 + i * 180, 80 + (i % 2) * 20, 26, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawProjectiles() {
  ctx.fillStyle = "#ff86b2";
  for (const p of projectiles) {
    ctx.beginPath();
    ctx.arc(p.x + p.size / 2, p.y + p.size / 2, p.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + 3, p.y + 3);
    ctx.lineTo(p.x + p.size - 3, p.y + p.size - 3);
    ctx.moveTo(p.x + p.size - 3, p.y + 3);
    ctx.lineTo(p.x + 3, p.y + p.size - 3);
    ctx.stroke();
  }
}

function drawPopups() {
  ctx.font = "bold 22px Comic Sans MS";
  ctx.textAlign = "center";
  for (const p of popups) {
    ctx.globalAlpha = p.life / 45;
    ctx.fillStyle = "#ff3f8f";
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawArena();

  if (!roundOver) {
    handleInput(player1, player2);
    handleInput(player2, player1);

    updateCat(player1);
    updateCat(player2);
    updateProjectiles();
    updatePopups();

    timerTick++;
    if (timerTick >= 60) {
      timerTick = 0;
      timeLeft--;
    }

    if (player1.stamina <= 0 || player2.stamina <= 0 || timeLeft <= 0) {
      roundOver = true;
      announce(decideWinner(), 99999);
    }
  }

  drawProjectiles();
  drawCat(player1);
  drawCat(player2);
  drawPopups();
  updateHud();

  if (announceFrames > 0) {
    announceFrames--;
    if (announceFrames === 0 && !roundOver) {
      announcementEl.textContent = "";
    }
  }

  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (["ArrowUp", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});

document.querySelectorAll("button[data-key]").forEach((btn) => {
  const key = btn.getAttribute("data-key");
  const press = (e) => {
    e.preventDefault();
    keys.add(key);
  };
  const release = (e) => {
    e.preventDefault();
    keys.delete(key);
  };
  btn.addEventListener("touchstart", press, { passive: false });
  btn.addEventListener("touchend", release, { passive: false });
  btn.addEventListener("mousedown", press);
  btn.addEventListener("mouseup", release);
  btn.addEventListener("mouseleave", release);
});

resetButton.addEventListener("click", resetRound);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocalhost) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      return;
    }

    navigator.serviceWorker.register("./sw.js").catch(() => {
      // ignore registration failure
    });
  });
}

resetRound();
loop();
